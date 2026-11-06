import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "../db/database.js";

export function signUser(user) {
  return jwt.sign({ sub: String(user.id) }, config.jwtSecret, { expiresIn: config.tokenLifetime });
}

export function authenticateToken(req, res, next) {
  const token = req.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return res.status(401).json({ error: "Sign in to continue." });

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }

  return db.prepare(
    'SELECT id, workspace_id AS "workspaceId", name, email FROM users WHERE id = ?',
  ).get(payload.sub).then((user) => {
    if (!user) return res.status(401).json({ error: "Your session is no longer valid." });
    req.user = user;
    return next();
  }).catch(next);
}
