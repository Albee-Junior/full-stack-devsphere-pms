import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { notifyWorkspace } from "../utils/notifications.js";

const router = Router();
router.use(authenticateToken);

router.get("/", async (req, res) => {
  const events = await db.prepare(`
    SELECT id, title, description, starts_at AS "startsAt", created_at AS "createdAt"
    FROM events WHERE workspace_id = ? ORDER BY starts_at LIMIT 300
  `).all(req.user.workspaceId);
  res.json({ events });
});

router.post("/", async (req, res) => {
  const title = requireText(req.body?.title, "Event title", 180);
  const startsAt = requireText(req.body?.startsAt, "Start time", 40);
  if (Number.isNaN(Date.parse(startsAt))) throw httpError(400, "Enter a valid start time.");
  const result = await db.prepare(
    "INSERT INTO events (workspace_id, title, description, starts_at, created_by) VALUES (?, ?, ?, ?, ?)",
  ).run(req.user.workspaceId, title, String(req.body.description || "").trim().slice(0, 1000), startsAt, req.user.id);
  const event = await db.prepare(
    'SELECT id, title, description, starts_at AS "startsAt" FROM events WHERE id = ?',
  ).get(result.lastInsertRowid);
  req.app.get("io").to(`workspace:${req.user.workspaceId}`).emit("event:created", event);
  await notifyWorkspace({
    workspaceId: req.user.workspaceId,
    actorId: req.user.id,
    kind: "event",
    title: "A calendar event was scheduled",
    body: title,
    target: "Calendar",
  });
  res.status(201).json({ event });
});

router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Event ID");
  const result = await db.prepare("DELETE FROM events WHERE id = ? AND workspace_id = ?").run(id, req.user.workspaceId);
  if (!result.changes) throw httpError(404, "Event not found.");
  res.status(204).end();
});

export default router;
