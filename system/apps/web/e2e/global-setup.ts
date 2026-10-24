import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { E2E_PASSWORD, clearTotpStore } from "./helpers";

// Fresh example data in the test database before every end-to-end run.
export default function setup() {
  rmSync(fileURLToPath(new URL("../.e2e-mail", import.meta.url)), { recursive: true, force: true });
  clearTotpStore();
  execFileSync("pnpm", ["exec", "tsx", "src/db/seed/reset.ts"], {
    cwd: fileURLToPath(new URL("../../api", import.meta.url)),
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_OWNER_URL: "postgres://proofpocket_owner:owner_dev_password@localhost:5433/proofpocket_test",
      ACCOUNT_NUMBER_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      SEED_ADMIN_EMAIL: "admin@proofpocket.example",
      SEED_FIXED_PASSWORD: E2E_PASSWORD,
    },
  });
}
