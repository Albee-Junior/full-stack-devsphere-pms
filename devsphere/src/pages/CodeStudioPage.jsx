import { useEffect, useState } from "react";
import { Check, Code2, ExternalLink, Eye, FileCode2, GitBranch, Play, Save } from "lucide-react";
import { get, post, put } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const starter = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>My DevSphere preview</title>
    <style>
      body { font: 16px system-ui, sans-serif; margin: 3rem auto; max-width: 42rem; padding: 0 1rem; }
      button { background: #6d5bd0; border: 0; border-radius: 8px; color: white; cursor: pointer; padding: 0.7rem 1rem; }
    </style>
  </head>
  <body>
    <h1>Hello, DevSphere</h1>
    <p>Edit this HTML, save it to Files, and run a preview.</p>
    <button onclick="this.textContent = 'It works!'">Try me</button>
  </body>
</html>`;
const selectedFileKey = "devsphere-code-file-id";
const languageByExtension = {
  c: "C",
  cpp: "C++",
  css: "CSS",
  go: "Go",
  htm: "HTML",
  html: "HTML",
  java: "Java",
  js: "JavaScript",
  json: "JSON",
  jsx: "JavaScript JSX",
  md: "Markdown",
  py: "Python",
  rb: "Ruby",
  rs: "Rust",
  sql: "SQL",
  ts: "TypeScript",
  tsx: "TypeScript JSX",
  txt: "Plain text",
};

function languageFor(filename) {
  return languageByExtension[filename.split(".").pop().toLowerCase()] || "Source";
}

export default function CodeStudioPage() {
  const [document, setDocument] = useState({ filename: "index.html", content: starter });
  const [savedFile, setSavedFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingDraft, setSavingDraft] = useState(false);
  const [savingFile, setSavingFile] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewContent, setPreviewContent] = useState("");

  useEffect(() => {
    let active = true;
    const selectedFileId = window.sessionStorage.getItem(selectedFileKey);
    window.sessionStorage.removeItem(selectedFileKey);
    const loadDocument = selectedFileId
      ? get(`/files/${encodeURIComponent(selectedFileId)}/content`).then(({ file }) => {
        if (active) {
          setDocument({ filename: file.name, content: file.content });
          setSavedFile({ id: file.id, name: file.name });
        }
      })
      : get("/workspace/features/code").then(({ value }) => {
        if (active && value) setDocument(value);
      });

    loadDocument
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading || !dirty) return undefined;
    const timer = window.setTimeout(async () => {
      setSavingDraft(true);
      try {
        await put("/workspace/features/code", { value: document });
        setDirty(false);
        setError("");
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setSavingDraft(false);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [document, dirty, loading]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function updateDocument(updates) {
    setDocument((current) => ({ ...current, ...updates }));
    setDirty(true);
    setSaveMessage("");
  }

  async function saveFile() {
    if (savingFile) return;
    setSavingFile(true);
    setError("");
    setSaveMessage("");
    try {
      const fileContent = { name: document.filename, content: document.content };
      const result = savedFile
        ? await put(`/files/${encodeURIComponent(savedFile.id)}/content`, fileContent)
        : await post("/files/code", fileContent);
      setSavedFile({ id: result.file.id, name: result.file.name });
      setDocument((current) => ({ ...current, filename: result.file.name }));
      setSaveMessage(`${result.file.name} saved to Files & folders.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingFile(false);
    }
  }

  function runPreview() {
    if (!["html", "htm"].includes(document.filename.split(".").pop().toLowerCase())) {
      setError("Live preview is available for .html and .htm files. Save code files to Files & folders to keep them.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewContent(document.content);
    setPreviewUrl(URL.createObjectURL(new Blob([document.content], { type: "text/html" })));
    setError("");
  }

  if (loading) return <div className="page-content"><LoadingState label="Opening your code workspace…" /></div>;
  const lines = document.content.split("\n");
  const canPreview = ["html", "htm"].includes(document.filename.split(".").pop().toLowerCase());

  return (
    <div className="page-content section-page code-studio-page">
      <PageHeading
        eyebrow="BUILD TOGETHER"
        title="Code studio"
        description="Edit source files, save them in your workspace, and safely preview HTML."
        actions={(
          <div className="code-page-actions">
            <span className="collab-live"><i /> {savingDraft ? "Syncing draft…" : dirty ? "Draft changes" : "Draft synced"}</span>
            <button className="button button-primary" type="button" disabled={savingFile} onClick={saveFile}>
              <Save size={15} /> {savingFile ? "Saving file…" : "Save to files"}
            </button>
          </div>
        )}
      />
      <ErrorState error={error} />
      {saveMessage && <div className="code-save-message" role="status"><Check size={15} />{saveMessage}</div>}
      <section className="code-workspace panel">
        <aside className="code-files">
          <div className="code-files-heading"><span>EXPLORER</span><Code2 size={15} /></div>
          <div className="code-project-name"><GitBranch size={13} /> WORKSPACE</div>
          <div className="code-folder"><span>▾</span> Files & folders</div>
          <div className="code-file active"><FileCode2 size={14} /> {document.filename}</div>
          <div className="code-share"><Save size={14} /><span>{savedFile ? `Saved file · ${savedFile.name}` : "Save to add this file to your workspace"}</span></div>
        </aside>
        <div className="editor-area">
          <div className="editor-tab">
            <FileCode2 size={14} />
            <input aria-label="File name" maxLength={180} value={document.filename} onChange={(event) => updateDocument({ filename: event.target.value })} />
            {dirty && <span className="editor-unsaved" aria-label="Unsaved draft changes" />}
            <span className="editor-branch"><GitBranch size={13} /> shared workspace</span>
          </div>
          <div className="editor-code-wrap">
            <div className="line-numbers" aria-hidden="true">{lines.map((_, index) => <span key={index}>{index + 1}</span>)}</div>
            <textarea className="code-editor" aria-label="Code editor" spellCheck="false" value={document.content} onChange={(event) => updateDocument({ content: event.target.value })} />
          </div>
          <div className="editor-statusbar">
            <span><GitBranch size={12} /> {savedFile ? "file saved" : "draft"}</span>
            <span>{languageFor(document.filename)}</span>
            <span>UTF-8</span>
            <button className="code-run-button" type="button" disabled={!canPreview} onClick={runPreview}>
              <Play size={12} /> Run preview
            </button>
          </div>
        </div>
      </section>
      {previewUrl && (
        <section className="code-preview panel" aria-labelledby="code-preview-title">
          <div className="code-preview-heading">
            <h2 id="code-preview-title"><Eye size={17} /> Live preview</h2>
            <a className="button button-secondary" href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Open preview link</a>
          </div>
          <iframe
            title="HTML code preview"
            className="code-preview-frame"
            sandbox="allow-scripts"
            srcDoc={previewContent}
          />
        </section>
      )}
      <p className="code-disclaimer">
        Save creates a downloadable file in Files & folders. HTML previews run in an isolated frame; other source files can be edited and downloaded but are not executed on the server.
      </p>
    </div>
  );
}
