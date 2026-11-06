import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireText } from "../middleware/errors.js";

const router = Router();

router.get("/", async (req, res) => {
  const search = String(req.query.search || "").trim().slice(0, 100);
  const category = String(req.query.category || "").trim().slice(0, 40);
  const posts = await db.prepare(`
    SELECT id, title, slug, excerpt, body, category, author, published_at AS "publishedAt"
    FROM blog_posts
    WHERE ($1 = '' OR title ILIKE '%' || $1 || '%' OR excerpt ILIKE '%' || $1 || '%' OR body ILIKE '%' || $1 || '%')
      AND ($2 = '' OR category = $2)
    ORDER BY published_at DESC
    LIMIT 100
  `).all(search, category);
  res.json({ posts });
});

router.get("/:slug", async (req, res) => {
  const post = await db.prepare(`
    SELECT id, title, slug, excerpt, body, category, author, published_at AS "publishedAt"
    FROM blog_posts WHERE slug = ?
  `).get(String(req.params.slug).slice(0, 140));
  if (!post) return res.status(404).json({ error: "Article not found." });
  res.json({ post });
});

router.post("/", authenticateToken, async (req, res) => {
  const title = requireText(req.body?.title, "Article title", 180);
  const excerpt = requireText(req.body?.excerpt, "Article summary", 320);
  const body = requireText(req.body?.body, "Article body", 20000);
  const category = typeof req.body.category === "string" ? req.body.category.trim().slice(0, 40) || "News" : "News";
  const slugBase = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "article";
  const slug = `${slugBase}-${Date.now().toString(36)}`;
  const result = await db.prepare(`
    INSERT INTO blog_posts (title, slug, excerpt, body, category, author)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, slug, excerpt, body, category, req.user.name);
  const post = await db.prepare(`
    SELECT id, title, slug, excerpt, body, category, author, published_at AS "publishedAt"
    FROM blog_posts WHERE id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json({ post });
});

export default router;
