import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CalendarDays, CheckCheck, MoreHorizontal, Plus } from "lucide-react";
import { get, patch, remove } from "../api/http.js";
import ProjectForm from "../components/projects/ProjectForm.jsx";
import AvatarStack from "../components/ui/Avatar.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";
import ProjectDetails from "../components/projects/ProjectDetails.jsx";
import TaskForm from "../components/tasks/TaskForm.jsx";

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectTasks, setProjectTasks] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedProjectId = selectedProject?.id;

  const refresh = useCallback(async () => {
    try {
      const result = await get("/projects");
      setProjects(result.projects);
      if (selectedProject) {
        const details = await get(`/projects/${selectedProject.id}`);
        setSelectedProject(details.project);
        setProjectTasks(details.tasks);
      }
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    let active = true;
    Promise.all([get("/projects"), selectedProjectId ? get(`/projects/${selectedProjectId}`) : Promise.resolve(null)])
      .then(([{ projects: result }, details]) => { if (active) { setProjects(result); setSelectedProject(details?.project || null); setProjectTasks(details?.tasks || []); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) { setLoading(false); setLoadingDetails(false); } });
    return () => { active = false; };
  }, [selectedProjectId]);

  async function openProject(project) {
    setSelectedProject(project);
    setLoadingDetails(true);
    try {
      const { project: fullProject, tasks } = await get(`/projects/${project.id}`);
      setSelectedProject(fullProject);
      setProjectTasks(tasks);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function deleteProject(project) {
    if (!window.confirm(`Delete “${project.name}”? Its tasks will stay in your task list.`)) return;
    try {
      await remove(`/projects/${project.id}`);
      setProjects((current) => current.filter((item) => item.id !== project.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading your projects…" /></div>;
  if (selectedProject) {
    if (loadingDetails) return <div className="page-content"><LoadingState label="Loading project details…" /></div>;
    async function updateTaskStatus(task, status) {
      try {
        const { task: updated } = await patch(`/tasks/${task.id}`, { status });
        setProjectTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
        const { project: freshProject } = await get(`/projects/${selectedProject.id}`);
        setSelectedProject(freshProject);
      } catch (requestError) {
        setError(requestError.message);
      }
    }
    return <><ErrorState error={error} onRetry={refresh} /><ProjectDetails project={selectedProject} tasks={projectTasks} onBack={() => { setSelectedProject(null); setProjectTasks([]); }} onCreateTask={() => setShowTaskForm(true)} onTaskStatus={updateTaskStatus} />{showTaskForm && <TaskForm projects={projects} initialProjectId={selectedProject.id} onClose={() => setShowTaskForm(false)} onCreated={async () => { setShowTaskForm(false); await refresh(); }} />}</>;
  }

  return (
    <div className="page-content section-page">
      <PageHeading eyebrow="YOUR WORKSPACE" title="Projects" description="Big ideas, made better together." actions={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> New project</button>} />
      <ErrorState error={error} onRetry={refresh} />
      <div className="projects-overview-grid projects__grid">
        {projects.map((project) => (
          <article className="panel project-card" key={project.id} role="button" tabIndex={0} aria-label={`Open project ${project.name}`} onClick={() => openProject(project)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openProject(project); } }}>
            <div className="project-card-top"><span className={`project-mark project-mark-${project.color}`}>{project.code?.slice(0, 1) || project.name.slice(0, 1)}</span><button className="icon-button" aria-label={`Delete ${project.name}`} onClick={(event) => { event.stopPropagation(); deleteProject(project); }}><MoreHorizontal size={18} /></button></div>
            <span className="eyebrow">{project.code || "PROJECT"} · WORKSPACE</span>
            <h2>{project.name}</h2>
            <p>{project.description || "A new space for the team to plan, build, and share progress."}</p>
            <div className="project-card-progress"><div><span>Progress</span><strong>{project.progress}%</strong></div><span className="project-progress"><i className={`progress-${project.color}`} style={{ width: `${project.progress}%` }} /></span></div>
            <div className="project-card-footer"><AvatarStack names={[project.createdBy || "You"]} /><span><CheckCheck size={14} /> {project.tasks} tasks</span><span><CalendarDays size={14} /> {project.date}</span><span className="project-open-cue">Open details <ArrowRight size={13} /></span></div>
          </article>
        ))}
        <button className="project-create-card" onClick={() => setShowForm(true)}><span><Plus size={20} /></span><strong>Start something new</strong><small>Great things start with a blank canvas.</small></button>
      </div>
      {!projects.length && <div className="panel empty-panel"><h2>Your next big idea starts here.</h2><p>Create a project and give your team a place to move forward together.</p><button className="button button-primary" onClick={() => setShowForm(true)}>Create a project <ArrowRight size={14} /></button></div>}
      {showForm && <ProjectForm onClose={() => setShowForm(false)} onCreated={(project) => setProjects((current) => [...current, { ...project, progress: 0, tasks: "0/0", date: "No deadline" }])} />}
    </div>
  );
}
