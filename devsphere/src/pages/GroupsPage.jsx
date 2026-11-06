import { useCallback, useEffect, useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { get, post, remove } from "../api/http.js";
import Dialog from "../components/ui/Dialog.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

export default function GroupsPage() {
  const [groups, setGroups] = useState([]);
  const [form, setForm] = useState({ name: "", description: "", topic: "General" });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyGroup, setBusyGroup] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { groups: result } = await get("/groups");
      setGroups(result);
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

  async function createGroup(event) {
    event.preventDefault();
    setBusyGroup("new");
    try {
      const { group } = await post("/groups", form);
      setGroups((current) => [group, ...current]);
      setForm({ name: "", description: "", topic: "General" });
      setShowForm(false);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyGroup(null);
    }
  }

  async function toggleMembership(group) {
    setBusyGroup(group.id);
    try {
      if (group.isMember) {
        await remove(`/groups/${group.id}/membership`);
        setGroups((current) => current.map((item) => item.id === group.id
          ? { ...item, isMember: false, memberCount: Math.max(0, item.memberCount - 1) }
          : item));
      } else {
        await post(`/groups/${group.id}/join`, {});
        setGroups((current) => current.map((item) => item.id === group.id
          ? { ...item, isMember: true, memberCount: item.memberCount + 1 }
          : item));
      }
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyGroup(null);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading workspace groups…" /></div>;

  return (
    <div className="page-content section-page business-page">
      <PageHeading eyebrow="COMMUNITY" title="Groups" description="Create focused spaces for classmates, clients, or project teams."
        actions={<button className="button button-primary" type="button" onClick={() => setShowForm(true)}><Plus size={15} /> Create group</button>} />
      <ErrorState error={error} onRetry={refresh} />
      <div className="groups-grid">
        {groups.map((group) => (
          <article className="panel group-card" key={group.id}>
            <span className="group-topic">{group.topic}</span>
            <h2>{group.name}</h2>
            <p>{group.description || "A shared place for workspace members to exchange ideas and updates."}</p>
            <div><span><UsersRound size={15} /> {group.memberCount} members</span>
              <button className={`button ${group.isMember ? "button-secondary" : "button-primary"}`} disabled={busyGroup === group.id} onClick={() => toggleMembership(group)}>
                {busyGroup === group.id ? "Updating…" : group.isMember ? "Leave group" : "Join group"}
              </button>
            </div>
          </article>
        ))}
        {!groups.length && <div className="panel empty-panel"><UsersRound size={22} /><h3>Create your first group.</h3><p>Bring together members around a class, client, or shared project.</p></div>}
      </div>
      {showForm && <Dialog eyebrow="WORKSPACE COMMUNITY" title="Create a group" onClose={() => setShowForm(false)}>
        <form className="crm-form" onSubmit={createGroup}>
          <label className="settings-label">Group name<input required maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="settings-label">Topic<input maxLength={60} value={form.topic} onChange={(event) => setForm((current) => ({ ...current, topic: event.target.value }))} /></label>
          <label className="settings-label">Description<textarea maxLength={1000} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label>
          <div className="modal-footer"><span>Group creation is limited by your workspace plan.</span><button className="button button-primary" disabled={busyGroup === "new"}>{busyGroup === "new" ? "Creating…" : "Create group"}</button></div>
        </form>
      </Dialog>}
    </div>
  );
}
