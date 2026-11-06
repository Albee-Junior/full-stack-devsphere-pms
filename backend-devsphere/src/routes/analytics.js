import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireFeature } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken, requireFeature("analytics"));

router.get("/", async (req, res) => {
  const workspaceId = req.user.workspaceId;
  const [projectSummary, tasksByStatus, projectProgress, storage] = await Promise.all([
    db.prepare(`
      SELECT COUNT(DISTINCT p.id) AS projects,
        COUNT(t.id) AS tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'Done') AS completed_tasks
      FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND t.workspace_id = p.workspace_id
      WHERE p.workspace_id = ?
    `).get(workspaceId),
    db.prepare(`
      SELECT status, COUNT(*) AS count FROM tasks
      WHERE workspace_id = ? GROUP BY status ORDER BY status
    `).all(workspaceId),
    db.prepare(`
      SELECT p.id, p.name, COUNT(t.id) AS tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'Done') AS completed_tasks
      FROM projects p LEFT JOIN tasks t ON t.project_id = p.id AND t.workspace_id = p.workspace_id
      WHERE p.workspace_id = ? GROUP BY p.id ORDER BY p.created_at DESC LIMIT 8
    `).all(workspaceId),
    db.prepare("SELECT COALESCE(SUM(size_bytes), 0) AS bytes FROM workspace_files WHERE workspace_id = ?").get(workspaceId),
  ]);
  const tasks = Number(projectSummary.tasks);
  const completedTasks = Number(projectSummary.completed_tasks);
  res.json({
    summary: {
      projects: Number(projectSummary.projects),
      tasks,
      completedTasks,
      completionRate: tasks ? Math.round((completedTasks / tasks) * 100) : 0,
      storageBytes: Number(storage.bytes),
    },
    tasksByStatus: tasksByStatus.map((row) => ({ status: row.status, count: Number(row.count) })),
    projects: projectProgress.map((project) => ({
      id: project.id,
      name: project.name,
      tasks: Number(project.tasks),
      completedTasks: Number(project.completed_tasks),
      progress: Number(project.tasks) ? Math.round((Number(project.completed_tasks) / Number(project.tasks)) * 100) : 0,
    })),
  });
});

export default router;
