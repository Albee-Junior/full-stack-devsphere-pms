import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { config } from "../config.js";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { enforceCountLimit, ensureStorageAvailable, getWorkspacePlan } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken);
const codeExtensions = new Set([
  ".c", ".cpp", ".cs", ".css", ".go", ".h", ".htm", ".html", ".java", ".js", ".json",
  ".jsx", ".md", ".php", ".py", ".rb", ".rs", ".sh", ".sql", ".ts", ".tsx", ".txt",
  ".xml", ".yaml", ".yml",
]);
const allowedExtensions = new Set([
  ...codeExtensions, ".csv", ".docx", ".jpg", ".jpeg", ".pdf", ".png", ".pptx", ".webp", ".xlsx",
]);
const maxCodeBytes = 1024 * 1024;
const textMimeTypes = {
  ".css": "text/css",
  ".html": "text/html",
  ".htm": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".md": "text/markdown",
  ".sql": "application/sql",
  ".txt": "text/plain",
  ".ts": "text/plain",
  ".tsx": "text/plain",
  ".jsx": "text/plain",
};

function getCodeFileName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  const extension = path.extname(name).toLowerCase();
  if (!name || name.length > 180 || name !== path.basename(name) || /[\\/]/.test(name) || !codeExtensions.has(extension)) {
    throw httpError(400, "Use a filename with a supported code or text extension.");
  }
  return name;
}

async function validateParentFolder(parentId, workspaceId) {
  if (!parentId) return null;
  const id = validateId(parentId, "Parent folder ID");
  const parent = await db.prepare(
    "SELECT id FROM workspace_files WHERE id = ? AND workspace_id = ? AND kind = 'folder'",
  ).get(id, workspaceId);
  if (!parent) throw httpError(400, "Choose a folder in your workspace.");
  return id;
}

function ensureStoredPath(storagePath) {
  const relativePath = path.relative(config.uploadDirectory, storagePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw httpError(403, "File access is not allowed.");
  }
}
const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await fs.mkdir(config.uploadDirectory, { recursive: true });
      callback(null, config.uploadDirectory);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedExtensions.has(path.extname(file.originalname).toLowerCase())) {
      return callback(httpError(400, "Upload a supported document, image, CSV, or code/text file."));
    }
    return callback(null, true);
  },
});

router.get("/", async (req, res) => {
  const files = await db.prepare(`
    SELECT id, parent_id AS "parentId", name, kind, mime_type AS "mimeType",
      size_bytes AS "sizeBytes", created_at AS "createdAt"
    FROM workspace_files WHERE workspace_id = ? ORDER BY kind DESC, name
  `).all(req.user.workspaceId);
  res.json({ files });
});

router.post("/folders", async (req, res) => {
  const name = requireText(req.body?.name, "Folder name", 120);
  const parentId = await validateParentFolder(req.body?.parentId, req.user.workspaceId);
  const plan = await getWorkspacePlan(req.user.workspaceId);
  await enforceCountLimit(req.user.workspaceId, "workspace_files", "kind", plan.maxFolders, "folder");
  const result = await db.prepare(
    "INSERT INTO workspace_files (workspace_id, parent_id, name, kind, created_by) VALUES (?, ?, ?, 'folder', ?)",
  ).run(req.user.workspaceId, parentId, name, req.user.id);
  const folder = await db.prepare(`
    SELECT id, parent_id AS "parentId", name, kind, NULL AS "mimeType",
      0 AS "sizeBytes", created_at AS "createdAt" FROM workspace_files WHERE id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json({ file: folder });
});

router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) throw httpError(400, "Choose a file to upload.");
  let parentId;
  try {
    parentId = await validateParentFolder(req.body.parentId, req.user.workspaceId);
  } catch (error) {
    await fs.unlink(req.file.path);
    throw error;
  }
  const name = path.basename(req.file.originalname).slice(0, 180);
  try {
    const plan = await getWorkspacePlan(req.user.workspaceId);
    await enforceCountLimit(req.user.workspaceId, "workspace_files", "kind", plan.maxFiles, "file");
    await ensureStorageAvailable(req.user.workspaceId, req.file.size);
    const result = await db.prepare(`
      INSERT INTO workspace_files (workspace_id, parent_id, name, kind, mime_type, size_bytes, storage_path, created_by)
      VALUES (?, ?, ?, 'file', ?, ?, ?, ?)
    `).run(req.user.workspaceId, parentId, name, req.file.mimetype, req.file.size, req.file.path, req.user.id);
    const file = await db.prepare(`
      SELECT id, parent_id AS "parentId", name, kind, mime_type AS "mimeType",
        size_bytes AS "sizeBytes", created_at AS "createdAt" FROM workspace_files WHERE id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({ file });
  } catch (error) {
    await fs.unlink(req.file.path).catch((cleanupError) => {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    });
    throw error;
  }
});

