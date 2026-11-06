import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { createCheckout } from "../services/payments.js";

const router = Router();
router.use(authenticateToken);
const categories = ["Templates", "Study guides", "Business", "Design", "Engineering", "Research", "Other"];

router.get("/", async (req, res) => {
  const resources = await db.prepare(`
    SELECT r.id, r.title, r.description, r.category, r.price_cents AS "priceCents",
      r.currency, r.file_id AS "fileId", r.created_at AS "createdAt",
      u.name AS "creatorName", r.workspace_id = $1 AS "mine",
      EXISTS(SELECT 1 FROM resource_sales s WHERE s.resource_id = r.id AND s.buyer_id = $2) AS purchased
    FROM resources r JOIN users u ON u.id = r.creator_id
    ORDER BY r.created_at DESC LIMIT 200
  `).all(req.user.workspaceId, req.user.id);
  res.json({ resources });
});

router.post("/", async (req, res) => {
  const title = requireText(req.body?.title, "Resource title", 140);
  const description = requireText(req.body?.description, "Resource description", 1200);
  const category = categories.includes(req.body?.category) ? req.body.category : "Other";
  const price = Number(req.body?.price);
  if (!Number.isFinite(price) || price < 0 || price > 10000) throw httpError(400, "Enter a price between 0 and 10,000.");
  const currency = String(req.body?.currency || "USD").toUpperCase();
  if (!["USD", "GHS"].includes(currency)) throw httpError(400, "Choose USD or GHS.");
  const fileId = req.body?.fileId ? validateId(req.body.fileId, "File ID") : null;
  if (fileId && !await db.prepare("SELECT id FROM workspace_files WHERE id = ? AND workspace_id = ? AND kind = 'file'").get(fileId, req.user.workspaceId)) {
    throw httpError(400, "Choose a file in your workspace.");
  }
  const result = await db.prepare(`
    INSERT INTO resources (workspace_id, creator_id, title, description, category, price_cents, currency, file_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.workspaceId, req.user.id, title, description, category, Math.round(price * 100), currency.toLowerCase(), fileId);
  const resource = await db.prepare(`
    SELECT r.id, r.title, r.description, r.category, r.price_cents AS "priceCents",
      r.currency, r.file_id AS "fileId", r.created_at AS "createdAt", u.name AS "creatorName",
      TRUE AS mine, FALSE AS purchased
    FROM resources r JOIN users u ON u.id = r.creator_id WHERE r.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json({ resource });
});

router.post("/:id/checkout", async (req, res) => {
  const id = validateId(req.params.id, "Resource ID");
  const resource = await db.prepare(`
    SELECT id, workspace_id AS "workspaceId", creator_id AS "creatorId",
      title, description, price_cents AS "priceCents", currency
    FROM resources WHERE id = ?
  `).get(id);
  if (!resource) throw httpError(404, "Resource not found.");
  if (resource.creatorId === req.user.id) throw httpError(400, "You cannot purchase your own resource.");
  const purchased = await db.prepare(
    "SELECT id FROM resource_sales WHERE resource_id = ? AND buyer_id = ?",
  ).get(id, req.user.id);
  if (purchased) throw httpError(409, "You already have access to this resource.");
  const checkout = await createCheckout({ user: req.user, currency: resource.currency, resource });
  res.status(201).json(checkout);
});

router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Resource ID");
  const result = await db.prepare("DELETE FROM resources WHERE id = ? AND workspace_id = ? AND creator_id = ?")
    .run(id, req.user.workspaceId, req.user.id);
  if (!result.changes) throw httpError(404, "Resource not found.");
  res.status(204).end();
});

export default router;
