import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { requireFeature } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken);
router.use(requireFeature("contracts"));

const templates = {
  "Service agreement": [
    "SERVICE AGREEMENT",
    "Parties: {{provider}} and {{client}}",
    "Effective date: {{date}}",
    "",
    "1. Services and deliverables",
    "{{services}}",
    "",
    "2. Schedule",
    "{{schedule}}",
    "",
    "3. Fees and payment",
    "The client will pay {{fees}}. The parties will confirm any applicable taxes, invoicing dates, and late-payment terms in writing.",
    "",
    "4. Changes and acceptance",
    "Changes to scope or delivery dates should be agreed in writing. The client will review each deliverable and provide feedback within a mutually agreed period.",
    "",
    "5. Confidentiality and materials",
    "Each party will protect confidential information. Ownership and permitted use of pre-existing materials and new deliverables should be agreed in writing before work begins.",
    "",
    "6. Ending the engagement",
    "Either party may propose ending this engagement by giving written notice. The parties should agree on payment for completed work and the handover of materials.",
    "",
    "7. Governing law and signatures",
    "Specify applicable law and obtain qualified legal review before signing.",
    "",
    "Provider: ____________________    Client: ____________________",
    "",
    "DRAFT FOR DISCUSSION — This template is not legal advice. Have a qualified lawyer review it for your jurisdiction and situation.",
  ].join("\n"),
  "Freelance project": "FREELANCE PROJECT AGREEMENT\n\nClient: {{client}}\nFreelancer: {{provider}}\nDate: {{date}}\n\nPROJECT SCOPE\n{{services}}\n\nDELIVERABLES AND SCHEDULE\n{{schedule}}\n\nFEES\n{{fees}}\n\nThe parties should agree in writing on revisions, acceptance criteria, expenses, intellectual-property ownership, confidentiality, cancellation, and dispute resolution before work starts.\n\nDRAFT FOR DISCUSSION — This template is not legal advice. Have a qualified lawyer review it for your jurisdiction and situation.",
  "Tutoring agreement": "TUTORING SERVICES AGREEMENT\n\nTutor: {{provider}}\nStudent/client: {{client}}\nDate: {{date}}\n\nSUBJECT AND GOALS\n{{services}}\n\nSCHEDULE\n{{schedule}}\n\nFEES AND CANCELLATIONS\n{{fees}}\n\nThe parties should agree on safeguarding, privacy, cancellation notice, learning materials, and any guardian-consent requirements before sessions begin.\n\nDRAFT FOR DISCUSSION — This template is not legal advice. Have a qualified lawyer review it for your jurisdiction and situation.",
};

router.get("/", async (req, res) => {
  const contracts = await db.prepare(`
    SELECT id, title, client_name AS "clientName", contract_type AS "contractType",
      content, status, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM contracts WHERE workspace_id = ? ORDER BY updated_at DESC
  `).all(req.user.workspaceId);
  res.json({ contracts });
});

router.post("/", async (req, res) => {
  const contractType = typeof req.body?.contractType === "string" ? req.body.contractType : "";
  if (!Object.hasOwn(templates, contractType)) throw httpError(400, "Choose a contract template.");
  const title = requireText(req.body?.title, "Contract title", 140);
  const clientName = typeof req.body?.clientName === "string" ? req.body.clientName.trim().slice(0, 120) : "";
  const services = requireText(req.body?.services, "Services or scope", 3000);
  const schedule = requireText(req.body?.schedule, "Schedule", 800);
  const fees = requireText(req.body?.fees, "Fees", 500);
  const content = templates[contractType].replaceAll("{{provider}}", req.user.name)
    .replaceAll("{{client}}", clientName || "[Client name]")
    .replaceAll("{{date}}", new Date().toLocaleDateString("en-US"))
    .replaceAll("{{services}}", services)
    .replaceAll("{{schedule}}", schedule)
    .replaceAll("{{fees}}", fees);
  const result = await db.prepare(`
    INSERT INTO contracts (workspace_id, created_by, title, client_name, contract_type, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.workspaceId, req.user.id, title, clientName, contractType, content);
  const contract = await db.prepare(`
    SELECT id, title, client_name AS "clientName", contract_type AS "contractType",
      content, status, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM contracts WHERE id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json({ contract });
});

router.patch("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Contract ID");
  const existing = await db.prepare("SELECT id FROM contracts WHERE id = ? AND workspace_id = ?").get(id, req.user.workspaceId);
  if (!existing) throw httpError(404, "Contract not found.");
  const title = req.body?.title === undefined ? undefined : requireText(req.body.title, "Contract title", 140);
  const content = req.body?.content === undefined ? undefined : requireText(req.body.content, "Contract body", 20000);
  if (!title && !content) throw httpError(400, "Update a title or contract body.");
  await db.prepare(`
    UPDATE contracts SET title = COALESCE(?, title), content = COALESCE(?, content),
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND workspace_id = ?
  `).run(title || null, content || null, id, req.user.workspaceId);
  const contract = await db.prepare(`
    SELECT id, title, client_name AS "clientName", contract_type AS "contractType",
      content, status, created_at AS "createdAt", updated_at AS "updatedAt"
    FROM contracts WHERE id = ?
  `).get(id);
  res.json({ contract });
});

router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Contract ID");
  const result = await db.prepare("DELETE FROM contracts WHERE id = ? AND workspace_id = ?").run(id, req.user.workspaceId);
  if (!result.changes) throw httpError(404, "Contract not found.");
  res.status(204).end();
});

export default router;
