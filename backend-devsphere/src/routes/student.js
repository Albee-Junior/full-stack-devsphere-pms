import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";

const router = Router();
router.use(authenticateToken);

function parseDueDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw httpError(400, "Enter a valid due date.");
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw httpError(400, "Enter a valid due date.");
  }
  return value;
}

function parsePoints(value, label, { allowZero = false } = {}) {
  const points = Number(value);
  if (!Number.isFinite(points) || points > 10000 || (allowZero ? points < 0 : points <= 0)) {
    throw httpError(400, `${label} must be ${allowZero ? "between 0" : "greater than 0"} and 10,000.`);
  }
  return Math.round(points * 100) / 100;
}

function optionalText(value, label, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.trim().length > maxLength) {
    throw httpError(400, `${label} must be ${maxLength} characters or fewer.`);
  }
  return value.trim();
}

function parseSubmissionUrl(value) {
  const url = optionalText(value, "Submission link", 2048);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
  } catch {
    throw httpError(400, "Enter a valid http or https submission link.");
  }
  return url;
}

async function getAssignments(userId, workspaceId) {
  const assignments = await db.prepare(`
    SELECT a.id, a.course_id AS "courseId", c.name AS "courseName", a.title, a.description,
      a.due_date AS "dueDate", a.points_possible AS "pointsPossible",
      s.id AS "submissionId", s.submission_text AS "submissionText",
      s.submission_url AS "submissionUrl", s.score, s.feedback,
      s.submitted_at AS "submittedAt", s.graded_at AS "gradedAt",
      a.created_at AS "createdAt"
    FROM student_assignments a
    JOIN student_courses c ON c.id = a.course_id AND c.workspace_id = a.workspace_id
    LEFT JOIN student_submissions s ON s.assignment_id = a.id AND s.user_id = a.user_id
    WHERE a.user_id = ? AND a.workspace_id = ?
    ORDER BY a.due_date IS NULL, a.due_date, a.created_at DESC
  `).all(userId, workspaceId);
  return assignments.map((assignment) => ({
    ...assignment,
    pointsPossible: Number(assignment.pointsPossible),
    score: assignment.score === null ? null : Number(assignment.score),
    status: assignment.gradedAt ? "Graded" : assignment.submittedAt ? "Submitted" : "To do",
  }));
}

router.get("/dashboard", async (req, res) => {
  const courses = await db.prepare(`
    SELECT id, name, instructor, term, created_at AS "createdAt"
    FROM student_courses WHERE user_id = ? AND workspace_id = ?
    ORDER BY name
  `).all(req.user.id, req.user.workspaceId);
  const assignments = await getAssignments(req.user.id, req.user.workspaceId);
  const graded = assignments.filter((assignment) => assignment.score !== null);
  const possiblePoints = graded.reduce((total, assignment) => total + assignment.pointsPossible, 0);
  const earnedPoints = graded.reduce((total, assignment) => total + assignment.score, 0);
  const summary = {
    courseCount: courses.length,
    assignmentCount: assignments.length,
    toDoCount: assignments.filter((assignment) => assignment.status === "To do").length,
    submittedCount: assignments.filter((assignment) => assignment.status === "Submitted").length,
    gradedCount: graded.length,
    averagePercent: possiblePoints ? Math.round((earnedPoints / possiblePoints) * 1000) / 10 : null,
  };
  res.json({ courses, assignments, summary });
});

