import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Fresh example data in the test database before every end-to-end run.
export default function setup() {
  execFileSync("pnpm", ["exec", "tsx", "src/db/seed/reset.ts"], {
    cwd: fileURLToPath(new URL("../../api", import.meta.url)),
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_OWNER_URL: "postgres://proofpocket_owner:owner_dev_password@localhost:5433/proofpocket_test",
      ACCOUNT_NUMBER_KEY: "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
      SEED_ADMIN_EMAIL: "admin@proofpocket.example",
    },
  });
}
