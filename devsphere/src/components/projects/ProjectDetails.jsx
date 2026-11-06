import { useMemo } from "react";
import { ArrowLeft, CalendarDays, CheckCheck, Circle, Clock3, Flag, Plus, SquareArrowOutUpRight } from "lucide-react";
import PageHeading from "../ui/PageHeading.jsx";

const taskColumns = ["Todo", "In progress", "In review", "Done"];

export default function ProjectDetails({ project, tasks, onBack, onCreateTask, onTaskStatus }) {
  const groupedTasks = useMemo(() => Object.fromEntries(
    taskColumns.map((status) => [status, tasks.filter((task) => task.status === status)]),
  ), [tasks]);
  const dueDate = project.dueDate
    ? new Date(`${project.dueDate}T00:00:00`).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })
    : "No deadline set";

  return (
    <div className="page-content section-page project-detail-page">
      <button className="text-button project-back" onClick={onBack}><ArrowLeft size={15} /> All projects</button>
      <PageHeading eyebrow={`${project.code || "PROJECT"} · PROJECT DETAILS`} title={project.name} description={project.description || "A shared place for your team to plan and deliver work."}
        actions={<button className="button button-primary" onClick={onCreateTask}><Plus size={15} /> Add task</button>} />
      <div className="project-detail-stats">
        <article className="panel project-detail-stat"><span className="detail-stat-icon"><CheckCheck size={17} /></span><span><small>Completed tasks</small><strong>{project.completedTasks} / {project.taskCount}</strong></span></article>
        <article className="panel project-detail-stat"><span className="detail-stat-icon"><Circle size={17} /></span><span><small>Progress</small><strong>{project.progress}%</strong></span></article>
        <article className="panel project-detail-stat"><span className="detail-stat-icon"><CalendarDays size={17} /></span><span><small>Due date</small><strong>{dueDate}</strong></span></article>
        <article className="panel project-detail-stat"><span className="detail-stat-icon"><Clock3 size={17} /></span><span><small>Created</small><strong>{new Date(project.createdAt).toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" })}</strong></span></article>
      </div>
      <section className="project-detail-progress panel"><div><strong>Project progress</strong><span>{project.progress}% complete</span></div><div className="project-progress"><i className={`progress-${project.color || "violet"}`} style={{ width: `${project.progress}%` }} /></div></section>
      <div className="project-detail-board">
        {taskColumns.map((status) => (
          <section className="project-task-column" key={status}>
            <header><span className={`column-dot column-${status.toLowerCase().replace(" ", "-")}`} /><h2>{status}</h2><span className="column-count">{groupedTasks[status].length}</span></header>
            <div className="project-task-list">
              {groupedTasks[status].map((task) => (
                <article className="project-task-card panel" key={task.id}>
                  <div className="project-task-card-title"><strong>{task.title}</strong><span className={`priority-label priority-text-${task.priority.toLowerCase()}`}><Flag size={12} />{task.priority}</span></div>
                  {task.description && <p>{task.description}</p>}
                  <div className="project-task-card-meta"><span>{task.assigneeName || "Unassigned"}</span><span>{task.dueDate ? new Date(`${task.dueDate}T00:00:00`).toLocaleDateString([], { month: "short", day: "numeric" }) : "No due date"}</span></div>
                  <label className="project-task-status">Status<select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => onTaskStatus(task, event.target.value)}>{taskColumns.map((option) => <option key={option}>{option}</option>)}</select></label>
                </article>
              ))}
              {!groupedTasks[status].length && <div className="project-task-empty">No tasks in this stage.</div>}
            </div>
          </section>
        ))}
      </div>
      <a className="text-button project-detail-external" href="#projects" onClick={(event) => { event.preventDefault(); onBack(); }}><SquareArrowOutUpRight size={14} /> Back to project list</a>
    </div>
  );
}
