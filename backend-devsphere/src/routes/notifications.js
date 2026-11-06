import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";

const router = Router();
router.use(authenticateToken);

router.get("/", async (req, res) => {
  const notifications = await db.prepare(`
    SELECT id, kind, title, body, target, read_at AS "readAt", created_at AS "createdAt"
    FROM notifications WHERE user_id = ? AND workspace_id = ?
    ORDER BY created_at DESC, id DESC LIMIT 100
  `).all(req.user.id, req.user.workspaceId);
  res.json({ notifications, unreadCount: notifications.filter((notification) => !notification.readAt).length });
});

router.patch("/read-all", async (req, res) => {
  await db.prepare(`
    UPDATE notifications SET read_at = CURRENT_TIMESTAMP
    WHERE user_id = ? AND workspace_id = ? AND read_at IS NULL
  `).run(req.user.id, req.user.workspaceId);
  res.json({ success: true });
});

router.patch("/:id/read", async (req, res) => {
  const id = validateId(req.params.id, "Notification ID");
  const result = await db.prepare(`
    UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
    WHERE id = ? AND user_id = ? AND workspace_id = ?
  `).run(id, req.user.id, req.user.workspaceId);
  if (!result.changes) throw httpError(404, "Notification not found.");
  res.json({ success: true });
});

export default router;
