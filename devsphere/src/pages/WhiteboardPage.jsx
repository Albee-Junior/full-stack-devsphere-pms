import { useEffect, useState } from "react";
import { MessageCircle, MoreHorizontal, MousePointer2, Plus, Save, Sparkles, SquarePen } from "lucide-react";
import { get, put } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import Avatar from "../components/ui/Avatar.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const startingNotes = [
  { id: 1, text: "Keep it simple", color: "yellow" },
  { id: 2, text: "Ship the smallest useful thing", color: "lavender" },
  { id: 3, text: "Make the first 5 minutes magic", color: "mint" },
];

export default function WhiteboardPage() {
  const [notes, setNotes] = useState(startingNotes);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    get("/workspace/features/whiteboard")
      .then(({ value }) => { if (Array.isArray(value)) setNotes(value); })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dirty || loading) return undefined;
    const timer = window.setTimeout(async () => {
      setSaving(true);
      try {
        await put("/workspace/features/whiteboard", { value: notes });
        setDirty(false);
        setError("");
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [dirty, loading, notes]);

  function updateNote(id, text) {
    setNotes((current) => current.map((note) => note.id === id ? { ...note, text } : note));
    setDirty(true);
  }

  function addNote() {
    setNotes((current) => [...current, { id: Date.now(), text: "Write an idea…", color: ["yellow", "lavender", "mint"][current.length % 3] }]);
    setDirty(true);
  }

  if (loading) return <div className="page-content"><LoadingState label="Opening your team board…" /></div>;

  return (
    <div className="page-content section-page">
      <PageHeading eyebrow="THINK OUT LOUD" title="Team brainstorm" description="A shared board for the ideas you build together." actions={<><span className="collab-live"><i /> {saving ? "Saving…" : dirty ? "Unsaved" : "Synced"}</span><button className="button button-primary" onClick={addNote}><Plus size={16} /> Add a sticky</button></>} />
      <ErrorState error={error} />
      <div className="whiteboard panel"><div className="whiteboard-toolbar"><span className="whiteboard-tool active"><MousePointer2 size={16} /></span><span className="whiteboard-tool"><SquarePen size={16} /></span><span className="whiteboard-tool"><MessageCircle size={16} /></span><span className="whiteboard-tool-divider" /><span><Save size={13} /> Auto-saved board</span></div><div className="whiteboard-canvas"><div className="board-grid" /><div className="board-label"><span className="board-label-icon"><Sparkles size={15} /></span><span>THE BIG IDEA</span><small>What would make work feel effortless?</small></div><svg className="board-connectors" viewBox="0 0 900 440" preserveAspectRatio="none" aria-hidden="true"><path d="M440 145 C390 170 320 180 215 210" /><path d="M460 145 C510 170 570 176 665 210" /><path d="M440 160 C400 220 380 260 400 310" /></svg><div className="sticky-grid">{notes.map((note) => <article className={`sticky-note sticky-${note.color}`} key={note.id}><span className="sticky-author"><Avatar name="Your team" size="tiny" /><span>Your team</span><MoreHorizontal size={14} /></span><textarea aria-label="Edit sticky note" maxLength={240} value={note.text} onChange={(event) => updateNote(note.id, event.target.value)} /></article>)}</div><div className="board-footer-note"><span className="online-dot" /> Your ideas are saved automatically</div></div></div>
    </div>
  );
}
