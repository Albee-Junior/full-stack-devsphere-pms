import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db, withTransaction } from "../db/database.js";
import { config } from "../config.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError } from "../middleware/errors.js";
import { getWorkspacePlan, workspaceUsage } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken);
const featureKeys = new Set(["code", "whiteboard"]);

function normalizeTeamSize(value) {
  if (typeof value !== "string") return "";
  const normalized = value
    .replace(/\u2013|\u2014|\u2212/g, "-")
    .replace(/\u00a0/g, " ")
    .trim();
  return normalized === "2â€“5" ? "2–5" : normalized;
}

router.get("/dashboard", async (req, res) => {
  const workspaceId = req.user.workspaceId;
  const { count: projectCount } = await db.prepare(
    "SELECT COUNT(*) AS count FROM projects WHERE workspace_id = ?",
  ).get(workspaceId);
  const tasks = await db.prepare(`
    SELECT status, priority, COUNT(*) AS count FROM tasks WHERE workspace_id = ? GROUP BY status, priority
  `).all(workspaceId);
  const events = await db.prepare(`
    SELECT id, title, description, starts_at AS "startsAt" FROM events
    WHERE workspace_id = ? AND starts_at >= CURRENT_TIMESTAMP - INTERVAL '1 day'
    ORDER BY starts_at LIMIT 6
  `).all(workspaceId);
  const counts = { done: 0, open: 0, inProgress: 0, review: 0, highPriority: 0 };
  for (const task of tasks) {
    const count = Number(task.count);
    if (task.status === "Done") counts.done += count;
    else counts.open += count;
    if (task.status === "In progress") counts.inProgress += count;
    if (task.status === "In review") counts.review += count;
    if (task.priority === "High" && task.status !== "Done") counts.highPriority += count;
  }
  res.json({ counts, projectCount: Number(projectCount), events, user: req.user });
});

router.get("/usage", async (req, res) => {
  res.json(await workspaceUsage(req.user.workspaceId));
});

router.get("/preferences", async (req, res) => {
  await db.prepare("INSERT INTO workspace_preferences (workspace_id) VALUES (?) ON CONFLICT DO NOTHING").run(req.user.workspaceId);
  const preferences = await db.prepare(`
    SELECT w.name AS "workspaceName", p.industry, p.role, p.team_size AS "teamSize",
      p.workflow, p.onboarding_completed AS "onboardingCompleted"
    FROM workspaces w JOIN workspace_preferences p ON p.workspace_id = w.id
    WHERE w.id = ?
  `).get(req.user.workspaceId);
  res.json({ preferences });
});

router.put("/preferences", async (req, res) => {
  const workspaceName = typeof req.body?.workspaceName === "string" ? req.body.workspaceName.trim() : "";
  const industry = typeof req.body?.industry === "string" ? req.body.industry.trim() : "";
  const role = typeof req.body?.role === "string" ? req.body.role.trim() : "";
  const teamSize = normalizeTeamSize(req.body?.teamSize);
  const workflow = typeof req.body?.workflow === "string" ? req.body.workflow.trim() : "";
  const normalizedTeamSize = normalizeTeamSize(teamSize);
  const choices = {
    industry: ["Student", "Business", "Freelancer", "Software", "Design", "Education", "Research", "Other"],
    role: ["Student", "Business owner", "Freelancer", "Team member", "Educator", "Researcher"],
    teamSize: ["Just me", "2–5", "2-5", "6–15", "16–50", "51+"],
    workflow: ["Flexible", "Kanban", "Weekly planning", "Study schedule"],
  };
  const teamSizeValue = ["2–5", "2-5"].includes(normalizedTeamSize) ? "2–5" : normalizedTeamSize;
  for (const [field, value] of Object.entries({ industry, role, teamSize: teamSizeValue, workflow })) {
    if (!choices[field].includes(value)) throw httpError(400, `Choose a valid ${field} preference.`);
  }
  if (workspaceName.length < 2 || workspaceName.length > 80) {
    throw httpError(400, "Workspace name must be between 2 and 80 characters.");
  }
  await withTransaction(async ({ query }) => {
    await query("UPDATE workspaces SET name = $1 WHERE id = $2", [workspaceName, req.user.workspaceId]);
    await query(`
      INSERT INTO workspace_preferences (workspace_id, industry, role, team_size, workflow, onboarding_completed, updated_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, CURRENT_TIMESTAMP)
      ON CONFLICT(workspace_id) DO UPDATE SET industry = EXCLUDED.industry, role = EXCLUDED.role,
        team_size = EXCLUDED.team_size, workflow = EXCLUDED.workflow,
        onboarding_completed = TRUE, updated_at = CURRENT_TIMESTAMP
    `, [req.user.workspaceId, industry, role, teamSizeValue, workflow]);
  });
  res.json({ preferences: { workspaceName, industry, role, teamSize: teamSizeValue, workflow, onboardingCompleted: true } });
});

