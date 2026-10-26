// pnpm test:report — runs every test suite and writes a summary for the admin's Testing page
// (apps/api/testing/results.json), with copies of docs/TEST-CASES.md and docs/FEATURE-STATUS-REPORT.md.
// Needs the local database (pnpm db:up), like pnpm test and pnpm test:e2e.
import { execFileSync, spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "apps/api/testing");
const tmp = join(tmpdir(), `pp-test-report-${process.pid}`);
mkdirSync(out, { recursive: true }); mkdirSync(tmp, { recursive: true });

const vitest = (name, filter) => {
  const file = join(tmp, `${filter.replace(/\W/g, "_")}.json`);
  const t0 = Date.now();
  spawnSync("pnpm", ["--filter", filter, "exec", "vitest", "run", "--reporter=default", "--reporter=json", `--outputFile=${file}`], { cwd: root, stdio: "inherit" });
  const j = JSON.parse(readFileSync(file, "utf8"));
  const failures = j.testResults.flatMap((f) => f.assertionResults.filter((a) => a.status === "failed").map((a) => a.fullName));
  return { name, passed: j.numPassedTests, failed: j.numFailedTests, skipped: j.numPendingTests + j.numTodoTests, durationMs: Date.now() - t0, failures };
};

function playwright() {
  const file = join(tmp, "e2e.json");
  const t0 = Date.now();
  spawnSync("pnpm", ["--filter", "@proofpocket/web", "exec", "playwright", "test", "--reporter=list,json"], { cwd: root, stdio: "inherit", env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: file } });
  const j = JSON.parse(readFileSync(file, "utf8"));
  const failures = [];
  const walk = (s, path) => {
    for (const spec of s.specs ?? []) for (const t of spec.tests) if (t.status === "unexpected") failures.push(`[${t.projectName}] ${[...path, spec.title].join(" › ")}`);
    for (const c of s.suites ?? []) walk(c, [...path, c.title]);
  };
  for (const s of j.suites) walk(s, [s.title]);
  return { name: "Browser (end-to-end, phone and desktop)", passed: j.stats.expected + (j.stats.flaky ?? 0), failed: j.stats.unexpected, skipped: j.stats.skipped, durationMs: Date.now() - t0, failures };
}

const suites = [
  vitest("Business rules (shared)", "@proofpocket/shared"),
  vitest("API and database (incl. access matrix: every endpoint × every role)", "@proofpocket/api"),
  vitest("Web unit", "@proofpocket/web"),
  playwright(),
];
const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
writeFileSync(join(out, "results.json"), JSON.stringify({ ranAt: new Date().toISOString(), commit, suites }, null, 1) + "\n");
for (const f of ["TEST-CASES.md", "FEATURE-STATUS-REPORT.md"]) copyFileSync(join(root, "..", "docs", f), join(out, f));
rmSync(tmp, { recursive: true, force: true });
const total = suites.reduce((a, s) => ({ passed: a.passed + s.passed, failed: a.failed + s.failed }), { passed: 0, failed: 0 });
console.log(`\nTest report: ${total.passed} passed, ${total.failed} failed → apps/api/testing/results.json`);
process.exit(total.failed ? 1 : 0);
