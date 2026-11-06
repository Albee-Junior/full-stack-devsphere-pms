import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { pool } from "./database.js";

export async function seedDatabase() {
  const { rows } = await pool.query("SELECT COUNT(*)::integer AS count FROM users");
  if (rows[0].count > 0 || config.isProduction) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const workspace = await client.query("INSERT INTO workspaces (name) VALUES ($1) RETURNING id", ["Northstar Studio"]);
    const workspaceId = workspace.rows[0].id;
    const passwordHash = await bcrypt.hash(config.demoPassword, 10);
    const user = await client.query(
      "INSERT INTO users (workspace_id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id",
      [workspaceId, "Alex Morgan", config.demoEmail, passwordHash],
    );
    const userId = user.rows[0].id;
    const projects = [
      ["Website redesign", "A fresh experience from the first click to the final checkout.", "WEB", "violet", "2026-11-18"],
      ["Mobile app", "Building a more delightful way to work on the go.", "APP", "blue", "2026-11-24"],
      ["Platform & API", "The reliable foundation behind every great feature.", "API", "orange", "2026-11-12"],
    ];
    const projectIds = [];
    for (const project of projects) {
      const result = await client.query(
        "INSERT INTO projects (workspace_id, name, description, code, color, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [workspaceId, ...project],
      );
      projectIds.push(result.rows[0].id);
    }

    const tasks = [
      [projectIds[0], "Finalize onboarding flow", "In progress", "High", "2026-11-05"],
      [projectIds[1], "Build analytics dashboard", "In progress", "Medium", "2026-11-05"],
      [projectIds[2], "Review API documentation", "Todo", "Low", "2026-11-06"],
      [projectIds[1], "Ship dark mode", "In review", "High", "2026-11-08"],
      [projectIds[0], "Update component library", "Todo", "Medium", "2026-11-10"],
      [projectIds[2], "Add payment webhooks", "In review", "High", "2026-11-11"],
    ];
    for (const [projectId, title, status, priority, dueDate] of tasks) {
      await client.query(
        "INSERT INTO tasks (workspace_id, project_id, title, status, priority, due_date, assignee_id) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [workspaceId, projectId, title, status, priority, dueDate, userId],
      );
    }

    const channels = [];
    for (const name of ["general", "product-team", "design-feedback"]) {
      const { rows: channelRows } = await client.query(
        "INSERT INTO channels (workspace_id, name) VALUES ($1, $2) RETURNING id",
        [workspaceId, name],
      );
      channels.push(channelRows[0].id);
    }
    await client.query(
      "INSERT INTO messages (workspace_id, channel_id, author_id, body) VALUES ($1, $2, $3, $4)",
      [workspaceId, channels[0], userId, "Welcome to your DevSphere workspace! Start a conversation with your team here."],
    );
    for (const [title, description, startsAt] of [
      ["Daily standup", "Team sync", "2026-11-05T09:30:00Z"],
      ["Design review", "Website redesign", "2026-11-05T11:00:00Z"],
      ["Sprint planning", "Mobile app", "2026-11-05T13:30:00Z"],
    ]) {
      await client.query(
        "INSERT INTO events (workspace_id, title, description, starts_at, created_by) VALUES ($1, $2, $3, $4, $5)",
        [workspaceId, title, description, startsAt, userId],
      );
    }

    await client.query(
      "INSERT INTO workspace_preferences (workspace_id, industry, role, team_size, workflow, onboarding_completed) VALUES ($1, 'Software', 'Team member', '2–5', 'Kanban', TRUE)",
      [workspaceId],
    );
    await client.query(
      "INSERT INTO feature_data (workspace_id, data_key, value_json) VALUES ($1, 'whiteboard', $2)",
      [workspaceId, JSON.stringify([{ id: 1, text: "Keep it simple", color: "yellow" }, { id: 2, text: "Ship the smallest useful thing", color: "lavender" }])],
    );
    await client.query(
      "INSERT INTO feature_data (workspace_id, data_key, value_json) VALUES ($1, 'code', $2)",
      [workspaceId, JSON.stringify({ filename: "ProjectCard.jsx", content: "export function ProjectCard({ project }) {\\n  return <h2>{project.name}</h2>;\\n}" })],
    );
    await client.query(
      "INSERT INTO blog_posts (title, slug, excerpt, body, category, author, published_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      ["Meet the new DevSphere workspace", "meet-the-new-devsphere-workspace", "A calmer, more connected home for the work your team cares about.", "We built DevSphere around one simple idea: your best work happens when the tools you need work well together.", "Product", "The DevSphere Team", "2026-11-04T09:00:00Z"],
    );
    for (const [title, body, topic] of [
      ["What does your ideal team kickoff look like?", "I am putting together a lightweight kickoff for our next project. What is one small ritual or question that helps your team start with clarity?", "Teamwork"],
      ["Share a tiny workflow win", "A small improvement can make a big difference. What is one shortcut, template, or habit that made your team's week a little better?", "Show & tell"],
    ]) {
      await client.query(
        "INSERT INTO community_posts (author_id, title, body, topic) VALUES ($1, $2, $3, $4)",
        [userId, title, body, topic],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
