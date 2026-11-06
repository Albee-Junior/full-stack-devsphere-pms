import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { get, post } from "../../api/http.js";
import Dialog from "../ui/Dialog.jsx";
import { ErrorState } from "../ui/AsyncState.jsx";

export default function TaskForm({ projects, initialProjectId = "", onClose, onCreated }) {
  const [fetchedProjects, setFetchedProjects] = useState([]);
  const availableProjects = projects.length ? projects : fetchedProjects;
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState(initialProjectId ? String(initialProjectId) : "");
  const [priority, setPriority] = useState("Medium");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (projects.length) return undefined;
    let active = true;
    get("/projects")
      .then(({ projects: result }) => {
        if (!active) return;
        setFetchedProjects(result);
      })
      .catch((requestError) => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [projects]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { task } = await post("/tasks", {
        title,
        projectId: projectId === "__none__" ? null : projectId || availableProjects[0]?.id || null,
        priority,
        dueDate: null,
      });
      onCreated(task);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog eyebrow="MAKE IT HAPPEN" title="Create a task" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="settings-label">What needs to get done?
          <input autoFocus required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Prep the project kickoff" />
        </label>
        <div className="task-modal-selects">
          <label className="settings-label">Project
            <select value={projectId || (availableProjects[0] ? String(availableProjects[0].id) : "__none__")} onChange={(event) => setProjectId(event.target.value)}>
              <option value="__none__">No project</option>
              {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>
          <label className="settings-label">Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value)}>
              {["Low", "Medium", "High"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        <ErrorState error={error} />
        <div className="modal-footer">
          <span>Assigned to you</span>
          <button className="button button-primary" type="submit" disabled={!title.trim() || saving}><Plus size={15} />{saving ? "Creating…" : "Create task"}</button>
        </div>
      </form>
    </Dialog>
  );
}
