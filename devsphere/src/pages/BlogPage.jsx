import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpenText, Search, Sparkles } from "lucide-react";
import { get, post } from "../api/http.js";
import Dialog from "../components/ui/Dialog.jsx";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const categories = ["All stories", "Product", "Industry", "Changelog", "News"];

function BlogCard({ article, onOpen }) {
  return (
    <button className="blog-card panel" onClick={() => onOpen(article)}>
      <span className={`blog-category blog-category-${article.category.toLowerCase().replace(/[^a-z]+/g, "-")}`}>{article.category}</span>
      <h2>{article.title}</h2>
      <p>{article.excerpt}</p>
      <span className="blog-card-footer"><span>{article.author}</span><time>{new Date(article.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</time><ArrowRight size={15} /></span>
    </button>
  );
}

export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [category, setCategory] = useState("All stories");
  const [search, setSearch] = useState("");
  const [selectedPost, setSelectedPost] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [draft, setDraft] = useState({ title: "", excerpt: "", body: "", category: "Product" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (searchTerm = "", selectedCategory = "All stories") => {
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedCategory !== "All stories") params.set("category", selectedCategory);
      const result = await get(`/blog?${params}`);
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
    get("/blog")
      .then(({ posts: result }) => { if (active) { setPosts(result); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function publish(event) {
    event.preventDefault();
    try {
      const { post: article } = await post("/blog", draft);
      setPosts((current) => [article, ...current]);
      setShowCompose(false);
      setDraft({ title: "", excerpt: "", body: "", category: "Product" });
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) return <div className="page-content"><LoadingState label="Loading the latest stories…" /></div>;

  if (selectedPost) return (
    <article className="page-content section-page article-page">
      <button className="article-back" onClick={() => setSelectedPost(null)}><ArrowLeft size={15} /> All stories</button>
      <span className="blog-category">{selectedPost.category}</span>
      <h1>{selectedPost.title}</h1>
      <p className="article-excerpt">{selectedPost.excerpt}</p>
      <div className="article-byline"><span>{selectedPost.author}</span><span>{new Date(selectedPost.publishedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</span></div>
      <div className="article-body">{selectedPost.body.split(/\n{2,}/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
    </article>
  );

  return (
    <div className="page-content section-page blog-page">
      <PageHeading eyebrow="FROM THE DEVSHPERE DESK" title="Blog & news" description="Product news, thoughtful ideas, and stories from our community." actions={<button className="button button-primary" onClick={() => setShowCompose(true)}><BookOpenText size={15} /> Write a story</button>} />
      <div className="blog-feature panel"><div className="blog-feature-art"><span className="brand-symbol"><span /><span /><span /><span /></span><Sparkles size={25} /></div><div><span className="eyebrow">A NOTE FROM OUR TEAM</span><h2>Building a better home for great work.</h2><p>Follow product updates, stories from the world of technology, and ideas from the people building together.</p></div></div>
      <form className="blog-controls" onSubmit={(event) => { event.preventDefault(); refresh(search, category); }}><div className="blog-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stories…" /><button type="submit">Search</button></div><div className="blog-category-tabs">{categories.map((item) => <button type="button" className={category === item ? "active" : ""} onClick={() => { setCategory(item); refresh(search, item); }} key={item}>{item}</button>)}</div></form>
      <ErrorState error={error} onRetry={() => refresh(search, category)} />
      <div className="blog-grid">{posts.map((article) => <BlogCard key={article.id} article={article} onOpen={setSelectedPost} />)}{!posts.length && <div className="panel empty-panel"><h2>No stories found.</h2><p>Try a different search or category.</p></div>}</div>
      {showCompose && <Dialog eyebrow="SHARE AN UPDATE" title="Write a story" onClose={() => setShowCompose(false)}><form onSubmit={publish}><label className="settings-label">Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>{categories.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="settings-label">Title<input required maxLength={180} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label className="settings-label">Summary<input required maxLength={320} value={draft.excerpt} onChange={(event) => setDraft({ ...draft, excerpt: event.target.value })} /></label><label className="settings-label">Story<textarea required maxLength={20000} rows={7} value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} /></label><div className="modal-footer"><span>Published to your workspace blog.</span><button className="button button-primary" type="submit">Publish story <ArrowRight size={14} /></button></div></form></Dialog>}
    </div>
  );
}
