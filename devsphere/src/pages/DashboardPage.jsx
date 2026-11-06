import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, FolderKanban, Plus, Sparkles, Video, Zap } from "lucide-react";
import { get, patch } from "../api/http.js";
import { useAuth } from "../hooks/useAuth.js";
import { useRealtime } from "../hooks/useRealtime.js";
import Avatar from "../components/ui/Avatar.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

function Stat({ icon: Icon, label, value, tone, change }) {
  const prototypeTone = {
    "stat-violet": "purple",
    "stat-blue": "blue",
    "stat-amber": "gold",
    "stat-green": "green",
  }[tone] || "purple";
  return <article className="stat-card">
    <div className="stat-card-top stat-card__head">
      <span className="stat-label stat-card__label">{label}</span>
      <span className={`stat-icon stat-card__icon stat-card__icon--${prototypeTone} ${tone}`}><Icon size={17} /></span>
    </div>
    <div className="stat-card-bottom">
      <strong className="stat-card__value">{value}</strong>
      <span className="stat-change positive stat-card__trend stat-card__trend--up"><ArrowUpRight size={13} />{change}</span>
    </div>
    <span className="stat-caption stat-card__foot">in your workspace</span>
  </article>;
}

export default function DashboardPage({ onNavigate, onAddTask, onCreateProject }) {
  const { user } = useAuth();
  const { socket } = useRealtime();
  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [dashboard, taskResult, projectResult] = await Promise.all([
        get("/workspace/dashboard"), get("/tasks"), get("/projects"),
      ]);
      setData(dashboard);
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
    Promise.all([get("/workspace/dashboard"), get("/tasks"), get("/projects")])
      .then(([dashboard, taskResult, projectResult]) => {
        if (!active) return;
        setData(dashboard);
        setTasks(taskResult.tasks);
        setProjects(projectResult.projects);
        setError("");
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!socket) return undefined;
    const reload = () => refresh();
    socket.on("task:created", reload);
    socket.on("task:updated", reload);
    socket.on("task:deleted", reload);
    socket.on("event:created", reload);
    socket.on("project:created", reload);
    return () => {
      socket.off("task:created", reload);
      socket.off("task:updated", reload);
      socket.off("task:deleted", reload);
      socket.off("event:created", reload);
      socket.off("project:created", reload);
    };
  }, [socket, refresh]);

  async function completeTask(task) {
    const status = task.status === "Done" ? "Todo" : "Done";
    try {
      const { task: updated } = await patch(`/tasks/${task.id}`, { status });
      setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
      setData((current) => current ? {
        ...current,
        counts: {
          ...current.counts,
          done: current.counts.done + (status === "Done" ? 1 : -1),
          open: current.counts.open + (status === "Done" ? -1 : 1),
        },
      } : current);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <div className="page-content"><LoadingState /></div>;

  const focusTasks = tasks.filter((task) => task.status !== "Done").slice(0, 5);
  const firstName = user?.name?.split(" ")[0] || "there";
  const greeting = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date()).toUpperCase();
  const dueTodayCount = tasks.filter((task) => task.due === "Today").length;
  const scheduledTodayCount = (data?.events || []).filter((event) => new Date(event.startsAt) >= new Date()).length;

  return (
    <div className="page-content overview-page dashboard">
      <div className="welcome-row page-header dashboard__greeting">
        <div className="page-header__titles">
          <div className="welcome-kicker dashboard__greeting-label"><span className="online-dot" />{greeting}</div>
          <h1 className="page-title">Good morning, {firstName}</h1>
          <p className="page-subtitle">You have {dueTodayCount} tasks due today and {scheduledTodayCount} {scheduledTodayCount === 1 ? "meeting" : "meetings"} scheduled.</p>
        </div>
        <div className="welcome-actions page-actions"><button className="button button-secondary" onClick={() => onNavigate("Huddle")}><Video size={16} /> Start a huddle</button><button className="button button-primary" onClick={onAddTask}><Plus size={17} /> New task</button></div>
      </div>
      <ErrorState error={error} onRetry={refresh} />
      <section className="ai-insight"><span className="insight-icon"><Sparkles size={18} /></span><div className="insight-copy"><span className="insight-label">YOUR WORKSPACE, AT A GLANCE <span className="insight-live">LIVE</span></span><p>You have <strong>{data?.counts.open ?? 0} open tasks</strong> across <strong>{data?.projectCount ?? 0} projects</strong>. {data?.counts.highPriority ? <><strong>{data.counts.highPriority} high-priority items</strong> could use some attention.</> : "You can make space for the next good idea."}</p></div><button className="insight-action" onClick={() => onNavigate("AI assistant")}>Ask your assistant <ArrowRight size={14} /></button></section>
      <section className="stats-grid dashboard__stats" aria-label="Workspace statistics">
        <Stat label="Completed tasks" value={data?.counts.done ?? 0} change="All time" icon={CheckCheck} tone="stat-violet" />
        <Stat label="In progress" value={data?.counts.inProgress ?? 0} change="Active" icon={Activity} tone="stat-blue" />
        <Stat label="Needs review" value={data?.counts.review ?? 0} change="Open" icon={Zap} tone="stat-amber" />
        <Stat label="Projects" value={data?.projectCount ?? 0} change="In workspace" icon={FolderKanban} tone="stat-green" />
      </section>
      <section className="overview-grid dashboard__row">
        <article className="panel tasks-panel">
          <div className="section-heading panel__header"><h2 className="panel__title">Today&apos;s focus</h2><button className="text-button panel__action" onClick={() => onNavigate("My tasks")}>All tasks <ArrowRight size={15} /></button></div>
          <div className="task-list focus-list panel__body panel__body--flush">{focusTasks.map((task) => <div className="task-row focus-item" key={task.id}><button className="task-check focus-item__check" aria-label={`Complete ${task.title}`} onClick={() => completeTask(task)}><Check size={12} /></button><div className="task-main focus-item__body"><span className="task-title focus-item__title">{task.title}</span><span className="task-project focus-item__project">{task.project || "No project"}</span></div><span className={`priority-dot priority-${task.priority.toLowerCase()}`} title={`${task.priority} priority`} /><span className={`task-due ${task.due === "Today" ? "due-today" : ""}`}>{task.due}</span></div>)}{!focusTasks.length && <p className="empty-state">Your team is all caught up. Add a task to get started.</p>}</div>
          <button className="add-task-link" onClick={onAddTask}><Plus size={15} /> Add a task</button>
        </article>
        <article className="panel projects-panel">
          <div className="section-heading panel__header"><h2 className="panel__title">Your projects</h2><button className="text-button panel__action" onClick={() => onNavigate("Projects")}>All projects <ArrowRight size={15} /></button></div>
          <div className="project-list">{projects.slice(0, 4).map((project) => <button className="project-row" key={project.id} onClick={() => onNavigate("Projects")}><span className={`project-mark project-mark-${project.color}`}>{project.code?.slice(0, 1) || project.name.slice(0, 1)}</span><span className="project-details"><span className="project-name">{project.name}</span><span className="project-meta">{project.tasks} tasks</span><span className="project-progress"><i className={`progress-${project.color}`} style={{ width: `${project.progress}%` }} /></span></span><span className="project-progress-number">{project.progress}%</span></button>)}</div>
          {!projects.length && <p className="empty-state">Create a project to give your ideas a home.</p>}
          <button className="add-project-link" onClick={() => onCreateProject ? onCreateProject() : onNavigate("Projects")}><Plus size={14} /> Create a project</button>
        </article>
      </section>
      <section className="overview-grid lower-grid">
        <article className="panel activity-panel"><div className="section-heading"><h2>Coming up</h2><button className="text-button" onClick={() => onNavigate("Calendar")}>Open calendar <ArrowRight size={15} /></button></div>{(data?.events || []).slice(0, 3).map((event) => <div className="activity-item" key={event.id}><span className="stat-icon stat-violet"><CalendarDays size={15} /></span><p><strong>{event.title}</strong><span> {event.description}</span><small>{new Date(event.startsAt).toLocaleString()}</small></p></div>)}{!data?.events?.length && <p className="empty-state">No events coming up. Make room for a team catch-up.</p>}<button className="add-task-link" onClick={() => onNavigate("Calendar")}><Plus size={14} /> Schedule an event</button></article>
        <article className="panel activity-panel"><div className="section-heading"><h2>Team space</h2><button className="text-button" onClick={() => onNavigate("Community")}>Community <ArrowRight size={15} /></button></div><div className="activity-item"><Avatar name={user?.name || "Member"} size="small" /><p><strong>{user?.name}</strong><span> Your projects and discussions stay backed by your workspace.</span><small>Connected and ready</small></p></div><button className="activity-huddle" onClick={() => onNavigate("Messages")}><span className="huddle-status"><i /> Your team workspace is ready</span><span className="huddle-action">Open messages <ArrowRight size={14} /></span></button><button className="add-task-link" onClick={() => onNavigate("Blog & news")}><CalendarDays size={14} /> Read platform updates</button></article>
      </section>
    </div>
  );
}
