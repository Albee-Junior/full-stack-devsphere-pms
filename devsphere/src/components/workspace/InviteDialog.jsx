import { useState } from "react";
import { Check, Copy, Send, Users } from "lucide-react";
import { post } from "../../api/http.js";
import Dialog from "../ui/Dialog.jsx";
import { ErrorState } from "../ui/AsyncState.jsx";

export default function InviteDialog({ onClose }) {
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function createInvite(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await post("/workspace/invitations", { email });
      setInviteUrl(result.inviteUrl);
      try {
        await navigator.clipboard.writeText(result.inviteUrl);
        setCopied(true);
      } catch {
        setCopied(false);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog eyebrow="GREAT WORK IS BETTER TOGETHER" title="Invite a teammate" onClose={onClose}>
      {!inviteUrl ? (
        <form onSubmit={createInvite}>
          <p className="invite-explainer">Create a secure, single-use invitation link for someone to join your workspace. It expires in seven days.</p>
          <label className="settings-label">Teammate&apos;s email
            <input autoFocus required maxLength={160} type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="teammate@company.com" />
          </label>
          <ErrorState error={error} />
          <div className="modal-footer"><span><Users size={14} /> Shared workspace access</span><button className="button button-primary" type="submit" disabled={!email.trim() || saving}><Send size={14} />{saving ? "Creating…" : "Create invite link"}</button></div>
        </form>
      ) : (
        <div className="invite-result">
          <span className="invite-success"><Check size={17} /> Invite ready for {email}</span>
          <p>{copied ? "The invitation link is copied. Send it to your teammate to join." : "Share this invitation link with your teammate. It expires in seven days."}</p>
          <label className="settings-label">Single-use invitation link<input readOnly value={inviteUrl} onFocus={(event) => event.target.select()} /></label>
          <button className="button button-secondary" onClick={async () => {
            try {
              await navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
              setError("");
            } catch {
              setError("Clipboard access is unavailable. Select the invitation link to copy it.");
            }
          }}><Copy size={14} /> Copy link</button>
          <ErrorState error={error} />
        </div>
      )}
    </Dialog>
  );
}
