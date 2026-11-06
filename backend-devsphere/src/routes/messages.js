import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { notifyWorkspace } from "../utils/notifications.js";

const router = Router();
router.use(authenticateToken);

router.get("/channels", async (req, res) => {
  const channels = await db.prepare(
    'SELECT id, name FROM channels WHERE workspace_id = ? ORDER BY name',
  ).all(req.user.workspaceId);
  res.json({ channels });
});

router.get("/", async (req, res) => {
  let channelId = req.query.channelId
    ? validateId(req.query.channelId, "Channel ID")
    : (await db.prepare("SELECT id FROM channels WHERE workspace_id = ? ORDER BY id LIMIT 1").get(req.user.workspaceId))?.id;
  if (!channelId) return res.json({ messages: [] });
  const channel = await db.prepare("SELECT id FROM channels WHERE id = ? AND workspace_id = ?").get(channelId, req.user.workspaceId);
  if (!channel) throw httpError(404, "Channel not found.");
  const messages = await db.prepare(`
    SELECT m.id, m.body, m.created_at AS "createdAt",
      u.id AS "authorId", u.name AS "authorName"
    FROM messages m JOIN users u ON u.id = m.author_id
    WHERE m.channel_id = ? AND m.workspace_id = ?
    ORDER BY m.id DESC LIMIT 100
  `).all(channelId, req.user.workspaceId);
  res.json({ messages: messages.reverse(), channelId });
});

router.post("/", async (req, res) => {
  const body = requireText(req.body?.body, "Message", 4000);
  const channelId = validateId(req.body?.channelId, "Channel ID");
  const channel = await db.prepare("SELECT id, name FROM channels WHERE id = ? AND workspace_id = ?").get(channelId, req.user.workspaceId);
  if (!channel) throw httpError(404, "Channel not found.");
  const result = await db.prepare(
    "INSERT INTO messages (workspace_id, channel_id, author_id, body) VALUES (?, ?, ?, ?)",
  ).run(req.user.workspaceId, channelId, req.user.id, body);
  const message = await db.prepare(`
    SELECT m.id, m.body, m.created_at AS "createdAt",
      u.id AS "authorId", u.name AS "authorName"
    FROM messages m JOIN users u ON u.id = m.author_id WHERE m.id = ?
  `).get(result.lastInsertRowid);
  const payload = { ...message, channelId };
  req.app.get("io").to(`workspace:${req.user.workspaceId}`).emit("message:new", payload);
  await notifyWorkspace({
    workspaceId: req.user.workspaceId,
    actorId: req.user.id,
    kind: "message",
    title: `New message in #${channel.name}`,
    body,
    target: "Messages",
  });
  res.status(201).json({ message: payload });
});

export default router;