router.post("/code", async (req, res) => {
  const name = getCodeFileName(req.body?.name);
  const content = req.body?.content;
  if (typeof content !== "string") throw httpError(400, "File content must be text.");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (sizeBytes > maxCodeBytes) throw httpError(413, "Code files must be 1 MB or smaller.");
  const parentId = await validateParentFolder(req.body?.parentId, req.user.workspaceId);
  const plan = await getWorkspacePlan(req.user.workspaceId);
  await enforceCountLimit(req.user.workspaceId, "workspace_files", "kind", plan.maxFiles, "file");
  await ensureStorageAvailable(req.user.workspaceId, sizeBytes);
  await fs.mkdir(config.uploadDirectory, { recursive: true });
  const extension = path.extname(name).toLowerCase();
  const storagePath = path.join(config.uploadDirectory, `${randomUUID()}${extension}`);
  await fs.writeFile(storagePath, content, "utf8");
  try {
    const result = await db.prepare(`
      INSERT INTO workspace_files (workspace_id, parent_id, name, kind, mime_type, size_bytes, storage_path, created_by)
      VALUES (?, ?, ?, 'file', ?, ?, ?, ?)
    `).run(
      req.user.workspaceId, parentId, name, textMimeTypes[extension] || "text/plain",
      sizeBytes, storagePath, req.user.id,
    );
    const file = await db.prepare(`
      SELECT id, parent_id AS "parentId", name, kind, mime_type AS "mimeType",
        size_bytes AS "sizeBytes", created_at AS "createdAt" FROM workspace_files WHERE id = ?
    `).get(result.lastInsertRowid);
    res.status(201).json({ file });
  } catch (error) {
    await fs.unlink(storagePath).catch((cleanupError) => {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    });
    throw error;
  }
});

router.get("/:id/content", async (req, res) => {
  const id = validateId(req.params.id, "File ID");
  const file = await db.prepare(`
    SELECT id, name, mime_type AS "mimeType", size_bytes AS "sizeBytes", storage_path AS "storagePath"
    FROM workspace_files WHERE id = ? AND workspace_id = ? AND kind = 'file'
  `).get(id, req.user.workspaceId);
  if (!file || !file.storagePath) throw httpError(404, "File not found.");
  if (!codeExtensions.has(path.extname(file.name).toLowerCase())) {
    throw httpError(415, "This file type cannot be opened in Code Studio.");
  }
  ensureStoredPath(file.storagePath);
  const stats = await fs.stat(file.storagePath).catch((error) => {
    if (error.code === "ENOENT") throw httpError(404, "File content is unavailable.");
    throw error;
  });
  if (stats.size > maxCodeBytes) throw httpError(413, "This file is too large to open in Code Studio.");
  const content = await fs.readFile(file.storagePath, "utf8");
  res.json({ file: { id: file.id, name: file.name, mimeType: file.mimeType, sizeBytes: file.sizeBytes, content } });
});

