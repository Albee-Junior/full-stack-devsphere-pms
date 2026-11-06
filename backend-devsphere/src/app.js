import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "node:path";
import { config } from "./config.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import api from "./routes/index.js";
import { stripeWebhook } from "./routes/billing.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({
    origin: config.clientOrigin.split(",").map((origin) => origin.trim()),
    credentials: true,
  }));
  app.post("/api/billing/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhook);
  app.use(express.json({
    limit: "1.1mb",
    verify(req, _res, buffer) { req.rawBody = buffer; },
  }));
  app.use("/api", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }));
  app.use("/api/auth", rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 25,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Please wait a few minutes and try again." },
  }));
  app.use("/api", api);
  if (config.isProduction) {
    app.use(express.static(config.frontendDist));
    app.use((req, res, next) => {
      if (req.method === "GET" && !req.path.startsWith("/api/")) {
        return res.sendFile(path.join(config.frontendDist, "index.html"), (error) => {
          if (error) next(error);
        });
      }
      return next();
    });
  }
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
