import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownToLine, ArrowLeft, Code2, File, FilePlus2, Folder, FolderPlus, Trash2, Upload } from "lucide-react";
import { get, getToken, post, remove, uploadFile } from "../api/http.js";
import PageHeading from "../components/ui/PageHeading.jsx";
import { ErrorState, LoadingState } from "../components/ui/AsyncState.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";
const selectedFileKey = "devsphere-code-file-id";
const codeExtensions = new Set([
  "c", "cpp", "cs", "css", "go", "h", "htm", "html", "java", "js", "json",
  "jsx", "md", "php", "py", "rb", "rs", "sh", "sql", "ts", "tsx", "txt", "xml", "yaml", "yml",
]);

function formatSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 ** 3) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 ** 3)).toFixed(1)} GB`;
}

function isEditableFile(file) {
  const extension = String(file.name || "").split(".").pop()?.toLowerCase();
  return Boolean(extension && codeExtensions.has(extension));
}

export default function FilesPage({ onNavigate }) {
  const [files, setFiles] = useState([]);
  const [workspaceUsage, setWorkspaceUsage] = useState(null);
  const [folderStack, setFolderStack] = useState([]);
  const [folderName, setFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploadInput = useRef(null);

  const activeFolder = folderStack.at(-1)?.id || null;
  const currentItems = useMemo(() => files.filter((file) => file.parentId === activeFolder), [files, activeFolder]);

  const refetch = useCallback(async () => {
    try {
      const [fileResponse, usageResponse] = await Promise.all([
        get("/files"),
        get("/workspace/usage"),
      ]);
      const result = fileResponse.files;
      setFiles(result);
      setWorkspaceUsage(usageResponse);
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

  async function createFolder(event) {
    event.preventDefault();
    if (!folderName.trim() || busy) return;

    setBusy(true);
    try {
      const { file } = await post("/files/folders", { name: folderName, parentId: activeFolder });
      setFiles((current) => [...current, file]);
      setFolderName("");
      setCreatingFolder(false);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const { file: saved } = await uploadFile("/files/upload", file, { parentId: activeFolder });
      setFiles((current) => [...current, saved]);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  async function download(file) {
    setBusy(true);
    try {
      const token = getToken();
      const response = await fetch(`${API_BASE}/files/${file.id}/download`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "The file could not be downloaded.");
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  function openInCodeStudio(file) {
    window.sessionStorage.setItem(selectedFileKey, String(file.id));
    onNavigate("Code studio");
  }

  async function deleteItem(file) {
    if (!window.confirm(`Delete ${file.kind === "folder" ? "folder and its contents" : "file"} "${file.name}"?`)) {
      return;
    }

    try {
      await remove(`/files/${file.id}`);
      const removeIds = new Set([file.id]);
      let changed = true;

      while (changed) {
        changed = false;
        for (const item of files) {
          if (removeIds.has(item.parentId) && !removeIds.has(item.id)) {
            removeIds.add(item.id);
            changed = true;
          }
        }
      }

      setFiles((current) => current.filter((item) => !removeIds.has(item.id)));
      setFolderStack((current) => current.filter((folder) => !removeIds.has(folder.id)));
      setError("");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (loading) {
    return <div className="page-content"><LoadingState label="Loading your files..." /></div>;
  }

  return (
    <div className="page-content section-page files-page">
      <PageHeading
        eyebrow="YOUR WORKSPACE"
        title="Files & folders"
        description="Keep project documents, study materials, and shared resources organized."
        actions={(
          <>
            <button className="button button-secondary" type="button" onClick={() => setCreatingFolder((value) => !value)}>
              <FolderPlus size={15} /> New folder
            </button>
            <button className="button button-primary" type="button" disabled={busy} onClick={() => uploadInput.current?.click()}>
              <Upload size={15} /> Upload file
            </button>
            <input
              ref={uploadInput}
              type="file"
              hidden
              accept=".pdf,.txt,.md,.csv,.docx,.xlsx,.pptx,.png,.jpg,.jpeg,.webp,.c,.cpp,.cs,.css,.go,.h,.htm,.html,.java,.js,.json,.jsx,.php,.py,.rb,.rs,.sh,.sql,.ts,.tsx,.xml,.yaml,.yml"
              onChange={upload}
            />
          </>
        )}
      />

      <ErrorState error={error} onRetry={refetch} />

      <div className="file-breadcrumbs">
        <button type="button" onClick={() => setFolderStack([])}>My files</button>
        {folderStack.map((folder, index) => (
          <span key={folder.id}>
            <span>/</span>
            <button type="button" onClick={() => setFolderStack((current) => current.slice(0, index + 1))}>{folder.name}</button>
          </span>
        ))}
      </div>

      {workspaceUsage?.plan && workspaceUsage.usage && workspaceUsage.limits && (
        <section className="file-quota panel" aria-label="Workspace storage and file limits">
          <div className="file-quota-heading">
            <strong>{workspaceUsage.plan.name} storage</strong>
            <span>{formatSize(workspaceUsage.usage.storageBytes)} of {formatSize(workspaceUsage.limits.storageBytes)}</span>
          </div>
          <div className="storage-meter" role="progressbar" aria-label="Storage used"
            aria-valuenow={Math.min(100, Math.round((workspaceUsage.usage.storageBytes / workspaceUsage.limits.storageBytes) * 100))}
            aria-valuemin="0" aria-valuemax="100">
            <span style={{ width: `${Math.min(100, Math.round((workspaceUsage.usage.storageBytes / workspaceUsage.limits.storageBytes) * 100))}%` }} />
          </div>
          <p>
            {workspaceUsage.usage.files} / {workspaceUsage.limits.files} files
            {" · "}{workspaceUsage.usage.folders} / {workspaceUsage.limits.folders} folders
            {" · "}{formatSize(Math.max(0, workspaceUsage.limits.storageBytes - workspaceUsage.usage.storageBytes))} available
          </p>
        </section>
      )}

      {creatingFolder && (
        <form className="file-folder-form panel" onSubmit={createFolder}>
          <label className="settings-label">
            Folder name
            <input autoFocus maxLength={120} value={folderName} onChange={(event) => setFolderName(event.target.value)} placeholder="e.g. Research notes" />
          </label>
          <button className="button button-primary" type="submit" disabled={busy || !folderName.trim()}>
            <FolderPlus size={14} /> Create folder
          </button>
        </form>
      )}

      <div className="file-list panel">
        <div className="file-list-heading">
          <span>Name</span>
          <span>Type</span>
          <span>Size</span>
          <span>Actions</span>
        </div>

        {folderStack.length > 0 && (
          <button className="file-row file-parent-row" type="button" onClick={() => setFolderStack((current) => current.slice(0, -1))}>
            <ArrowLeft size={17} />
            <strong>Back to parent folder</strong>
          </button>
        )}

        {currentItems.map((file) => (
          <div className="file-row" key={file.id}>
            {file.kind === "folder" ? (
              <button className="file-name-button" type="button" onClick={() => setFolderStack((current) => [...current, { id: file.id, name: file.name }])}>
                <Folder size={18} />
                <strong>{file.name}</strong>
              </button>
            ) : (
              <span className="file-name">
                <File size={18} />
                <strong>{file.name}</strong>
              </span>
            )}
            <span>{file.kind === "folder" ? "Folder" : file.mimeType || "File"}</span>
            <span>{file.kind === "folder" ? "-" : formatSize(file.sizeBytes)}</span>
            <span className="file-row-actions">
              {file.kind === "file" && (
                <>
                  {isEditableFile(file) && (
                    <button className="icon-button" type="button" aria-label={`Open ${file.name} in Code Studio`} onClick={() => openInCodeStudio(file)}>
                      <Code2 size={16} />
                    </button>
                  )}
                  <button className="icon-button" type="button" aria-label={`Download ${file.name}`} disabled={busy} onClick={() => download(file)}>
                    <ArrowDownToLine size={16} />
                  </button>
                </>
              )}
              <button className="icon-button file-delete-button" type="button" aria-label={`Delete ${file.name}`} onClick={() => deleteItem(file)}>
                <Trash2 size={15} />
              </button>
            </span>
          </div>
        ))}

        {!currentItems.length && (
          <div className="empty-panel">
            <FilePlus2 size={22} />
            <h3>This folder is empty.</h3>
            <p>Upload a document or create a new folder to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
