import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import type { Config } from "./config";
import type { Db } from "./db/client";
import type { Mailer } from "./lib/mailer";
import { authenticate, type TokenVerifier } from "./middleware/auth";
import { errorHandler, limits, notFoundHandler } from "./middleware/http";
import { buildOpenApi } from "./openapi";
import { authRoutes } from "./routes/auth";

export interface Deps {
  config: Config;
  db: Db;
  log: Logger;
  mailer: Mailer;
  verify: TokenVerifier;
}

/** Fields that must never reach the logs. */
export const REDACT = ["req.headers.authorization", "req.headers.cookie", "*.accountNumber", "*.idNumber", "*.code", "*.password"];

export function createApp(deps: Deps) {
  const app = express();
  app.disable("x-powered-by");
  // Cloud Run and Firebase Hosting sit in front; trust one proxy hop for client IPs (rate limits).
  app.set("trust proxy", 1);

  app.use(pinoHttp({ logger: deps.log, genReqId: (req) => (req.headers["x-request-id"] as string) || randomUUID(), quietReqLogger: true }));
  app.use(helmet());
  app.use(cors({ origin: deps.config.WEB_ORIGIN.split(",").map((s) => s.trim()), maxAge: 600 }));
  app.use(express.json({ limit: "100kb" }));

  const v1 = Router();
  v1.use(limits.general());
  v1.get("/health", (_req, res) => { res.json({ ok: true }); });
  const openapi = buildOpenApi();
  v1.get("/openapi.json", (_req, res) => { res.json(openapi); });
  v1.use(authenticate(deps.db, deps.verify));
  v1.use(authRoutes(deps));

  app.use("/api/v1", v1);
  app.use(notFoundHandler);
  app.use(errorHandler(deps.log));
  return app;
}
