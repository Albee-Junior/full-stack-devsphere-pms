import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Filter, Flag, LayoutDashboard, MoreHorizontal, Plus } from "lucide-react";
import { get, patch, remove } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import TaskForm from "../components/tasks/TaskForm.jsx";

const columns = ["Todo", "In progress", "In review", "Done"];
const nextStatus = { Todo: "In progress", "In progress": "In review", "In review": "Done", Done: "Todo" };

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [filter, setFilter] = useState("All tasks");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [taskResult, projectResult] = await Promise.all([get("/tasks"), get("/projects")]);
      setTasks(taskResult.tasks);
      setProjects(projectResult.projects);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([get("/tasks"), get("/projects")])
      .then(([taskResult, projectResult]) => {
        if (!active) return;
        setTasks(taskResult.tasks);
        setProjects(projectResult.projects);
        setError("");
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function advance(task) {
    try {
      const { task: updated } = await patch(`/tasks/${task.id}`, { status: nextStatus[task.status] });
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteTask(task) {
    if (!window.confirm(`Delete “${task.title}”? This cannot be undone.`)) return;
    try {
      await remove(`/tasks/${task.id}`);
      setTasks((current) => current.filter((item) => item.id !== task.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading your tasks…" /></div>;

  return (
    <div className="page-content section-page">
      <PageHeading eyebrow="YOUR WORKSPACE" title="My tasks" description="All the moving pieces, in one place." actions={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> New task</button>} />
      <ErrorState error={error} onRetry={refresh} />
      <div className="board-toolbar">
        <div className="view-tabs"><button className="view-tab active"><LayoutDashboard size={15} /> Board</button><button className={`view-tab ${filter === "Open tasks" ? "active" : ""}`} onClick={() => setFilter(filter === "All tasks" ? "Open tasks" : "All tasks")}>{filter}</button></div>
        <button className={`button button-secondary button-small ${filter === "Open tasks" ? "active-filter" : ""}`} onClick={() => setFilter(filter === "Open tasks" ? "All tasks" : "Open tasks")}><Filter size={14} /> Open only</button>
      </div>
      <div className="kanban-board">
        {columns.map((column) => {
          const visibleTasks = tasks.filter((task) => task.status === column && (filter !== "Open tasks" || task.status !== "Done"));
          return (
            <section className="kanban-column" key={column}>
              <div className="kanban-column-heading"><span className={`column-dot column-${column.toLowerCase().replace(" ", "-")}`} /><h3>{column}</h3><span className="column-count">{visibleTasks.length}</span></div>
              <div className="kanban-cards" onDragOver={(event) => event.preventDefault()} onDrop={async (event) => {
                event.preventDefault();
                const taskId = Number(event.dataTransfer.getData("text/plain"));
                const task = tasks.find((item) => item.id === taskId);
                if (!task || task.status === column) return;
                setError("");
                setTasks((current) => current.map((item) => item.id === taskId ? { ...item, status: column } : item));
                try {
                  const { task: updated } = await patch(`/tasks/${taskId}`, { status: column });
                  setTasks((current) => current.map((item) => item.id === taskId ? updated : item));
                } catch (requestError) {
                  setTasks((current) => current.map((item) => item.id === taskId ? task : item));
                  setError(requestError.message);
                }
              }}>
                {visibleTasks.map((task) => (
                  <article className="kanban-card" key={task.id} draggable onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", String(task.id));
                    event.currentTarget.classList.add("kanban-card-dragging");
                  }} onDragEnd={(event) => event.currentTarget.classList.remove("kanban-card-dragging")}>
                    <div className="kanban-card-top"><span className="task-project-chip chip-violet">{task.project || "No project"}</span><button className="icon-button" aria-label={`Delete ${task.title}`} onClick={() => deleteTask(task)}><MoreHorizontal size={15} /></button></div>
                    <h4>{task.title}</h4>
                    {task.description && <p className="kanban-description">{task.description}</p>}
                    <div className="kanban-card-meta"><span className={`priority-label priority-text-${task.priority.toLowerCase()}`}><Flag size={12} /> {task.priority}</span><span className="kanban-due"><CalendarDays size={12} /> {task.due}</span></div>
                    <div className="kanban-card-bottom"><Avatar name="You" size="small" /><button className={`task-check ${task.status === "Done" ? "is-checked" : ""}`} onClick={() => advance(task)} aria-label={`${task.status === "Done" ? "Reopen" : "Advance"} ${task.title}`}>{task.status === "Done" ? <Check size={12} /> : <span className="task-next-arrow">→</span>}</button></div>
                  </article>
                ))}
                <button className="kanban-add" onClick={() => setShowForm(true)}><Plus size={15} /> Add task</button>
              </div>
            </section>
          );
        })}
      </div>
      {showForm && <TaskForm projects={projects} onClose={() => setShowForm(false)} onCreated={(task) => setTasks((current) => [task, ...current])} />}
    </div>
  );
}
