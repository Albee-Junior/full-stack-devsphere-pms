import { useCallback, useEffect, useRef, useState } from "react";
import { Hash, MessageSquare, Send } from "lucide-react";
import { get, post } from "../api/http.js";
import { useAuth } from "../hooks/useAuth.js";
import { useRealtime } from "../hooks/useRealtime.js";
import Avatar from "../components/ui/Avatar.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

function messageTime(timestamp) {
  const date = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(timestamp) ? timestamp : `${timestamp}Z`);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const { socket, connected } = useRealtime();
  const [channels, setChannels] = useState([]);
  const [channelId, setChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messageEnd = useRef(null);

  const loadMessages = useCallback(async (id) => {
    if (!id) return;
    try {
      const { messages: results } = await get(`/messages?channelId=${id}`);
      setMessages(results);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    get("/messages/channels")
      .then(({ channels: result }) => {
        if (!active) return;
        setChannels(result);
        if (result.length) setChannelId(result[0].id);
      })
      .catch((requestError) => { if (active) { setError(requestError.message); setLoading(false); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!channelId) return undefined;
    let active = true;
    get(`/messages?channelId=${channelId}`)
      .then(({ messages: results }) => { if (active) { setMessages(results); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [channelId]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleMessage = (message) => {
      if (message.channelId === channelId) {
        setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      }
    };
    socket.on("message:new", handleMessage);
    return () => socket.off("message:new", handleMessage);
  }, [socket, channelId]);

  useEffect(() => { messageEnd.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !channelId || sending) return;
    setSending(true);
    setError("");
    try {
      const { message } = await post("/messages", { channelId, body });
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setDraft("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  }

  if (loading && !channels.length) return <div className="page-content"><LoadingState label="Connecting to your channels…" /></div>;
  const activeChannel = channels.find((channel) => channel.id === channelId);

  return (
    <div className="page-content section-page message-page">
      <PageHeading eyebrow="STAY IN THE LOOP" title="Messages" description="Good work happens when you talk about it." />
      <ErrorState error={error} onRetry={() => loadMessages(channelId)} />
      <div className="messages-layout panel">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-label">CHANNELS</div>
          {channels.map((channel) => <button key={channel.id} className={`channel-row ${channel.id === channelId ? "channel-active" : ""}`} onClick={() => { setChannelId(channel.id); setLoading(true); }}><Hash size={15} />{channel.name}</button>)}
          {!channels.length && <p className="empty-copy">No channels yet.</p>}
        </aside>
        <section className="chat-content">
          <div className="chat-header"><div><span className="chat-title"><Hash size={16} /> {activeChannel?.name || "Messages"}</span><span className="chat-presence"><i className={connected ? "" : "disconnected"} /> {connected ? "Live updates on" : "Reconnecting…"}</span></div></div>
          <div className="chat-day-divider"><span>WORKSPACE CONVERSATION</span></div>
          <div className="chat-messages">
            {messages.map((message) => (
              <article className={`chat-message ${message.authorId === user?.id ? "chat-message-own" : ""}`} key={message.id}>
                <Avatar name={message.authorName} size="small" />
                <div className="chat-message-content"><div className="chat-message-meta"><strong>{message.authorName}</strong><time>{messageTime(message.createdAt)}</time></div><p>{message.body}</p></div>
              </article>
            ))}
            {!messages.length && <div className="empty-panel"><MessageSquare size={22} /><p>Nothing here yet. Start the conversation.</p></div>}
            <div ref={messageEnd} />
          </div>
          <form className="chat-composer" onSubmit={sendMessage}><div className="composer-toolbar"><span><Hash size={13} /> {activeChannel?.name || "channel"}</span><span>{connected ? "Live" : "Offline"}</span></div><textarea aria-label="Write a message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(event); } }} maxLength={4000} placeholder={`Message #${activeChannel?.name || "channel"}`} rows={2} /><div className="composer-bottom"><span>Press <kbd>Enter</kbd> to send</span><button className="send-button" type="submit" disabled={!draft.trim() || sending} aria-label="Send message"><Send size={15} /></button></div></form>
        </section>
      </div>
    </div>
  );
}
