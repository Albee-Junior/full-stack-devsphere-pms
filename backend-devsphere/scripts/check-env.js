import { config } from "../src/config.js";

if (!config.databaseUrl) {
  console.error([
    "DevSphere backend configuration is incomplete: DATABASE_URL is missing.",
    "From backend-devsphere, run: Copy-Item .env.example .env",
    "Then start PostgreSQL with: npm run db:up",
    "Edit .env if you use a different PostgreSQL server. See README.md for details.",
  ].join("\n"));
  process.exitCode = 1;
} else {
  let databaseUrl;
  try {
    databaseUrl = new URL(config.databaseUrl);
  } catch {
    console.error("DATABASE_URL must be a valid PostgreSQL connection URL.");
    process.exitCode = 1;
  }
  if (databaseUrl && !["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    console.error("DATABASE_URL must use the postgres:// or postgresql:// protocol.");
    process.exitCode = 1;
  }
}
