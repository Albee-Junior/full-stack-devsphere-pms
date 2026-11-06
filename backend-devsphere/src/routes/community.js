import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";

const router = Router();

function optionalAuth(req, res, next) {
  if (!req.get("authorization")) return next();
  return authenticateToken(req, res, next);
}

router.get("/", optionalAuth, async (req, res) => {
  const posts = await db.prepare(`
    SELECT p.id, p.title, p.body, p.topic, p.created_at AS "createdAt",
      u.id AS "authorId", u.name AS "authorName",
      COALESCE(likes_summary.total, 0) AS likes,
      COALESCE(comments_summary.total, 0) AS comments,
      (user_like.user_id IS NOT NULL) AS "likedByMe"
    FROM community_posts p JOIN users u ON u.id = p.author_id
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS total FROM community_likes GROUP BY post_id
    ) likes_summary ON likes_summary.post_id = p.id
    LEFT JOIN (
      SELECT post_id, COUNT(*) AS total FROM community_comments GROUP BY post_id
    ) comments_summary ON comments_summary.post_id = p.id
    LEFT JOIN community_likes user_like ON user_like.post_id = p.id AND user_like.user_id = ?
    ORDER BY p.created_at DESC LIMIT 100
  `).all(req.user?.id || 0);
  res.json({ posts });
});

router.post("/", authenticateToken, async (req, res) => {
  const title = requireText(req.body?.title, "Discussion title", 180);
  const body = requireText(req.body?.body, "Discussion", 5000);
  const topic = typeof req.body.topic === "string" ? req.body.topic.trim().slice(0, 40) || "General" : "General";
  const result = await db.prepare(
    "INSERT INTO community_posts (author_id, title, body, topic) VALUES (?, ?, ?, ?)",
  ).run(req.user.id, title, body, topic);
  const post = await db.prepare(`
    SELECT p.id, p.title, p.body, p.topic, p.created_at AS "createdAt",
      u.id AS "authorId", u.name AS "authorName", 0 AS likes, 0 AS comments, FALSE AS "likedByMe"
    FROM community_posts p JOIN users u ON u.id = p.author_id WHERE p.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json({ post });
});

router.get("/:id/comments", optionalAuth, async (req, res) => {
  const postId = validateId(req.params.id, "Discussion ID");
  const comments = await db.prepare(`
    SELECT c.id, c.post_id AS "postId", c.body, c.created_at AS "createdAt",
      u.id AS "authorId", u.name AS "authorName"
    FROM community_comments c JOIN users u ON u.id = c.author_id
    WHERE c.post_id = ? ORDER BY c.created_at, c.id
  `).all(postId);
  res.json({ comments });
});

router.post("/:id/comments", authenticateToken, async (req, res) => {
  const postId = validateId(req.params.id, "Discussion ID");
  if (!await db.prepare("SELECT id FROM community_posts WHERE id = ?").get(postId)) throw httpError(404, "Discussion not found.");
  const body = requireText(req.body?.body, "Reply", 2000);
  const result = await db.prepare(
    "INSERT INTO community_comments (post_id, author_id, body) VALUES (?, ?, ?)",
  ).run(postId, req.user.id, body);
  const comment = await db.prepare(`
    SELECT c.id, c.post_id AS "postId", c.body, c.created_at AS "createdAt",
      u.id AS "authorId", u.name AS "authorName"
    FROM community_comments c JOIN users u ON u.id = c.author_id WHERE c.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json({ comment });
});

router.post("/:id/like", authenticateToken, async (req, res) => {
  const postId = validateId(req.params.id, "Discussion ID");
  if (!await db.prepare("SELECT id FROM community_posts WHERE id = ?").get(postId)) throw httpError(404, "Discussion not found.");
  const existing = await db.prepare("SELECT 1 FROM community_likes WHERE post_id = ? AND user_id = ?").get(postId, req.user.id);
  if (existing) {
    await db.prepare("DELETE FROM community_likes WHERE post_id = ? AND user_id = ?").run(postId, req.user.id);
  } else {
    await db.prepare("INSERT INTO community_likes (post_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING").run(postId, req.user.id);
  }
  const { count } = await db.prepare("SELECT COUNT(*) AS count FROM community_likes WHERE post_id = ?").get(postId);
  res.json({ liked: !existing, likes: Number(count) });
});

export default router;
