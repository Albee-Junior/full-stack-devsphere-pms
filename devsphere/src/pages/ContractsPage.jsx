import { useCallback, useEffect, useState } from "react";
import { FileText, Plus, Printer, Save, Trash2 } from "lucide-react";
import { get, patch, post, remove } from "../api/http.js";
import Dialog from "../components/ui/Dialog.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const templates = ["Service agreement", "Freelance project", "Tutoring agreement"];

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [active, setActive] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", clientName: "", contractType: templates[0], services: "", schedule: "", fees: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { contracts: result } = await get("/contracts");
      setContracts(result);
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

  async function createContract(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { contract } = await post("/contracts", form);
      setContracts((current) => [contract, ...current]);
      setActive(contract);
      setShowForm(false);
      setForm({ title: "", clientName: "", contractType: templates[0], services: "", schedule: "", fees: "" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!active) return;
    setSaving(true);
    try {
      const { contract } = await patch(`/contracts/${active.id}`, { title: active.title, content: active.content });
      setActive(contract);
      setContracts((current) => current.map((item) => item.id === contract.id ? contract : item));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteContract(contract) {
    if (!window.confirm(`Delete “${contract.title}”?`)) return;
    try {
      await remove(`/contracts/${contract.id}`);
      setContracts((current) => current.filter((item) => item.id !== contract.id));
      if (active?.id === contract.id) setActive(null);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading your drafts…" /></div>;

  return (
    <div className="page-content section-page contracts-page">
      <PageHeading eyebrow="BUSINESS & FREELANCE" title="Contract drafts" description="Build a clear first draft for a client, project, or tutoring engagement."
        actions={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={15} /> New draft</button>} />
      <ErrorState error={error} onRetry={refresh} />
      <div className="contract-layout">
        <aside className="contract-list panel" aria-label="Saved contracts"><h2>Your drafts</h2>{contracts.map((contract) => <div className={`contract-list-row ${active?.id === contract.id ? "active" : ""}`} key={contract.id}><button onClick={() => setActive(contract)}><FileText size={16} /><span><strong>{contract.title}</strong><small>{contract.clientName || contract.contractType}</small></span></button><button className="icon-button" aria-label={`Delete ${contract.title}`} onClick={() => deleteContract(contract)}><Trash2 size={14} /></button></div>)}{!contracts.length && <p className="empty-copy">Your saved drafts will appear here.</p>}</aside>
        <section className="contract-editor panel">{active ? <><div className="contract-editor-toolbar"><label className="settings-label">Draft title<input value={active.title} maxLength={140} onChange={(event) => setActive((current) => ({ ...current, title: event.target.value }))} /></label><div><button className="button button-secondary" onClick={() => window.print()}><Printer size={14} /> Print</button><button className="button button-primary" disabled={saving} onClick={saveDraft}><Save size={14} />{saving ? "Saving…" : "Save draft"}</button></div></div><textarea className="contract-content-editor" aria-label="Contract draft text" value={active.content} onChange={(event) => setActive((current) => ({ ...current, content: event.target.value }))} /><p className="contract-warning">Draft template only, not legal advice. Review the terms with a qualified professional for your jurisdiction before signing.</p></> : <div className="empty-panel"><FileText size={22} /><h2>Start with a useful first draft.</h2><p>Choose a template and add the project details. Edit and save the generated text before sharing it.</p><button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={14} /> Create a draft</button></div>}</section>
      </div>
      {showForm && <Dialog eyebrow="CREATE A STARTING POINT" title="Draft a contract" onClose={() => setShowForm(false)}><form className="contract-form" onSubmit={createContract}><label className="settings-label">Draft title<input required maxLength={140} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Website design agreement" /></label><label className="settings-label">Client or other party<input maxLength={120} value={form.clientName} onChange={(event) => setForm((current) => ({ ...current, clientName: event.target.value }))} placeholder="Client name" /></label><label className="settings-label">Template<select value={form.contractType} onChange={(event) => setForm((current) => ({ ...current, contractType: event.target.value }))}>{templates.map((template) => <option key={template}>{template}</option>)}</select></label><label className="settings-label">Services and scope<textarea required maxLength={3000} value={form.services} onChange={(event) => setForm((current) => ({ ...current, services: event.target.value }))} /></label><div className="contract-form-row"><label className="settings-label">Schedule<textarea required maxLength={800} value={form.schedule} onChange={(event) => setForm((current) => ({ ...current, schedule: event.target.value }))} /></label><label className="settings-label">Fees<textarea required maxLength={500} value={form.fees} onChange={(event) => setForm((current) => ({ ...current, fees: event.target.value }))} /></label></div><div className="contract-warning">These are editable starting templates, not legal advice or a substitute for jurisdiction-specific legal review.</div><div className="modal-footer"><span>Saved privately in your workspace.</span><button className="button button-primary" disabled={saving}>{saving ? "Creating…" : "Create draft"}</button></div></form></Dialog>}
    </div>
  );
}
