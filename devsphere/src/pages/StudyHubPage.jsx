import { useState } from "react";
import { BookOpenCheck, CalendarPlus, Check, Clock3, GraduationCap, Plus } from "lucide-react";
import { post } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState } from "../components/ui/AsyncState.jsx";

const studyIdeas = [
  { title: "Focus block", duration: "25 min", description: "Choose one small outcome and work without switching tabs." },
  { title: "Recall practice", duration: "15 min", description: "Close your notes and write down what you remember first." },
  { title: "Research session", duration: "40 min", description: "Capture source links and a one-sentence finding as you go." },
];

export default function StudyHubPage({ onNavigate }) {
  const [subject, setSubject] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  async function addStudyTask(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await post("/tasks", {
        title: taskTitle,
        description: subject ? `Subject / course: ${subject}` : "Study task",
        dueDate: dueDate || null,
        priority: "Medium",
      });
      setTaskTitle("");
      setCreated(true);
      window.setTimeout(() => setCreated(false), 3500);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-content section-page study-page">
      <PageHeading eyebrow="LEARNING STUDIO" title="Study hub" description="Plan assignments, reading, lab work, and research with a routine that fits your course."
        actions={<span className="study-audience-chip"><GraduationCap size={15} /> For every field of study</span>} />
      <ErrorState error={error} />
      {created && <div className="study-success"><Check size={16} /> Study task added to My tasks.</div>}
      <div className="study-layout">
        <section className="panel study-planner"><span className="study-icon"><BookOpenCheck size={19} /></span><h2>Plan a study task</h2><p>Turn an assignment, reading, or research goal into a trackable task.</p><form onSubmit={addStudyTask}><label className="settings-label">Task or assignment<input required maxLength={180} value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="e.g. Draft the biology lab report" /></label><label className="settings-label">Course, subject, or project<input maxLength={100} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="e.g. Organic chemistry" /></label><label className="settings-label">Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><button className="button button-primary" disabled={saving || !taskTitle.trim()}><CalendarPlus size={15} />{saving ? "Adding…" : "Add to my tasks"}</button></form></section>
        <section className="study-methods"><div className="study-methods-heading"><div><span className="eyebrow">SMALL, FOCUSED SESSIONS</span><h2>Study patterns</h2></div><Clock3 size={18} /></div>{studyIdeas.map((idea) => <article className="study-idea panel" key={idea.title}><span className="study-idea-icon"><Clock3 size={15} /></span><div><div><strong>{idea.title}</strong><span>{idea.duration}</span></div><p>{idea.description}</p></div></article>)}<div className="study-field-note panel"><strong>Works across disciplines</strong><p>Use this hub for problem sets, essays, studio critiques, field notes, lab reports, exam reviews, and independent research. Add details to the task description to keep your next step clear.</p></div></section>
      </div>
      <div className="study-note panel"><GraduationCap size={17} /><p>Use the shared board, calendar, documents, and assistant alongside this hub. Study tasks are private to your workspace and can be changed or removed at any time.</p><button className="text-button" onClick={() => onNavigate("My tasks")}><Plus size={14} /> View task board</button></div>
    </div>
  );
}
