import { Router } from "express";
import { db } from "../db/database.js";
import { authenticateToken } from "../middleware/auth.js";
import { requireText } from "../middleware/errors.js";
import { consumeDailyAllowance, getWorkspacePlan } from "../services/planAccess.js";

const router = Router();
router.use(authenticateToken);

router.post("/", async (req, res) => {
  const plan = await getWorkspacePlan(req.user.workspaceId);
  await consumeDailyAllowance(req.user.workspaceId, "ai", plan.dailyAiRequests);
  const prompt = requireText(req.body?.prompt, "Question", 1200);
  const tasks = await db.prepare(`
    SELECT title, status, priority, due_date AS "dueDate" FROM tasks
    WHERE workspace_id = ?
    ORDER BY CASE status WHEN 'In review' THEN 0 WHEN 'In progress' THEN 1 ELSE 2 END, due_date LIMIT 10
  `).all(req.user.workspaceId);
  const projects = await db.prepare(
    "SELECT name FROM projects WHERE workspace_id = ? ORDER BY created_at LIMIT 10",
  ).all(req.user.workspaceId);
  const urgent = tasks.filter((task) => task.status !== "Done" && task.priority === "High");
  const openCount = tasks.filter((task) => task.status !== "Done").length;
  const projectNames = projects.map((project) => project.name).join(", ");
  const lowerPrompt = prompt.toLowerCase();

  let answer;
  if (/summari[sz]|week|progress|status/.test(lowerPrompt)) {
    answer = `Your workspace has ${openCount} open tasks across ${projects.length} projects${projectNames ? ` (${projectNames})` : ""}. ${urgent.length ? `The high-priority items to keep an eye on are: ${urgent.slice(0, 3).map((task) => task.title).join(", ")}.` : "There are no high-priority tasks in the current task list."}`;
  } else if (/attention|urgent|priorit|block|review/.test(lowerPrompt)) {
    answer = urgent.length
      ? `I found ${urgent.length} high-priority task${urgent.length === 1 ? "" : "s"} in your workspace: ${urgent.slice(0, 4).map((task) => `${task.title} (${task.status})`).join("; ")}. Start by confirming an owner and next step for each.`
      : "Nothing is marked high priority right now. Check your in-review tasks and confirm upcoming due dates with the team.";
  } else if (/plan|sprint/.test(lowerPrompt)) {
    const candidates = tasks.filter((task) => task.status !== "Done").slice(0, 4);
    answer = `For a focused sprint, agree on one outcome, then pull in a small set of tasks. A useful starting point from your board: ${candidates.length ? candidates.map((task) => `${task.title} (${task.priority.toLowerCase()} priority)`).join("; ") : "add and prioritize a few specific tasks first"}. Leave room for review and unexpected work.`;
  } else {
    answer = `I can help you make a practical next-step plan. ${openCount} open tasks are currently tracked${projectNames ? ` across ${projectNames}` : ""}. Try asking what needs attention, or ask for a sprint summary to ground the plan in your workspace.`;
  }

  res.json({
    answer,
    context: { openTasks: openCount, highPriorityTasks: urgent.length, projects: projects.length },
    provider: "workspace-assistant",
    notice: "This assistant uses a built-in workspace summary. Connect an AI provider to enable generative responses.",
  });
});

export default router;
