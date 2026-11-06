import { useCallback, useEffect, useState } from "react";
import { ArrowDownToLine, Puzzle } from "lucide-react";
import { get, post, remove } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

export default function ExtensionsPage() {
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { extensions: result } = await get("/extensions");
      setExtensions(result);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  async function toggleExtension(extension) {
    setWorkingKey(extension.key);
    try {
      if (extension.installed) {
        await remove(`/extensions/${encodeURIComponent(extension.key)}/install`);
      } else {
        await post(`/extensions/${encodeURIComponent(extension.key)}/install`, {});
      }
      setExtensions((current) => current.map((item) => item.key === extension.key
        ? { ...item, installed: !item.installed }
        : item));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setWorkingKey("");
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading the extensions catalog…" /></div>;

  return (
    <div className="page-content section-page business-page">
      <PageHeading eyebrow="WORKSPACE TOOLS" title="Extensions" description="Add small, focused capabilities to support study, client work, and team routines." />
      <ErrorState error={error} onRetry={refresh} />
      <div className="extensions-grid">
        {extensions.map((extension) => (
          <article className="panel extension-card" key={extension.key}>
            <span className="extension-icon"><Puzzle size={19} /></span>
            <span className="extension-category">{extension.category}</span>
            <h2>{extension.name}</h2>
            <p>{extension.description}</p>
            <div><span>{extension.minPlan === "free" ? "Free" : `${extension.minPlan[0].toUpperCase()}${extension.minPlan.slice(1)} plan`}</span>
              <button className={`button ${extension.installed ? "button-secondary" : "button-primary"}`} disabled={workingKey === extension.key} onClick={() => toggleExtension(extension)}>
                {workingKey === extension.key ? "Updating…" : extension.installed ? "Remove" : <><ArrowDownToLine size={14} /> Add extension</>}
              </button>
            </div>
          </article>
        ))}
        {!extensions.length && <div className="panel empty-panel"><Puzzle size={22} /><h3>No extensions are available yet.</h3></div>}
      </div>
    </div>
  );
}
