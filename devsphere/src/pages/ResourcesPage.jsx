import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownToLine, BookOpen, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { get, getToken, post, remove, uploadFile } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import Dialog from "../components/ui/Dialog.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const categories = ["Templates", "Study guides", "Business", "Design", "Engineering", "Research", "Other"];
const apiBase = import.meta.env.VITE_API_BASE || "/api";

export default function ResourcesPage() {
  const [resources, setResources] = useState([]);
  const [files, setFiles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Templates");
  const [price, setPrice] = useState("0");
  const [currency, setCurrency] = useState("USD");
  const [fileId, setFileId] = useState("");
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploadInput = useRef(null);

  const refetch = useCallback(async () => {
    try {
      const [resourceResult, fileResult] = await Promise.all([get("/resources"), get("/files")]);
      setResources(resourceResult.resources);
      setFiles(fileResult.files.filter((file) => file.kind === "file"));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refetch(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refetch]);

  async function uploadResourceFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const { file: saved } = await uploadFile("/files/upload", file);
      setFiles((current) => [...current, saved]);
      setFileId(String(saved.id));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function publish(event) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const { resource } = await post("/resources", {
        title,
        description,
        category,
        price: Number(price),
        currency,
        fileId: fileId || null,
      });
      setResources((current) => [resource, ...current]);
      setShowForm(false);
      setTitle("");
      setDescription("");
      setPrice("0");
      setFileId("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function purchase(resource) {
    setBusy(true);
    setError("");

    try {
      const { checkoutUrl } = await post(`/resources/${resource.id}/checkout`, {});
      window.location.assign(checkoutUrl);
    } catch (requestError) {
      setError(requestError.message);
      setBusy(false);
    }
  }

  async function download(resource) {
    if (!resource.fileId) {
      setError("This listing does not have a downloadable file yet.");
      return;
    }

    try {
      const token = getToken();
      const response = await fetch(`${apiBase}/files/${resource.fileId}/download`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!response.ok) {
        throw new Error("You need to purchase this resource before downloading it.");
      }

      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = resource.title;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteResource(resource) {
    if (!window.confirm(`Remove "${resource.title}" from the marketplace?`)) return;

    try {
      await remove(`/resources/${resource.id}`);
      setResources((current) => current.filter((item) => item.id !== resource.id));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) {
    return <div className="page-content"><LoadingState label="Loading the resource marketplace..." /></div>;
  }

  const visibleResources = filter === "All" ? resources : resources.filter((resource) => resource.category === filter);

  return (
    <div className="page-content section-page resource-page">
      <PageHeading
        eyebrow="LEARN, SHARE, EARN"
        title="Resource marketplace"
        description="Find practical templates, study guides, and professional resources."
        actions={<button className="button button-primary" type="button" onClick={() => setShowForm(true)}><Plus size={15} /> List a resource</button>}
      />

      <ErrorState error={error} />

      <div className="resource-intro panel">
        <ShoppingBag size={21} />
        <div>
          <strong>Built for every kind of work.</strong>
          <p>Students, educators, freelancers, and teams can share practical materials. Sellers can choose USD or GHS pricing.</p>
        </div>
      </div>

      <div className="resource-filters" aria-label="Filter resources">
        <button type="button" className={filter === "All" ? "active" : ""} onClick={() => setFilter("All")}>All resources</button>
        {categories.map((item) => (
          <button key={item} type="button" className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>
        ))}
      </div>

      <div className="resource-grid">
        {visibleResources.map((resource) => (
          <article className="resource-card panel" key={resource.id}>
            <span className="resource-category"><BookOpen size={13} />{resource.category}</span>
            <h3>{resource.title}</h3>
            <p>{resource.description}</p>
            <div className="resource-card-footer">
              <span>By {resource.creatorName}</span>
              <strong>{resource.priceCents ? new Intl.NumberFormat(undefined, { style: "currency", currency: resource.currency.toUpperCase() }).format(resource.priceCents / 100) : "Free"}</strong>
            </div>
            <div className="resource-card-actions">
              {resource.mine ? (
                <button className="button button-secondary" type="button" onClick={() => deleteResource(resource)}>
                  <Trash2 size={14} /> Remove
                </button>
              ) : resource.purchased || Number(resource.priceCents) === 0 ? (
                <button className="button button-primary" type="button" onClick={() => download(resource)} disabled={!resource.fileId}>
                  <ArrowDownToLine size={14} /> Download
                </button>
              ) : (
                <button className="button button-primary" type="button" disabled={busy} onClick={() => purchase(resource)}>
                  <ShoppingBag size={14} /> Purchase
                </button>
              )}
            </div>
          </article>
        ))}

        {!visibleResources.length && (
          <div className="panel empty-panel resource-empty">
            <BookOpen size={22} />
            <h3>No resources in this category yet.</h3>
            <p>Share a template or guide to help the community get started.</p>
            <button className="button button-primary" type="button" onClick={() => setShowForm(true)}>
              <Plus size={14} /> List a resource
            </button>
          </div>
        )}
      </div>

      {showForm && (
        <Dialog eyebrow="SHARE YOUR WORK" title="List a resource" onClose={() => setShowForm(false)}>
          <form className="resource-form" onSubmit={publish}>
            <label className="settings-label">
              Title
              <input maxLength={140} required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Project kickoff template" />
            </label>

            <label className="settings-label">
              Description
              <textarea required maxLength={1200} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is included and who will it help?" />
            </label>

            <div className="resource-form-row">
              <label className="settings-label">
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <label className="settings-label">
                Price
                <input min="0" max="10000" step="0.01" type="number" value={price} onChange={(event) => setPrice(event.target.value)} />
              </label>
            </div>

            <div className="resource-form-row">
              <label className="settings-label">
                Currency
                <select value={currency} onChange={(event) => setCurrency(event.target.value)}>
                  <option value="USD">USD</option>
                  <option value="GHS">GHS</option>
                </select>
              </label>

              <label className="settings-label">
                Attach file
                <select value={fileId} onChange={(event) => setFileId(event.target.value)}>
                  <option value="">No file</option>
                  {files.map((file) => <option key={file.id} value={file.id}>{file.name}</option>)}
                </select>
              </label>
            </div>

            <div className="resource-upload-row">
              <button className="button button-secondary" type="button" onClick={() => uploadInput.current?.click()}>Upload resource file</button>
              <input ref={uploadInput} type="file" hidden onChange={uploadResourceFile} />
            </div>

            <div className="panel-footer actions-row">
              <button className="button button-secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="button button-primary" type="submit" disabled={busy || !title.trim() || !description.trim()}>
                <Plus size={14} /> Publish resource
              </button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}
