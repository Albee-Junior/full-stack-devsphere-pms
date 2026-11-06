import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { requireFeature } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken, requireFeature("crm"));
const stages = ["Lead", "Qualified", "Proposal", "Customer", "Inactive"];

function contactInput(body, existing = {}) {
  const name = body.name === undefined ? existing.name : requireText(body.name, "Contact name", 120);
  const email = body.email === undefined ? existing.email : String(body.email || "").trim().toLowerCase();
  if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180)) {
    throw httpError(400, "Enter a valid contact email address.");
  }
  const stage = body.stage === undefined ? existing.stage || "Lead" : body.stage;
  if (!stages.includes(stage)) throw httpError(400, "Choose a valid CRM stage.");
  return {
    name,
    company: body.company === undefined ? existing.company || "" : String(body.company).trim().slice(0, 140),
    email,
    phone: body.phone === undefined ? existing.phone || "" : String(body.phone).trim().slice(0, 60),
    stage,
    notes: body.notes === undefined ? existing.notes || "" : String(body.notes).trim().slice(0, 3000),
  };
}

const selectContact = `
  SELECT id, name, company, email, phone, stage, notes,
    created_at AS "createdAt", updated_at AS "updatedAt"
  FROM crm_contacts
`;

router.get("/", async (req, res) => {
  const contacts = await db.prepare(`${selectContact} WHERE workspace_id = ? ORDER BY updated_at DESC, id DESC`)
    .all(req.user.workspaceId);
  res.json({ contacts, stages });
});

router.post("/", async (req, res) => {
  const contact = contactInput(req.body || {});
  const result = await db.prepare(`
    INSERT INTO crm_contacts (workspace_id, created_by, name, company, email, phone, stage, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.workspaceId, req.user.id, contact.name, contact.company, contact.email, contact.phone, contact.stage, contact.notes);
  const saved = await db.prepare(`${selectContact} WHERE id = ? AND workspace_id = ?`).get(result.lastInsertRowid, req.user.workspaceId);
  res.status(201).json({ contact: saved });
});

router.patch("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Contact ID");
  const existing = await db.prepare("SELECT * FROM crm_contacts WHERE id = ? AND workspace_id = ?").get(id, req.user.workspaceId);
  if (!existing) throw httpError(404, "Contact not found.");
  const contact = contactInput(req.body || {}, existing);
  await db.prepare(`
    UPDATE crm_contacts SET name = ?, company = ?, email = ?, phone = ?, stage = ?, notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND workspace_id = ?
  `).run(contact.name, contact.company, contact.email, contact.phone, contact.stage, contact.notes, id, req.user.workspaceId);
  const saved = await db.prepare(`${selectContact} WHERE id = ? AND workspace_id = ?`).get(id, req.user.workspaceId);
  res.json({ contact: saved });
});

router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Contact ID");
  const result = await db.prepare("DELETE FROM crm_contacts WHERE id = ? AND workspace_id = ?").run(id, req.user.workspaceId);
  if (!result.changes) throw httpError(404, "Contact not found.");
  res.status(204).end();
});

export default router;
