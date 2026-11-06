import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(backendDirectory, ".env") });

export const config = {
  port: Number(process.env.PORT) || 3001,
  databaseUrl: process.env.DATABASE_URL,
  databaseSsl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  frontendDist: path.resolve(backendDirectory, "../devsphere/dist"),
  uploadDirectory: path.resolve(backendDirectory, "uploads"),
  jwtSecret: process.env.JWT_SECRET || "development-only-change-this-secret",
  tokenLifetime: "7d",
  demoEmail: process.env.DEMO_EMAIL || "demo@devsphere.local",
  demoPassword: process.env.DEMO_PASSWORD || "devsphere123",
  isProduction: process.env.NODE_ENV === "production",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "",
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || "",
  paystackWebhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || "",
  publicAppUrl: process.env.PUBLIC_APP_URL || "http://localhost:5173",
};

if (config.isProduction && config.jwtSecret === "development-only-change-this-secret") {
  throw new Error("JWT_SECRET must be set to a secure value in production.");
}
