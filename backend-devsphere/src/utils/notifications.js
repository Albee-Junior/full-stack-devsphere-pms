import { db } from "../db/database.js";

export async function notifyWorkspace({ workspaceId, actorId, kind, title, body = "", target }) {
  const recipients = await db.prepare(
    "SELECT id FROM users WHERE workspace_id = ? AND id != ?",
  ).all(workspaceId, actorId);
  for (const recipient of recipients) {
    await db.prepare(
      "INSERT INTO notifications (workspace_id, user_id, kind, title, body, target) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(workspaceId, recipient.id, kind, title, body, target);
  }
}
