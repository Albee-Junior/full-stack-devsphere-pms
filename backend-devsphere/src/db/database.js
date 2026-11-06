import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const { Pool, types } = pg;
types.setTypeParser(20, Number);
types.setTypeParser(1082, (value) => value);

if (!config.databaseUrl) {
  throw new Error([
    "DATABASE_URL is not set, so the DevSphere API cannot connect to PostgreSQL.",
    "From the backend-devsphere folder, copy .env.example to .env, start PostgreSQL, and keep the DATABASE_URL value in sync with your database.",
    "For Docker Desktop, run: docker compose up -d",
    "See backend-devsphere/README.md for the required configuration and setup steps.",
  ].join("\n"));
}

let pool;
if (process.env.DEVSPHERE_TEST_DATABASE === "pg-mem") {
  const { newDb } = await import("pg-mem");
  const memoryDatabase = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memoryDatabase.adapters.createPg();
  pool = new adapter.Pool();
} else {
  pool = new Pool({ connectionString: config.databaseUrl, ssl: config.databaseSsl });
}
export { pool };

function prepareSql(sql) {
  let index = 0;
  return sql
    .replace(/\bAS\s+([a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*)\b/g, 'AS "$1"')
    .replace(/\?/g, () => `$${++index}`);
}

export const db = {
  prepare(sql) {
    const text = prepareSql(sql);
    return {
      async get(...params) {
        const result = await pool.query(text, params);
        return result.rows[0];
      },
      async all(...params) {
        const result = await pool.query(text, params);
        return result.rows;
      },
      async run(...params) {
        const table = text.match(/^\s*INSERT\s+INTO\s+([a-z_]+)/i)?.[1]?.toLowerCase();
        const tablesWithoutId = new Set([
          "community_likes",
          "community_group_members",
          "feature_data",
          "workspace_feature_usage",
          "workspace_preferences",
          "workspace_subscriptions",
          "workspace_extensions",
        ]);
        const statement = /^\s*INSERT\b/i.test(text)
          && !tablesWithoutId.has(table)
          && !/\bRETURNING\b/i.test(text)
          ? `${text} RETURNING id`
          : text;
        const result = await pool.query(statement, params);
        return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
      },
    };
  },
};

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback({
      query: (sql, params = []) => client.query(prepareSql(sql), params),
    });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function initializeDatabase() {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");
  await pool.query(process.env.DEVSPHERE_TEST_DATABASE === "pg-mem"
    ? schema.replaceAll("TIMESTAMPTZ", "TIMESTAMP")
    : schema);
}

export async function closeDatabase() {
  await pool.end();
}
