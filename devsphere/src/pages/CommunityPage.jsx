import { useCallback, useEffect, useState } from "react";
import { Heart, MessageCircle, Plus, Send, UsersRound } from "lucide-react";
import { get, post } from "../api/http.js";
import { useAuth } from "../hooks/useAuth.js";
import Avatar from "../components/ui/Avatar.jsx";
import Dialog from "../components/ui/Dialog.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const topics = ["All topics", "Teamwork", "Show & tell", "Ideas", "General"];

function DiscussionCard({ post: discussion, onLike, onReply }) {
  const [comments, setComments] = useState(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  async function toggleComments() {
    if (comments !== null) {
      setComments(null);
      return;
    }
    try {
      const result = await get(`/community/${discussion.id}/comments`);
      setComments(result.comments);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function reply(event) {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      const result = await onReply(discussion.id, draft.trim());
      setComments((current) => [...(current || []), result]);
      setDraft("");
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <article className="panel community-post">
      <div className="community-post-author"><Avatar name={discussion.authorName} size="small" /><div><strong>{discussion.authorName}</strong><span>{new Date(discussion.createdAt).toLocaleString()}</span></div><span className="community-topic">{discussion.topic}</span></div>
      <h2>{discussion.title}</h2><p>{discussion.body}</p>
      <div className="community-post-actions"><button className={discussion.likedByMe ? "liked" : ""} onClick={() => onLike(discussion)}><Heart size={15} fill={discussion.likedByMe ? "currentColor" : "none"} />{discussion.likes} likes</button><button onClick={toggleComments}><MessageCircle size={15} />{discussion.comments} replies</button></div>
      {comments && <div className="community-replies">{comments.map((comment) => <div className="community-reply" key={comment.id}><Avatar name={comment.authorName} size="tiny" /><p><strong>{comment.authorName}</strong> {comment.body}</p></div>)}<form onSubmit={reply}><input value={draft} maxLength={2000} onChange={(event) => setDraft(event.target.value)} placeholder="Write a thoughtful reply…" /><button type="submit" disabled={!draft.trim()} aria-label="Send reply"><Send size={14} /></button></form></div>}
      <ErrorState error={error} />
    </article>
  );
}

export default function CommunityPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [topic, setTopic] = useState("All topics");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [newTopic, setNewTopic] = useState("Teamwork");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await get("/community");
      setPosts(result.posts);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    get("/community")
      .then(({ posts: result }) => { if (active) { setPosts(result); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createDiscussion(event) {
    event.preventDefault();
    try {
      const { post: created } = await post("/community", { title, body, topic: newTopic });
      setPosts((current) => [created, ...current]);
      setTitle("");
      setBody("");
      setShowForm(false);
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function likeDiscussion(discussion) {
    try {
      const result = await post(`/community/${discussion.id}/like`, {});
      setPosts((current) => current.map((item) => item.id === discussion.id
        ? { ...item, likedByMe: result.liked, likes: result.likes }
        : item));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function replyToDiscussion(id, reply) {
    const result = await post(`/community/${id}/comments`, { body: reply });
    setPosts((current) => current.map((item) => item.id === id ? { ...item, comments: item.comments + 1 } : item));
    return result.comment;
  }

  const visiblePosts = posts.filter((item) => topic === "All topics" || item.topic === topic);
  if (loading) return <div className="page-content"><LoadingState label="Loading the community…" /></div>;

  return (
    <div className="page-content section-page community-page">
      <PageHeading eyebrow="BETTER, TOGETHER" title="Community" description="Share what you're learning. Find your next great idea." actions={<button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Start a discussion</button>} />
      <ErrorState error={error} onRetry={refresh} />
      <div className="community-welcome panel"><span className="community-welcome-icon"><UsersRound size={20} /></span><div><strong>A space for the people behind the projects.</strong><p>Ask a question, share a small win, or swap ideas with your DevSphere community.</p></div><span className="community-member">{posts.length} conversations</span></div>
      <div className="community-topic-tabs" role="tablist" aria-label="Filter discussion topics">{topics.map((item) => <button role="tab" aria-selected={topic === item} key={item} className={topic === item ? "active" : ""} onClick={() => setTopic(item)}>{item}</button>)}</div>
      <div className="community-feed">{visiblePosts.map((discussion) => <DiscussionCard key={discussion.id} post={discussion} onLike={likeDiscussion} onReply={replyToDiscussion} />)}{!visiblePosts.length && <div className="panel empty-panel"><h2>No conversations in this topic yet.</h2><p>Start one and give the community something to think about.</p><button className="button button-primary" onClick={() => setShowForm(true)}>Start a discussion</button></div>}</div>
      {showForm && <Dialog eyebrow={`SHARE WITH THE COMMUNITY${user ? ` · ${user.name.toUpperCase()}` : ""}`} title="Start a discussion" onClose={() => setShowForm(false)}><form onSubmit={createDiscussion}><label className="settings-label">Topic<select value={newTopic} onChange={(event) => setNewTopic(event.target.value)}>{topics.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="settings-label">Title<input autoFocus required maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What would you like to talk about?" /></label><label className="settings-label">Your post<textarea required maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Give people enough context to join in…" rows={5} /></label><div className="modal-footer"><span>Keep it kind and constructive.</span><button className="button button-primary" type="submit" disabled={!title.trim() || !body.trim()}><Plus size={15} /> Publish</button></div></form></Dialog>}
    </div>
  );
}
