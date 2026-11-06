import { useEffect, useState } from "react";
import { ArrowUpRight, BarChart3, CheckCircle2, FolderKanban, HardDrive } from "lucide-react";
import { get } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

function formatStorage(bytes) {
  const gib = Number(bytes || 0) / (1024 ** 3);
  return gib >= 1 ? `${gib.toFixed(1)} GB` : `${(Number(bytes || 0) / (1024 ** 2)).toFixed(1)} MB`;
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    get("/analytics")
      .then((result) => { if (active) setData(result); })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, []);

  if (!data && !error) return <div className="page-content"><LoadingState label="Loading workspace analytics…" /></div>;

  return (
    <div className="page-content section-page business-page">
      <PageHeading eyebrow="BUSINESS WORKSPACE" title="Analytics" description="A clear view of project delivery, task progress, and workspace storage." />
      <ErrorState error={error} />
      {data && (
        <>
          <div className="business-metric-grid">
            <article className="panel business-metric"><FolderKanban size={20} /><span>Projects</span><strong>{data.summary.projects}</strong></article>
            <article className="panel business-metric"><BarChart3 size={20} /><span>Task completion</span><strong>{data.summary.completionRate}%</strong></article>
            <article className="panel business-metric"><CheckCircle2 size={20} /><span>Completed tasks</span><strong>{data.summary.completedTasks} / {data.summary.tasks}</strong></article>
            <article className="panel business-metric"><HardDrive size={20} /><span>Storage used</span><strong>{formatStorage(data.summary.storageBytes)}</strong></article>
          </div>
          <section className="panel business-report">
            <div className="business-report-heading"><div><span className="eyebrow">DELIVERY</span><h2>Project progress</h2></div><ArrowUpRight size={17} /></div>
            {data.projects.map((project) => (
              <div className="business-project-progress" key={project.id}>
                <div><strong>{project.name}</strong><span>{project.completedTasks} / {project.tasks} tasks · {project.progress}%</span></div>
                <div className="storage-meter" role="progressbar" aria-label={`${project.name} progress`} aria-valuenow={project.progress} aria-valuemin="0" aria-valuemax="100">
                  <span style={{ width: `${project.progress}%` }} />
                </div>
              </div>
            ))}
            {!data.projects.length && <p className="empty-copy">Create a project to start tracking delivery.</p>}
          </section>
          <section className="panel business-report">
            <div className="business-report-heading"><div><span className="eyebrow">TASK BOARD</span><h2>Tasks by status</h2></div></div>
            <div className="business-status-list">
              {data.tasksByStatus.map((row) => <div key={row.status}><span>{row.status}</span><strong>{row.count}</strong></div>)}
              {!data.tasksByStatus.length && <p className="empty-copy">Tasks will appear here as your team adds them.</p>}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
