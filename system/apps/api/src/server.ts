import { pino } from "pino";
import { createApp, REDACT } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { createMailer } from "./lib/mailer";
import { devVerifier, firebaseVerifier } from "./middleware/auth";

const config = loadConfig();
const log = pino({
  level: config.NODE_ENV === "test" ? "silent" : "info",
  redact: { paths: REDACT, censor: "[hidden]" },
  ...(config.NODE_ENV === "development" ? { transport: { target: "pino-pretty", options: { singleLine: true } } } : {}),
});
const { pool, db } = createDb(config.DATABASE_URL);
const verify = config.AUTH_MODE === "dev" ? devVerifier : firebaseVerifier(config.FIREBASE_PROJECT_ID!);
if (config.AUTH_MODE === "dev") log.warn("AUTH_MODE=dev: accepting development sign-in tokens");

const app = createApp({ config, db, log, mailer: createMailer(config, log), verify });
const server = app.listen(config.PORT, () => log.info(`ProofPocket API on :${config.PORT}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => { void pool.end().then(() => process.exit(0)); });
  });
}
