import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { enforceCountLimit, getWorkspacePlan } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken);

router.get("/", async (req, res) => {
  const groups = await db.prepare(`
    SELECT g.id, g.name, g.description, g.topic, g.created_at AS "createdAt",
      COUNT(m.user_id) AS "memberCount",
      CASE WHEN COUNT(m.user_id) FILTER (WHERE m.user_id = ?) > 0 THEN TRUE ELSE FALSE END AS "isMember"
    FROM community_groups g
    LEFT JOIN community_group_members m ON m.group_id = g.id
    WHERE g.workspace_id = ?
    GROUP BY g.id ORDER BY g.created_at DESC
  `).all(req.user.id, req.user.workspaceId);
  res.json({ groups });
});

router.post("/", async (req, res) => {
  const plan = await getWorkspacePlan(req.user.workspaceId);
  await enforceCountLimit(req.user.workspaceId, "community_groups", "workspace_id", plan.maxGroups, "group");
  const name = requireText(req.body?.name, "Group name", 100);
  const description = typeof req.body.description === "string" ? req.body.description.trim().slice(0, 1000) : "";
  const topic = typeof req.body.topic === "string" ? req.body.topic.trim().slice(0, 60) || "General" : "General";
  const result = await db.prepare(`
    INSERT INTO community_groups (workspace_id, created_by, name, description, topic)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.workspaceId, req.user.id, name, description, topic);
  await db.prepare("INSERT INTO community_group_members (group_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .run(result.lastInsertRowid, req.user.id);
  const group = await db.prepare(`
    SELECT g.id, g.name, g.description, g.topic, g.created_at AS "createdAt",
      1 AS "memberCount", TRUE AS "isMember"
    FROM community_groups g WHERE g.id = ? AND g.workspace_id = ?
  `).get(result.lastInsertRowid, req.user.workspaceId);
  res.status(201).json({ group });
});

router.post("/:id/join", async (req, res) => {
  const id = validateId(req.params.id, "Group ID");
  const group = await db.prepare("SELECT id FROM community_groups WHERE id = ? AND workspace_id = ?").get(id, req.user.workspaceId);
  if (!group) throw httpError(404, "Group not found.");
  await db.prepare("INSERT INTO community_group_members (group_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING")
    .run(id, req.user.id);
  res.json({ joined: true });
});

router.delete("/:id/membership", async (req, res) => {
  const id = validateId(req.params.id, "Group ID");
  const result = await db.prepare(`
    DELETE FROM community_group_members
    WHERE group_id = ? AND user_id = ?
      AND group_id IN (SELECT id FROM community_groups WHERE id = ? AND workspace_id = ?)
  `).run(id, req.user.id, id, req.user.workspaceId);
  if (!result.changes) throw httpError(404, "Group membership not found.");
  res.status(204).end();
});

export default router;
