import { useState } from "react";
import { ArrowRight, Send, ShieldCheck, Sparkles } from "lucide-react";
import { post } from "../api/http.js";
import { ErrorState } from "../components/ui/AsyncState.jsx";

const suggestions = ["Summarize my team's week", "What needs my attention?", "Help me plan this sprint"];

export default function AssistantPage() {
  const [prompt, setPrompt] = useState("");
  const [conversation, setConversation] = useState([]);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  async function ask(event) {
    event.preventDefault();
    const question = prompt.trim();
    if (!question || sending) return;
    setSending(true);
    setError("");
    try {
      const answer = await post("/assistant", { prompt: question });
      setConversation((current) => [...current, { question, answer: answer.answer, notice: answer.notice }]);
      setPrompt("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="page-content section-page assistant-page">
      <div className="assistant-intro"><span className="assistant-orb"><Sparkles size={24} /></span><span className="eyebrow">YOUR TEAMMATE, ON CALL</span><h1>A little help goes a long way.</h1><p>Ask DevSphere AI about your projects, get a first draft, or untangle your next big idea.</p></div>
      <div className="assistant-suggestions">{suggestions.map((item) => <button key={item} onClick={() => setPrompt(item)}><Sparkles size={14} />{item}<ArrowRight size={13} /></button>)}</div>
      <div className={`assistant-conversation ${conversation.length ? "has-conversation" : ""}`}>
        {!conversation.length && <div className="assistant-context"><div className="context-icon"><ShieldCheck size={18} /></div><div><strong>Helpful context, right from your workspace.</strong><p>Get a quick summary of your tasks and projects. Replies are generated locally by a built-in assistant—no external AI service is connected.</p></div></div>}
        {conversation.map((item, index) => <div className="assistant-turn" key={`${item.question}-${index}`}><div className="assistant-question"><span className="assistant-you">YOU</span><p>{item.question}</p></div><div className="assistant-answer"><span className="assistant-answer-icon"><Sparkles size={15} /></span><div><span className="assistant-answer-label">DEVSHPERE ASSISTANT</span><p>{item.answer}</p><small className="assistant-provider-note">{item.notice}</small></div></div></div>)}
      </div>
      <ErrorState error={error} />
      <form className="assistant-composer" onSubmit={ask}><textarea aria-label="Ask the assistant" value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(event); } }} maxLength={1200} placeholder="Ask anything about your work…" rows={2} /><div><span><Sparkles size={13} /> Grounded in your saved workspace data.</span><button className="send-button" type="submit" disabled={!prompt.trim() || sending} aria-label="Ask DevSphere assistant"><Send size={15} /></button></div></form>
    </div>
  );
}
