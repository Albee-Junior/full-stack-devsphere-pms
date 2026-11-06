import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, withTransaction } from "../db/database.js";
import { signUser, authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.get("/invitations/:token", asyncHandler(async (req, res) => {
  const invitation = await db.prepare(`
    SELECT i.email, w.name AS "workspaceName"
    FROM workspace_invitations i JOIN workspaces w ON w.id = i.workspace_id
    WHERE i.token = ? AND i.accepted_at IS NULL AND i.expires_at > CURRENT_TIMESTAMP
  `).get(String(req.params.token).slice(0, 100));
  if (!invitation) throw httpError(404, "This invitation has expired or has already been used.");
  res.json({ invitation });
}));

router.post("/register", asyncHandler(async (req, res) => {
  const name = requireText(req.body?.name, "Name", 80);
  const email = requireText(req.body?.email, "Email", 160).toLowerCase();
  const password = requireText(req.body?.password, "Password", 128);
  const inviteToken = typeof req.body.inviteToken === "string" ? req.body.inviteToken.slice(0, 100) : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw httpError(400, "Enter a valid email address.");
  if (password.length < 8) throw httpError(400, "Password must be at least 8 characters.");
  if (await db.prepare("SELECT id FROM users WHERE LOWER(email) = ?").get(email)) {
    throw httpError(409, "An account with that email already exists.");
  }
  const invitation = inviteToken
    ? await db.prepare("SELECT * FROM workspace_invitations WHERE token = ? AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP").get(inviteToken)
    : null;
  if (inviteToken && !invitation) throw httpError(400, "This invitation has expired or has already been used.");
  if (invitation && invitation.email.toLowerCase() !== email) {
    throw httpError(400, "Register with the email address this invitation was sent to.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const user = await withTransaction(async ({ query }) => {
      const workspace = invitation
        ? { rows: [{ id: invitation.workspace_id }] }
        : await query("INSERT INTO workspaces (name) VALUES ($1) RETURNING id", [`${name.split(" ")[0]}'s workspace`]);
      const workspaceId = workspace.rows[0].id;
      const result = await query(
        "INSERT INTO users (workspace_id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id",
        [workspaceId, name, email, passwordHash],
      );
      if (invitation) {
        await query("UPDATE workspace_invitations SET accepted_at = CURRENT_TIMESTAMP WHERE id = $1", [invitation.id]);
      } else {
        for (const channel of ["general", "product-team", "design-feedback"]) {
          await query("INSERT INTO channels (workspace_id, name) VALUES ($1, $2) ON CONFLICT DO NOTHING", [workspaceId, channel]);
        }
      }
      return { id: result.rows[0].id, workspaceId, name, email };
    });
    res.status(201).json({ token: signUser(user), user });
  } catch (error) {
    if (error.code === "23505") throw httpError(409, "An account with that email already exists.");
    throw error;
  }
}));

router.post("/login", asyncHandler(async (req, res) => {
  const email = requireText(req.body?.email, "Email", 160).toLowerCase();
  const password = requireText(req.body?.password, "Password", 128);
  const user = await db.prepare(
    'SELECT id, workspace_id AS "workspaceId", name, email, password_hash AS "passwordHash" FROM users WHERE LOWER(email) = ?',
  ).get(email);

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw httpError(401, "Email or password is incorrect.");
  }

  const safeUser = { id: user.id, workspaceId: user.workspaceId, name: user.name, email: user.email };
  res.json({ token: signUser(safeUser), user: safeUser });
}));

router.get("/me", authenticateToken, asyncHandler(async (req, res) => {
  const workspace = await db.prepare("SELECT id, name FROM workspaces WHERE id = ?").get(req.user.workspaceId);
  res.json({ user: req.user, workspace });
}));

export default router;
