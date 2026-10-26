import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { Router } from "express";
import helmet from "helmet";
import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import type { Config } from "./config";
import type { Db } from "./db/client";
import type { Mailer } from "./lib/mailer";
import type { FileStore } from "./lib/storage";
import { authenticate, type TokenVerifier } from "./middleware/auth";
import { errorHandler, limits, notFoundHandler, useRateLimitStore } from "./middleware/http";
import { PostgresRateLimitStore } from "./lib/rate-limit-store";
import { buildOpenApi } from "./openapi";
import { authRoutes } from "./routes/auth";
import { checkRoutes } from "./routes/checks";
import { umlRoutes } from "./routes/uml";
import { fileRoutes } from "./routes/files";
import { founderBookRoutes } from "./routes/founder-books";
import { founderPayRoutes } from "./routes/founder-pay";
import { payRoutes } from "./routes/pay";
import { founderMarketRoutes } from "./routes/founder-markets";
import { funderRoutes } from "./routes/funder";
import { adviserRoutes } from "./routes/adviser";
import { adminRoutes } from "./routes/admin";
import { publicRoutes } from "./routes/public";
import { countRoutes } from "./routes/counts";
import { founderDocRoutes } from "./routes/founder-docs";
import { joinRoutes } from "./routes/join";

export interface Deps {
  config: Config;
  db: Db;
  log: Logger;
  mailer: Mailer;
  verify: TokenVerifier;
  store: FileStore;
}

/** Fields that must never reach the logs. */
export const REDACT = ["req.headers.authorization", "req.headers.cookie", "*.accountNumber", "*.idNumber", "*.code", "*.password"];

export function createApp(deps: Deps) {
  useRateLimitStore(deps.config.RATE_LIMIT_STORE === "postgres" ? (name) => new PostgresRateLimitStore(deps.db, name) : undefined);
  const app = express();
  app.disable("x-powered-by");
  // Firebase Hosting and Cloud Run's front end sit in front; trust exactly that many hops for client IPs (rate limits).
  app.set("trust proxy", deps.config.TRUST_PROXY_HOPS);

  app.use(pinoHttp({ logger: deps.log, genReqId: (req) => (req.headers["x-request-id"] as string) || randomUUID(), quietReqLogger: true }));
  app.use(helmet());
  app.use(cors({ origin: deps.config.WEB_ORIGIN.split(",").map((s) => s.trim()), maxAge: 600 }));
  app.use(express.json({ limit: "100kb" }));
  // PayFast ITN webhooks arrive as application/x-www-form-urlencoded.
  app.use(express.urlencoded({ extended: false, limit: "50kb" }));

  const v1 = Router();
  v1.use(limits.general());
  v1.get("/health", (_req, res) => { res.json({ ok: true }); });
  const openapi = buildOpenApi();
  v1.get("/openapi.json", (_req, res) => { res.json(openapi); });
  v1.use(authenticate(deps.db, deps.verify));
  v1.use(authRoutes(deps));
  v1.use(joinRoutes(deps));
  v1.use(fileRoutes(deps));
  v1.use(founderDocRoutes(deps));
  v1.use(founderBookRoutes(deps));
  v1.use(founderPayRoutes(deps));
  v1.use(payRoutes(deps));
  v1.use(founderMarketRoutes(deps));
  v1.use(funderRoutes(deps));
  v1.use(adviserRoutes(deps));
  v1.use(adminRoutes(deps));
  v1.use(publicRoutes(deps));
  v1.use(countRoutes(deps));
  v1.use(checkRoutes(deps));
  v1.use(umlRoutes(deps));

  app.use("/api/v1", v1);
  app.use(notFoundHandler);
  app.use(errorHandler(deps.log));
  return app;
}
