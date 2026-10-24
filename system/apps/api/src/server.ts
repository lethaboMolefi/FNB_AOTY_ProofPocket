import { pino } from "pino";
import { createApp, REDACT } from "./app";
import { loadConfig } from "./config";
import { createDb } from "./db/client";
import { createMailer } from "./lib/mailer";
import { createStore } from "./lib/storage";
import { devVerifier, firebaseVerifier, localVerifier } from "./middleware/auth";

const config = loadConfig();
const log = pino({
  level: config.NODE_ENV === "test" ? "silent" : "info",
  redact: { paths: REDACT, censor: "[hidden]" },
  ...(config.NODE_ENV === "development" ? { transport: { target: "pino-pretty", options: { singleLine: true } } } : {}),
});
const { pool, db } = createDb(config.DATABASE_URL);
const verify = config.AUTH_MODE === "firebase" ? firebaseVerifier(config.FIREBASE_PROJECT_ID!)
  : config.AUTH_MODE === "local" ? localVerifier(config.OTP_SECRET) : devVerifier(config.OTP_SECRET);
if (config.AUTH_MODE !== "firebase") log.warn(`AUTH_MODE=${config.AUTH_MODE}: development sign-in, never for production`);

const app = createApp({ config, db, log, mailer: createMailer(config, log), verify, store: createStore(config) });
const server = app.listen(config.PORT, () => log.info(`ProofPocket API on :${config.PORT}`));

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => { void pool.end().then(() => process.exit(0)); });
  });
}