router.post("/courses", async (req, res) => {
  const name = requireText(req.body?.name, "Course name", 120);
  const instructor = optionalText(req.body?.instructor, "Instructor", 120);
  const term = optionalText(req.body?.term, "Term", 80);
  const existing = await db.prepare(`
    SELECT id FROM student_courses
    WHERE workspace_id = ? AND user_id = ? AND LOWER(name) = LOWER(?)
  `).get(req.user.workspaceId, req.user.id, name);
  if (existing) throw httpError(409, "You already have a course with this name.");
  const result = await db.prepare(`
    INSERT INTO student_courses (workspace_id, user_id, name, instructor, term)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.workspaceId, req.user.id, name, instructor, term);
  const course = await db.prepare(`
    SELECT id, name, instructor, term, created_at AS "createdAt"
    FROM student_courses WHERE id = ? AND user_id = ?
  `).get(result.lastInsertRowid, req.user.id);
  res.status(201).json({ course });
});

router.post("/assignments", async (req, res) => {
  const title = requireText(req.body?.title, "Assignment title", 180);
  const courseId = validateId(req.body?.courseId, "Course ID");
  const course = await db.prepare(`
    SELECT id FROM student_courses
    WHERE id = ? AND workspace_id = ? AND user_id = ?
  `).get(courseId, req.user.workspaceId, req.user.id);
  if (!course) throw httpError(400, "Choose one of your courses.");
  const description = optionalText(req.body?.description, "Description", 5000);
  const dueDate = parseDueDate(req.body?.dueDate);
  const pointsPossible = parsePoints(req.body?.pointsPossible ?? 100, "Points possible");
  const result = await db.prepare(`
    INSERT INTO student_assignments
      (workspace_id, user_id, course_id, title, description, due_date, points_possible)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.workspaceId, req.user.id, courseId, title, description, dueDate, pointsPossible);
  const assignment = (await getAssignments(req.user.id, req.user.workspaceId))
    .find((item) => item.id === result.lastInsertRowid);
  res.status(201).json({ assignment });
});

router.post("/assignments/:id/submissions", async (req, res) => {
  const assignmentId = validateId(req.params.id, "Assignment ID");
  const assignment = await db.prepare(`
    SELECT id FROM student_assignments
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `).get(assignmentId, req.user.id, req.user.workspaceId);
  if (!assignment) throw httpError(404, "Assignment not found.");
  const previousSubmission = await db.prepare(`
    SELECT graded_at AS "gradedAt" FROM student_submissions
    WHERE assignment_id = ? AND user_id = ? AND workspace_id = ?
  `).get(assignmentId, req.user.id, req.user.workspaceId);
  if (previousSubmission?.gradedAt) {
    throw httpError(409, "This assignment has already been graded and can no longer be resubmitted.");
  }
  const submissionText = optionalText(req.body?.submissionText, "Submission", 20000);
  const submissionUrl = parseSubmissionUrl(req.body?.submissionUrl);
  if (!submissionText && !submissionUrl) {
    throw httpError(400, "Add your work or provide a link before submitting.");
  }
  await db.prepare(`
    INSERT INTO student_submissions
      (workspace_id, user_id, assignment_id, submission_text, submission_url)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(assignment_id) DO UPDATE SET
      submission_text = EXCLUDED.submission_text,
      submission_url = EXCLUDED.submission_url,
      score = NULL,
      feedback = '',
      submitted_at = CURRENT_TIMESTAMP,
      graded_at = NULL,
      updated_at = CURRENT_TIMESTAMP
  `).run(req.user.workspaceId, req.user.id, assignmentId, submissionText, submissionUrl);
  const assignmentResult = (await getAssignments(req.user.id, req.user.workspaceId))
    .find((item) => item.id === assignmentId);
  res.status(201).json({ submission: assignmentResult });
});

router.post("/assignments/:id/grades", async (req, res) => {
  const assignmentId = validateId(req.params.id, "Assignment ID");
  const assignment = await db.prepare(`
    SELECT id, points_possible AS "pointsPossible"
    FROM student_assignments WHERE id = ? AND user_id = ? AND workspace_id = ?
  `).get(assignmentId, req.user.id, req.user.workspaceId);
  if (!assignment) throw httpError(404, "Assignment not found.");
  const submission = await db.prepare(`
    SELECT id FROM student_submissions
    WHERE assignment_id = ? AND user_id = ? AND workspace_id = ?
  `).get(assignmentId, req.user.id, req.user.workspaceId);
  if (!submission) throw httpError(409, "Submit this assignment before recording a grade.");
  const score = parsePoints(req.body?.score, "Score", { allowZero: true });
  if (score > Number(assignment.pointsPossible)) {
    throw httpError(400, "Score cannot be greater than the assignment's points possible.");
  }
  const feedback = optionalText(req.body?.feedback, "Feedback", 2000);
  await db.prepare(`
    UPDATE student_submissions
    SET score = ?, feedback = ?, graded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE assignment_id = ? AND user_id = ? AND workspace_id = ?
  `).run(score, feedback, assignmentId, req.user.id, req.user.workspaceId);
  const assignmentResult = (await getAssignments(req.user.id, req.user.workspaceId))
    .find((item) => item.id === assignmentId);
  res.json({ grade: assignmentResult });
});

export default router;
