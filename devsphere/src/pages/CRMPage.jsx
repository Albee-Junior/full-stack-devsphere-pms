import { useCallback, useEffect, useState } from "react";
import { Building2, Mail, Plus, Trash2 } from "lucide-react";
import { get, patch, post, remove } from "../api/http.js";
import Dialog from "../components/ui/Dialog.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const stages = ["Lead", "Qualified", "Proposal", "Customer", "Inactive"];
const emptyContact = { name: "", company: "", email: "", phone: "", stage: "Lead", notes: "" };

export default function CRMPage() {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(emptyContact);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const { contacts: result } = await get("/crm");
      setContacts(result);
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

  async function createContact(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const { contact } = await post("/crm", form);
      setContacts((current) => [contact, ...current]);
      setForm(emptyContact);
      setShowForm(false);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateStage(contact, stage) {
    try {
      const { contact: updated } = await patch(`/crm/${contact.id}`, { stage });
      setContacts((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteContact(contact) {
    if (!window.confirm(`Remove ${contact.name} from the CRM?`)) return;
    try {
      await remove(`/crm/${contact.id}`);
      setContacts((current) => current.filter((item) => item.id !== contact.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading your CRM contacts…" /></div>;

  return (
    <div className="page-content section-page business-page">
      <PageHeading eyebrow="BUSINESS WORKSPACE" title="Customer relationships" description="Keep prospects and customer follow-ups organized in your workspace."
        actions={<button type="button" className="button button-primary" onClick={() => setShowForm(true)}><Plus size={15} /> Add contact</button>} />
      <ErrorState error={error} onRetry={refresh} />
      <section className="crm-contact-list">
        {contacts.map((contact) => (
          <article className="panel crm-contact-card" key={contact.id}>
            <div className="crm-contact-main">
              <span className="crm-contact-avatar"><Building2 size={18} /></span>
              <div><h2>{contact.name}</h2><p>{contact.company || "Independent contact"}</p></div>
            </div>
            <div className="crm-contact-detail">{contact.email && <a href={`mailto:${contact.email}`}><Mail size={14} />{contact.email}</a>}{contact.phone && <span>{contact.phone}</span>}</div>
            <label className="crm-stage-label">Relationship stage
              <select aria-label={`${contact.name} stage`} value={contact.stage} onChange={(event) => updateStage(contact, event.target.value)}>
                {stages.map((stage) => <option key={stage}>{stage}</option>)}
              </select>
            </label>
            <button type="button" className="icon-button file-delete-button" aria-label={`Delete ${contact.name}`} onClick={() => deleteContact(contact)}><Trash2 size={15} /></button>
            {contact.notes && <p className="crm-contact-notes">{contact.notes}</p>}
          </article>
        ))}
        {!contacts.length && <div className="panel empty-panel"><Building2 size={22} /><h3>Your CRM is ready.</h3><p>Add a contact to track a new lead, proposal, or customer.</p></div>}
      </section>
      {showForm && <Dialog eyebrow="CUSTOMER RELATIONSHIPS" title="Add a contact" onClose={() => setShowForm(false)}>
        <form className="crm-form" onSubmit={createContact}>
          <label className="settings-label">Name<input required maxLength={120} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="settings-label">Company<input maxLength={140} value={form.company} onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))} /></label>
          <label className="settings-label">Email<input type="email" maxLength={180} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
          <label className="settings-label">Phone<input maxLength={60} value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label>
          <label className="settings-label">Stage<select value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value }))}>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
          <label className="settings-label">Notes<textarea maxLength={3000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
          <div className="modal-footer"><span>Visible to workspace members.</span><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save contact"}</button></div>
        </form>
      </Dialog>}
    </div>
  );
}
