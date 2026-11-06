import { useCallback, useEffect, useState } from "react";
import { Check, ShieldCheck, SlidersHorizontal } from "lucide-react";
import { get } from "../api/http.js";
import { useAuth } from "../hooks/useAuth.js";
import Avatar from "../components/ui/Avatar.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const industries = ["Student", "Business", "Freelancer", "Software", "Design", "Education", "Research", "Other"];
const roles = ["Student", "Business owner", "Freelancer", "Team member", "Educator", "Researcher"];
const teamSizes = ["Just me", "2–5", "6–15", "16–50", "51+"];
const workflows = ["Flexible", "Kanban", "Weekly planning", "Study schedule"];

export default function SettingsPage() {
  const { user, saveWorkspacePreferences } = useAuth();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { preferences } = await get("/workspace/preferences");
      setForm(preferences);
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

  async function save(event) {
    event.preventDefault();
    if (!form || saving) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const result = await saveWorkspacePreferences(form);
      setForm(result);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading workspace settings…" /></div>;

  return (
    <div className="page-content section-page">
      <PageHeading eyebrow="MAKE IT YOURS" title="Settings" description="Your account, workspace preferences, and privacy basics." />
      <ErrorState error={error} onRetry={refresh} />
      <div className="settings-layout">
        <aside className="panel settings-nav"><span className="settings-nav-item active"><SlidersHorizontal size={15} /> Workspace preferences</span><span className="settings-nav-item"><ShieldCheck size={15} /> Privacy &amp; security</span></aside>
        <section className="panel settings-panel"><span className="eyebrow">ACCOUNT</span><h2>Your profile</h2><p>Your sign-in details and workspace membership.</p><div className="profile-edit"><Avatar name={user?.name || "Member"} size="large" /><div><strong>{user?.name}</strong><p>Workspace member</p></div></div><div className="settings-label">Email address<div className="settings-value">{user?.email}</div></div>
          {form && <form className="workspace-settings-form" onSubmit={save}><span className="eyebrow">WORKSPACE</span><label className="settings-label">Workspace name<input required minLength={2} maxLength={80} value={form.workspaceName} onChange={(event) => setForm((current) => ({ ...current, workspaceName: event.target.value }))} /></label><div className="workspace-settings-grid"><label className="settings-label">Your role<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>{roles.map((item) => <option key={item}>{item}</option>)}</select></label><label className="settings-label">Field of work or study<select value={form.industry} onChange={(event) => setForm((current) => ({ ...current, industry: event.target.value }))}>{industries.map((item) => <option key={item}>{item}</option>)}</select></label><label className="settings-label">Team size<select value={form.teamSize} onChange={(event) => setForm((current) => ({ ...current, teamSize: event.target.value }))}>{teamSizes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="settings-label">Preferred workflow<select value={form.workflow} onChange={(event) => setForm((current) => ({ ...current, workflow: event.target.value }))}>{workflows.map((item) => <option key={item}>{item}</option>)}</select></label></div><button className="button button-primary" disabled={saving}>{saved ? <Check size={15} /> : <SlidersHorizontal size={15} />}{saving ? "Saving…" : saved ? "Saved" : "Save preferences"}</button></form>}
          <div className="privacy-notice"><ShieldCheck size={15} /> Your workspace data is stored in PostgreSQL. Passwords are hashed before they are saved; payment credentials are kept only in the backend environment.</div>
        </section>
      </div>
    </div>
  );
}
