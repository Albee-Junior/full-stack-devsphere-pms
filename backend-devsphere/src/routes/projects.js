import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { notifyWorkspace } from "../utils/notifications.js";
import { enforceCountLimit, getWorkspacePlan } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken);

function projectSummary(project, userName) {
  const taskCount = Number(project.taskCount);
  const completedTasks = Number(project.completedTasks || 0);
  return {
    ...project,
    taskCount,
    completedTasks,
    progress: taskCount ? Math.round((completedTasks / taskCount) * 100) : 0,
    tasks: `${completedTasks}/${taskCount}`,
    date: project.dueDate
      ? new Date(`${project.dueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "No deadline",
    people: [userName.slice(0, 1) + userName.split(" ").at(-1).slice(0, 1)],
  };
}

router.get("/", async (req, res) => {
  const projects = await db.prepare(`
    SELECT p.id, p.name, p.description, p.code, p.color, p.due_date AS "dueDate",
      p.created_at AS "createdAt", COUNT(t.id) AS "taskCount",
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) AS "completedTasks"
    FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND t.workspace_id = p.workspace_id
    WHERE p.workspace_id = ? GROUP BY p.id ORDER BY p.created_at, p.id
  `).all(req.user.workspaceId);
  res.json({ projects: projects.map((project) => projectSummary(project, req.user.name)) });
});

router.get("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Project ID");
  const project = await db.prepare(`
    SELECT p.id, p.name, p.description, p.code, p.color, p.due_date AS "dueDate",
      p.created_at AS "createdAt", COUNT(t.id) AS "taskCount",
      SUM(CASE WHEN t.status = 'Done' THEN 1 ELSE 0 END) AS "completedTasks"
    FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND t.workspace_id = p.workspace_id
    WHERE p.id = ? AND p.workspace_id = ? GROUP BY p.id
  `).get(id, req.user.workspaceId);
  if (!project) throw httpError(404, "Project not found.");
  const tasks = await db.prepare(`
    SELECT t.id, t.title, t.description, t.status, t.priority,
      t.due_date AS "dueDate", t.created_at AS "createdAt", t.updated_at AS "updatedAt",
      t.assignee_id AS "assigneeId", u.name AS "assigneeName"
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ? AND t.workspace_id = ?
    ORDER BY CASE t.status WHEN 'In progress' THEN 0 WHEN 'In review' THEN 1 WHEN 'Todo' THEN 2 ELSE 3 END,
      t.due_date, t.created_at
  `).all(id, req.user.workspaceId);
  res.json({ project: projectSummary(project, req.user.name), tasks });
});

router.post("/", async (req, res) => {
  const plan = await getWorkspacePlan(req.user.workspaceId);
  await enforceCountLimit(req.user.workspaceId, "projects", "workspace_id", plan.maxProjects, "project");
  const name = requireText(req.body?.name, "Project name", 100);
  const description = typeof req.body.description === "string" ? req.body.description.trim().slice(0, 2000) : "";
  const color = ["violet", "blue", "orange"].includes(req.body.color) ? req.body.color : "violet";
  const code = name.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
  const result = await db.prepare(`
    INSERT INTO projects (workspace_id, name, description, code, color, due_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.workspaceId, name, description, code, color, req.body.dueDate || null);
  const project = await db.prepare(`
    SELECT id, name, description, code, color, due_date AS "dueDate", created_at AS "createdAt",
      0 AS "taskCount", 0 AS "completedTasks" FROM projects WHERE id = ?
  `).get(result.lastInsertRowid);
  req.app.get("io").to(`workspace:${req.user.workspaceId}`).emit("project:created", project);
  await notifyWorkspace({
    workspaceId: req.user.workspaceId,
    actorId: req.user.id,
    kind: "project",
    title: "A new project was created",
    body: name,
    target: "Projects",
  });
  res.status(201).json({ project: projectSummary(project, req.user.name) });
});

router.patch("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Project ID");
  const project = await db.prepare("SELECT * FROM projects WHERE id = ? AND workspace_id = ?").get(id, req.user.workspaceId);
  if (!project) throw httpError(404, "Project not found.");
  const name = req.body.name === undefined ? project.name : requireText(req.body.name, "Project name", 100);
  const description = req.body.description === undefined ? project.description : String(req.body.description).trim().slice(0, 2000);
  const dueDate = req.body.dueDate === undefined ? project.due_date : req.body.dueDate;
  await db.prepare("UPDATE projects SET name = ?, description = ?, due_date = ? WHERE id = ?")
    .run(name, description, dueDate || null, id);
  const updated = await db.prepare(`
    SELECT id, name, description, code, color, due_date AS "dueDate", created_at AS "createdAt",
      0 AS "taskCount", 0 AS "completedTasks" FROM projects WHERE id = ?
  `).get(id);
  res.json({ project: updated });
});

router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Project ID");
  const result = await db.prepare("DELETE FROM projects WHERE id = ? AND workspace_id = ?").run(id, req.user.workspaceId);
  if (!result.changes) throw httpError(404, "Project not found.");
  res.status(204).end();
});

export default router;
