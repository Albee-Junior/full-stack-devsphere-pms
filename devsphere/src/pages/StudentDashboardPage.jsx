import { useCallback, useEffect, useState } from "react";
import { Award, BookOpenCheck, CalendarDays, CheckCircle2, GraduationCap, Plus, Send } from "lucide-react";
import { get, post } from "../api/http.js";
import Dialog from "../components/ui/Dialog.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const initialCourse = { name: "", instructor: "", term: "" };
const initialAssignment = { courseId: "", title: "", description: "", dueDate: "", pointsPossible: "100" };
const initialSubmission = { submissionText: "", submissionUrl: "" };

function formatDueDate(value) {
  if (!value) return "No due date";
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPoints(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export default function StudentDashboardPage() {
  const [dashboard, setDashboard] = useState({ courses: [], assignments: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState("");
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [course, setCourse] = useState(initialCourse);
  const [assignment, setAssignment] = useState(initialAssignment);
  const [submission, setSubmission] = useState(initialSubmission);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const loadDashboard = useCallback(() => get("/student/dashboard"), []);

  useEffect(() => {
    let active = true;
    loadDashboard()
      .then((result) => {
        if (active) {
          setDashboard(result);
          setError("");
        }
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadDashboard]);

  const refresh = useCallback(async () => {
    try {
      setDashboard(await loadDashboard());
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }, [loadDashboard]);

  function openDialog(name, currentAssignment = null) {
    setActionError("");
    setSelectedAssignment(currentAssignment);
    if (name === "course") setCourse(initialCourse);
    if (name === "assignment") setAssignment({ ...initialAssignment, courseId: dashboard.courses[0]?.id ? String(dashboard.courses[0].id) : "" });
    if (name === "submission") {
      setSubmission({
        submissionText: currentAssignment?.submissionText || "",
        submissionUrl: currentAssignment?.submissionUrl || "",
      });
    }
    if (name === "grade") {
      setScore(currentAssignment?.score === null ? "" : String(currentAssignment?.score ?? ""));
      setFeedback(currentAssignment?.feedback || "");
    }
    setDialog(name);
  }

  async function submitAction(event, action, reset) {
    event.preventDefault();
    setSaving(true);
    setActionError("");
    try {
      await action();
      reset?.();
      setDialog("");
      await refresh();
    } catch (requestError) {
      setActionError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  const { courses, assignments, summary } = dashboard;

  if (loading) return <div className="page-content"><LoadingState label="Loading your student dashboard…" /></div>;

  return (
    <div className="page-content section-page student-dashboard">
      <PageHeading
        eyebrow="YOUR LEARNING, IN ONE PLACE"
        title="Student dashboard"
        description="Keep coursework moving, submit your work, and stay on top of your grades."
        actions={<button className="button button-primary" onClick={() => openDialog(courses.length ? "assignment" : "course")}><Plus size={16} />{courses.length ? "Add assignment" : "Add a course"}</button>}
      />
      <ErrorState error={error} onRetry={refresh} />

      <section className="student-summary" aria-label="Study overview">
        <article className="student-stat panel"><span className="student-stat-icon"><BookOpenCheck size={18} /></span><div><span>Courses</span><strong>{summary.courseCount || 0}</strong></div></article>
        <article className="student-stat panel"><span className="student-stat-icon student-stat-icon-blue"><CalendarDays size={18} /></span><div><span>To do</span><strong>{summary.toDoCount || 0}</strong></div></article>
        <article className="student-stat panel"><span className="student-stat-icon student-stat-icon-green"><Send size={17} /></span><div><span>Submitted</span><strong>{summary.submittedCount || 0}</strong></div></article>
        <article className="student-stat panel"><span className="student-stat-icon student-stat-icon-gold"><Award size={18} /></span><div><span>Grade average</span><strong>{summary.averagePercent === null || summary.averagePercent === undefined ? "—" : `${summary.averagePercent}%`}</strong></div></article>
      </section>

      <div className="student-dashboard-grid">
        <section className="student-assignments panel">
          <div className="student-section-heading"><div><span className="eyebrow">KEEP YOUR MOMENTUM</span><h2>Assignments</h2></div><span className="student-count">{assignments.length}</span></div>
          {!assignments.length ? (
            <div className="student-empty"><BookOpenCheck size={24} /><h3>Your assignment list starts here.</h3><p>Add a course first, then keep each deadline and submission in one place.</p><button className="button button-primary" onClick={() => openDialog(courses.length ? "assignment" : "course")}><Plus size={15} />{courses.length ? "Add assignment" : "Add a course"}</button></div>
          ) : (
            <div className="student-assignment-list">
              {assignments.map((item) => (
                <article className="student-assignment" key={item.id}>
                  <div className="student-assignment-copy"><span className="student-course-name">{item.courseName}</span><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}<span className="student-due"><CalendarDays size={13} /> Due {formatDueDate(item.dueDate)} <span>·</span> {item.pointsPossible} pts</span></div>
                  <div className="student-assignment-actions"><span className={`student-status student-status-${item.status.toLowerCase().replace(" ", "-")}`}>{item.status}</span>{item.status === "To do" ? <button className="button button-secondary button-small" onClick={() => openDialog("submission", item)}>Submit work</button> : item.status === "Submitted" ? <><button className="button button-secondary button-small" onClick={() => openDialog("submission", item)}>Update work</button><button className="button button-secondary button-small" onClick={() => openDialog("grade", item)}>Record grade</button></> : <span className="student-grade">{formatPoints(item.score)} / {formatPoints(item.pointsPossible)}</span>}{item.submissionUrl && <a className="student-submission-link" href={item.submissionUrl} target="_blank" rel="noreferrer">View submission</a>}</div>
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="student-courses panel">
          <div className="student-section-heading"><div><span className="eyebrow">THIS TERM</span><h2>My courses</h2></div><button className="icon-button" aria-label="Add course" onClick={() => openDialog("course")}><Plus size={17} /></button></div>
          {!courses.length ? <div className="student-course-empty"><GraduationCap size={22} /><p>Add your first course to organize assignments and grades.</p></div> : <ul className="student-course-list">{courses.map((item) => <li key={item.id}><span className="student-course-mark"><BookOpenCheck size={15} /></span><span><strong>{item.name}</strong><small>{[item.instructor, item.term].filter(Boolean).join(" · ") || "Course details not added"}</small></span></li>)}</ul>}
          <div className="student-grade-note"><CheckCircle2 size={16} /><p>Use “Record grade” to track scores from your instructor or course portal. Your grades are private to your account.</p></div>
        </aside>
      </div>

      {dialog === "course" && <Dialog eyebrow="BUILD YOUR COURSE LIST" title="Add a course" onClose={() => setDialog("")}><form onSubmit={(event) => submitAction(event, () => post("/student/courses", course), () => setCourse(initialCourse))}><label className="settings-label">Course name<input autoFocus required maxLength={120} value={course.name} onChange={(event) => setCourse((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Introduction to Psychology" /></label><label className="settings-label">Instructor<input maxLength={120} value={course.instructor} onChange={(event) => setCourse((current) => ({ ...current, instructor: event.target.value }))} placeholder="Optional" /></label><label className="settings-label">Term<input maxLength={80} value={course.term} onChange={(event) => setCourse((current) => ({ ...current, term: event.target.value }))} placeholder="e.g. Fall 2026" /></label><ErrorState error={actionError} /><div className="modal-footer"><span>Only visible in your account</span><button className="button button-primary" disabled={saving || !course.name.trim()}><Plus size={15} />{saving ? "Saving…" : "Add course"}</button></div></form></Dialog>}

      {dialog === "assignment" && <Dialog eyebrow="PLAN THE NEXT MILESTONE" title="Add an assignment" onClose={() => setDialog("")}><form onSubmit={(event) => submitAction(event, () => post("/student/assignments", { ...assignment, courseId: Number(assignment.courseId), pointsPossible: Number(assignment.pointsPossible) }))}><label className="settings-label">Course<select required value={assignment.courseId} onChange={(event) => setAssignment((current) => ({ ...current, courseId: event.target.value }))}>{courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="settings-label">Assignment<input autoFocus required maxLength={180} value={assignment.title} onChange={(event) => setAssignment((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Research paper" /></label><label className="settings-label">Details<textarea maxLength={5000} rows={3} value={assignment.description} onChange={(event) => setAssignment((current) => ({ ...current, description: event.target.value }))} placeholder="Notes, instructions, or reminders" /></label><div className="student-form-row"><label className="settings-label">Due date<input type="date" value={assignment.dueDate} onChange={(event) => setAssignment((current) => ({ ...current, dueDate: event.target.value }))} /></label><label className="settings-label">Points possible<input type="number" min="1" max="10000" step="0.01" required value={assignment.pointsPossible} onChange={(event) => setAssignment((current) => ({ ...current, pointsPossible: event.target.value }))} /></label></div><ErrorState error={actionError} /><div className="modal-footer"><span>Keep every deadline visible</span><button className="button button-primary" disabled={saving || !assignment.title.trim()}><Plus size={15} />{saving ? "Saving…" : "Add assignment"}</button></div></form></Dialog>}

      {dialog === "submission" && selectedAssignment && <Dialog eyebrow={selectedAssignment.courseName} title="Submit your work" onClose={() => setDialog("")}><form onSubmit={(event) => submitAction(event, () => post(`/student/assignments/${selectedAssignment.id}/submissions`, submission), () => setSubmission(initialSubmission))}><p className="student-dialog-context">{selectedAssignment.title} · due {formatDueDate(selectedAssignment.dueDate)}</p><label className="settings-label">Your submission<textarea autoFocus maxLength={20000} rows={6} value={submission.submissionText} onChange={(event) => setSubmission((current) => ({ ...current, submissionText: event.target.value }))} placeholder="Write or paste your work here (optional if you add a link)" /></label><label className="settings-label">Link to your work<input type="url" maxLength={2048} value={submission.submissionUrl} onChange={(event) => setSubmission((current) => ({ ...current, submissionUrl: event.target.value }))} placeholder="https://…" /></label><ErrorState error={actionError} /><div className="modal-footer"><span>You can update your submission until graded</span><button className="button button-primary" disabled={saving || (!submission.submissionText.trim() && !submission.submissionUrl.trim())}><Send size={15} />{saving ? "Submitting…" : "Submit assignment"}</button></div></form></Dialog>}

      {dialog === "grade" && selectedAssignment && <Dialog eyebrow={selectedAssignment.courseName} title="Record your grade" onClose={() => setDialog("")}><form onSubmit={(event) => submitAction(event, () => post(`/student/assignments/${selectedAssignment.id}/grades`, { score: Number(score), feedback }))}><p className="student-dialog-context">{selectedAssignment.title} · out of {formatPoints(selectedAssignment.pointsPossible)} points</p><label className="settings-label">Score<input autoFocus type="number" min="0" max={selectedAssignment.pointsPossible} step="0.01" required value={score} onChange={(event) => setScore(event.target.value)} placeholder={`0–${formatPoints(selectedAssignment.pointsPossible)}`} /></label><label className="settings-label">Instructor feedback<textarea maxLength={2000} rows={3} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Optional notes to help you remember feedback" /></label><ErrorState error={actionError} /><div className="modal-footer"><span>Saved to your private grade tracker</span><button className="button button-primary" disabled={saving || score === ""}><Award size={15} />{saving ? "Saving…" : "Save grade"}</button></div></form></Dialog>}
    </div>
  );
}
