import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { httpError, requireText } from "../middleware/errors.js";
import { validateId } from "../middleware/validate.js";
import { notifyWorkspace } from "../utils/notifications.js";
import { enforceCountLimit, getWorkspacePlan } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken);
const statuses = ["Todo", "In progress", "In review", "Done"];
const priorities = ["Low", "Medium", "High"];

async function listTasks(workspaceId) {
  const tasks = await db.prepare(`
    SELECT t.id, t.title, t.description, t.status, t.priority, t.due_date AS "dueDate",
      t.project_id AS "projectId", p.name AS project, t.assignee_id AS "assigneeId",
      t.created_at AS "createdAt", t.updated_at AS "updatedAt"
    FROM tasks t LEFT JOIN projects p ON p.id = t.project_id AND p.workspace_id = t.workspace_id
    WHERE t.workspace_id = ? ORDER BY t.created_at DESC, t.id DESC
  `).all(workspaceId);
  return tasks.map((task) => ({ ...task, due: formatDue(task.dueDate) }));
}

function formatDue(value) {
  if (!value) return "No date";
  const due = new Date(`${value}T00:00:00`);
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((due - todayStart) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function parseDueDate(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw httpError(400, "Enter a valid due date.");
  }
  return value;
}

router.get("/", async (req, res) => res.json({ tasks: await listTasks(req.user.workspaceId) }));

router.post("/", async (req, res) => {
  const plan = await getWorkspacePlan(req.user.workspaceId);
  await enforceCountLimit(req.user.workspaceId, "tasks", "workspace_id", plan.maxTasks, "task");
  const title = requireText(req.body?.title, "Task title", 180);
  const status = statuses.includes(req.body.status) ? req.body.status : "Todo";
  const priority = priorities.includes(req.body.priority) ? req.body.priority : "Medium";
  const projectId = req.body.projectId ? validateId(req.body.projectId, "Project ID") : null;
  if (projectId && !await db.prepare("SELECT id FROM projects WHERE id = ? AND workspace_id = ?").get(projectId, req.user.workspaceId)) {
    throw httpError(400, "Choose a project in your workspace.");
  }
  const dueDate = parseDueDate(req.body.dueDate);
  const result = await db.prepare(`
    INSERT INTO tasks (workspace_id, project_id, title, description, status, priority, due_date, assignee_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.workspaceId, projectId, title, String(req.body.description || "").trim().slice(0, 2000), status, priority, dueDate, req.user.id);
  const task = (await listTasks(req.user.workspaceId)).find((item) => item.id === result.lastInsertRowid);
  req.app.get("io").to(`workspace:${req.user.workspaceId}`).emit("task:created", task);
  await notifyWorkspace({
    workspaceId: req.user.workspaceId,
    actorId: req.user.id,
    kind: "task",
    title: "A new task was added",
    body: task.title,
    target: "My tasks",
  });
  res.status(201).json({ task });
});

router.patch("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Task ID");
  const task = await db.prepare("SELECT * FROM tasks WHERE id = ? AND workspace_id = ?").get(id, req.user.workspaceId);
  if (!task) throw httpError(404, "Task not found.");
  const status = req.body.status === undefined ? task.status : req.body.status;
  const priority = req.body.priority === undefined ? task.priority : req.body.priority;
  if (!statuses.includes(status)) throw httpError(400, "Choose a valid task status.");
  if (!priorities.includes(priority)) throw httpError(400, "Choose a valid priority.");
  const title = req.body.title === undefined ? task.title : requireText(req.body.title, "Task title", 180);
  const description = req.body.description === undefined ? task.description : String(req.body.description).trim().slice(0, 2000);
  const dueDate = req.body.dueDate === undefined ? task.due_date : parseDueDate(req.body.dueDate);
  const projectId = req.body.projectId === undefined ? task.project_id : req.body.projectId ? validateId(req.body.projectId, "Project ID") : null;
  if (projectId && !await db.prepare("SELECT id FROM projects WHERE id = ? AND workspace_id = ?").get(projectId, req.user.workspaceId)) {
    throw httpError(400, "Choose a project in your workspace.");
  }
  await db.prepare(`
    UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, project_id = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(title, description, status, priority, dueDate, projectId, id);
  const updated = (await listTasks(req.user.workspaceId)).find((item) => item.id === id);
  req.app.get("io").to(`workspace:${req.user.workspaceId}`).emit("task:updated", updated);
  if (status !== task.status) {
    await notifyWorkspace({
      workspaceId: req.user.workspaceId,
      actorId: req.user.id,
      kind: "task",
      title: `Task moved to ${status}`,
      body: updated.title,
      target: "My tasks",
    });
  }
  res.json({ task: updated });
});

router.delete("/:id", async (req, res) => {
  const id = validateId(req.params.id, "Task ID");
  const result = await db.prepare("DELETE FROM tasks WHERE id = ? AND workspace_id = ?").run(id, req.user.workspaceId);
  if (!result.changes) throw httpError(404, "Task not found.");
  req.app.get("io").to(`workspace:${req.user.workspaceId}`).emit("task:deleted", { id });
  res.status(204).end();
});

export default router;
