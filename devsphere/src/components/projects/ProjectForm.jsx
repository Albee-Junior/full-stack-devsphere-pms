import { useState } from "react";
import { Plus } from "lucide-react";
import { post } from "../../api/http.js";
import Dialog from "../ui/Dialog.jsx";
import { ErrorState } from "../ui/AsyncState.jsx";

export default function ProjectForm({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { project } = await post("/projects", { name, description });
      onCreated(project);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog eyebrow="START SOMETHING GOOD" title="Create a project" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="settings-label">Project name
          <input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Spring launch" />
        </label>
        <label className="settings-label">What are you building?
          <input maxLength={320} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A short project description" />
        </label>
        <ErrorState error={error} />
        <div className="modal-footer"><span>Invite teammates from your workspace</span><button className="button button-primary" type="submit" disabled={!name.trim() || saving}><Plus size={15} />{saving ? "Creating…" : "Create project"}</button></div>
      </form>
    </Dialog>
  );
}