router.post("/invitations", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 160) {
    throw httpError(400, "Enter a valid email address.");
  }
  if (await db.prepare("SELECT id FROM users WHERE LOWER(email) = ? AND workspace_id = ?").get(email, req.user.workspaceId)) {
    throw httpError(409, "This person is already a member of your workspace.");
  }
  const plan = await getWorkspacePlan(req.user.workspaceId);
  const members = await db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE workspace_id = ?) +
      (SELECT COUNT(*) FROM workspace_invitations
        WHERE workspace_id = ? AND accepted_at IS NULL AND expires_at > CURRENT_TIMESTAMP) AS count
  `).get(req.user.workspaceId, req.user.workspaceId);
  if (Number(members.count) >= plan.maxMembers) {
    throw httpError(403, `Your ${plan.name} plan allows up to ${plan.maxMembers} workspace members. Upgrade to invite more people.`);
  }
  const token = randomBytes(32).toString("base64url");
  await db.prepare(`
    INSERT INTO workspace_invitations (workspace_id, email, token, created_by, expires_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP + INTERVAL '7 days')
    ON CONFLICT DO NOTHING
  `).run(req.user.workspaceId, email, token, req.user.id);
  const origin = config.clientOrigin.split(",")[0].trim();
  res.status(201).json({ inviteUrl: `${origin}/?invite=${encodeURIComponent(token)}`, email, expiresInDays: 7 });
});

router.get("/features/:key", async (req, res) => {
  if (!featureKeys.has(req.params.key)) throw httpError(404, "Workspace feature not found.");
  if (req.params.key === "whiteboard") await requireWorkspaceFeature(req.user.workspaceId, "whiteboard");
  const row = await db.prepare(
    "SELECT value_json AS value FROM feature_data WHERE workspace_id = ? AND data_key = ?",
  ).get(req.user.workspaceId, req.params.key);
  res.json({ value: row ? JSON.parse(row.value) : null });
});

router.put("/features/:key", async (req, res) => {
  if (!featureKeys.has(req.params.key)) throw httpError(404, "Workspace feature not found.");
  if (req.params.key === "whiteboard") await requireWorkspaceFeature(req.user.workspaceId, "whiteboard");
  const value = JSON.stringify(req.body?.value);
  if (!value || value.length > 100_000) throw httpError(413, "Workspace document is too large.");
  await db.prepare(`
    INSERT INTO feature_data (workspace_id, data_key, value_json, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(workspace_id, data_key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_at = CURRENT_TIMESTAMP
  `).run(req.user.workspaceId, req.params.key, value);
  req.app.get("io").to(`workspace:${req.user.workspaceId}`).emit("feature:updated", {
    key: req.params.key,
    value: JSON.parse(value),
    updatedBy: req.user.name,
  });
  res.json({ value: JSON.parse(value) });
});

async function requireWorkspaceFeature(workspaceId, feature) {
  const plan = await getWorkspacePlan(workspaceId);
  if (!plan.features.includes(feature)) {
    throw httpError(403, `${feature} is available on Pro. Upgrade your workspace to continue.`);
  }
}

export default router;