router.put("/:id/content", async (req, res) => {
  const id = validateId(req.params.id, "File ID");
  const name = getCodeFileName(req.body?.name);
  const content = req.body?.content;
  if (typeof content !== "string") throw httpError(400, "File content must be text.");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  if (sizeBytes > maxCodeBytes) throw httpError(413, "Code files must be 1 MB or smaller.");
  const existing = await db.prepare(`
    SELECT storage_path AS "storagePath" FROM workspace_files
    WHERE id = ? AND workspace_id = ? AND kind = 'file'
  `).get(id, req.user.workspaceId);
  if (!existing?.storagePath) throw httpError(404, "File not found.");
  await ensureStorageAvailable(req.user.workspaceId, sizeBytes, id);
  ensureStoredPath(existing.storagePath);
  await fs.mkdir(config.uploadDirectory, { recursive: true });
  const extension = path.extname(name).toLowerCase();
  const storagePath = path.join(config.uploadDirectory, `${randomUUID()}${extension}`);
  await fs.writeFile(storagePath, content, "utf8");
  try {
    await db.prepare(`
      UPDATE workspace_files SET name = ?, mime_type = ?, size_bytes = ?, storage_path = ?
      WHERE id = ? AND workspace_id = ? AND kind = 'file'
    `).run(name, textMimeTypes[extension] || "text/plain", sizeBytes, storagePath, id, req.user.workspaceId);
  } catch (error) {
    await fs.unlink(storagePath).catch((cleanupError) => {
      if (cleanupError.code !== "ENOENT") throw cleanupError;
    });
    throw error;
  }
  await fs.unlink(existing.storagePath).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  });
  const file = await db.prepare(`
    SELECT id, parent_id AS "parentId", name, kind, mime_type AS "mimeType",
      size_bytes AS "sizeBytes", created_at AS "createdAt" FROM workspace_files WHERE id = ?
  `).get(id);
  res.json({ file });
});

router.get("/:id/download", async (req, res, next) => {
  const id = validateId(req.params.id, "File ID");
  const file = await db.prepare(`
    SELECT DISTINCT f.name, f.kind, f.storage_path AS "storagePath" FROM workspace_files f
    LEFT JOIN resources r ON r.file_id = f.id
    LEFT JOIN resource_sales s ON s.resource_id = r.id AND s.buyer_id = ?
    WHERE f.id = ? AND (f.workspace_id = ? OR s.buyer_id IS NOT NULL)
  `).get(req.user.id, id, req.user.workspaceId);
  if (!file || file.kind !== "file" || !file.storagePath) throw httpError(404, "File not found.");
  ensureStoredPath(file.storagePath);
  res.download(file.storagePath, file.name, (error) => { if (error) next(error); });
});

router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id, "File or folder ID");
  const entry = await db.prepare("SELECT id, kind FROM workspace_files WHERE id = ? AND workspace_id = ?").get(id, req.user.workspaceId);
  if (!entry) throw httpError(404, "File or folder not found.");
  const paths = await db.prepare(`
    WITH RECURSIVE tree(id) AS (
      SELECT id FROM workspace_files WHERE id = ? AND workspace_id = ?
      UNION ALL SELECT child.id FROM workspace_files child JOIN tree parent ON child.parent_id = parent.id
      WHERE child.workspace_id = ?
    )
    SELECT storage_path AS "storagePath" FROM workspace_files
    WHERE id IN (SELECT id FROM tree) AND storage_path IS NOT NULL
  `).all(id, req.user.workspaceId, req.user.workspaceId);
  for (const { storagePath } of paths) {
    await fs.unlink(storagePath).catch((error) => {
      if (error.code !== "ENOENT") throw error;
    });
  }
  await db.prepare("DELETE FROM workspace_files WHERE id = ? AND workspace_id = ?").run(id, req.user.workspaceId);
  res.status(204).end();
});

export default router;
