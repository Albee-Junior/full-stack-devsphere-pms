import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeDatabase, pool } from "./database.js";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = process.env.SOURCE_SQLITE_PATH
  ? path.resolve(process.env.SOURCE_SQLITE_PATH)
  : path.resolve(backendDirectory, "../devsphere/data/devsphere.sqlite");
const tables = [
  "workspaces", "users", "projects", "tasks", "channels", "messages", "events",
  "blog_posts", "community_posts", "community_comments", "community_likes",
  "feature_data", "workspace_invitations", "workspace_preferences", "workspace_files",
  "resources", "contracts", "notifications", "billing_records",
];
let source;
let client;

try {
  source = new Database(sourcePath, { readonly: true, fileMustExist: true });
  await initializeDatabase();
  client = await pool.connect();
  await client.query("BEGIN");
  for (const table of tables) {
    const exists = source.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
    if (!exists) continue;
    const rows = source.prepare(`SELECT * FROM "${table}"`).all();
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    const fields = columns.map((column) => `"${column}"`).join(", ");
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
    for (const row of rows) {
      const values = columns.map((column) => column === "email" ? String(row[column]).toLowerCase() : row[column]);
      await client.query(
        `INSERT INTO "${table}" (${fields}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        values,
      );
    }
    if (columns.includes("id")) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), EXISTS (SELECT 1 FROM "${table}"))`,
      );
    }
    console.log(`Migrated ${rows.length} ${table} row(s).`);
  }
  await client.query(`
    INSERT INTO workspace_preferences (workspace_id, onboarding_completed)
    SELECT id, TRUE FROM workspaces
    ON CONFLICT (workspace_id) DO NOTHING
  `);
  await client.query("COMMIT");
  console.log("SQLite data migration complete. The original SQLite file was not modified.");
} catch (error) {
  if (client) await client.query("ROLLBACK");
  console.error(error);
  process.exitCode = 1;
} finally {
  source?.close();
  client?.release();
  await pool.end();
}
