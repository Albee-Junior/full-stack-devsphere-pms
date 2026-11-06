import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError } from "../middleware/errors.js";
import { getWorkspacePlan } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken);
const planRank = { free: 0, pro: 1, business: 2 };

router.get("/", async (req, res) => {
  const extensions = await db.prepare(`
    SELECT e.extension_key AS key, e.name, e.description, e.category, e.min_plan AS "minPlan",
      (w.extension_key IS NOT NULL) AS installed
    FROM extension_catalog e
    LEFT JOIN workspace_extensions w ON w.extension_key = e.extension_key AND w.workspace_id = ?
    ORDER BY e.category, e.name
  `).all(req.user.workspaceId);
  res.json({ extensions });
});

router.post("/:key/install", async (req, res) => {
  const extension = await db.prepare(`
    SELECT extension_key AS key, min_plan AS "minPlan" FROM extension_catalog WHERE extension_key = ?
  `).get(req.params.key);
  if (!extension) throw httpError(404, "Extension not found.");
  const plan = await getWorkspacePlan(req.user.workspaceId);
  if (planRank[plan.key] < planRank[extension.minPlan]) {
    throw httpError(403, `This extension requires the ${extension.minPlan} plan.`);
  }
  await db.prepare(`
    INSERT INTO workspace_extensions (workspace_id, extension_key, installed_by)
    VALUES (?, ?, ?) ON CONFLICT(workspace_id, extension_key) DO NOTHING
  `).run(req.user.workspaceId, extension.key, req.user.id);
  res.status(201).json({ key: extension.key, installed: true });
});

router.delete("/:key/install", async (req, res) => {
  const result = await db.prepare("DELETE FROM workspace_extensions WHERE workspace_id = ? AND extension_key = ?")
    .run(req.user.workspaceId, req.params.key);
  if (!result.changes) throw httpError(404, "Installed extension not found.");
  res.status(204).end();
});

export default router;
