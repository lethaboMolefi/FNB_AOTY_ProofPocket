// The admin's Testing page: the demo site and its accounts, the latest automated test results, and the test cases.
// Files in apps/api/testing are refreshed by `pnpm test:report` (system/scripts/test-report.mjs). Admins only.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { DEMO_ADMIN_EMAIL } from "../db/demo-accounts";
import { exampleAccounts } from "../db/seed/accounts";
import { notFound } from "../lib/errors";
import { requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";

const DIR = resolve(process.cwd(), "testing");
const DOCS = { "test-cases": { file: "TEST-CASES.md", title: "Test cases" }, "feature-status": { file: "FEATURE-STATUS-REPORT.md", title: "Feature status report" } } as const;
const read = (f: string) => (existsSync(resolve(DIR, f)) ? readFileSync(resolve(DIR, f), "utf8") : null);

/** TEST-CASES.md tables → rows (one per case), with the section each belongs to. */
export function parseTestCases(md: string) {
  const rows: Record<string, string>[] = [];
  let section = "", head: string[] | null = null;
  const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
  for (const line of md.split("\n")) {
    const h = /^## (?:\d+\. )?(.+)$/.exec(line);
    if (h) { section = h[1]!.trim(); head = null; continue; }
    if (!line.startsWith("|")) { head = null; continue; }
    if (/^\|\s*-/.test(line)) continue;
    const c = cells(line);
    if (!head) { head = c; continue; }
    const r = Object.fromEntries(head.map((k, i) => [k, c[i] ?? ""]));
    if (r.ID) rows.push({ section, ...r });
  }
  return rows.map((r) => ({
    section: r.section!, id: r.ID!, feature: r.Feature ?? "", role: r.Role ?? "", description: r.Description ?? "", steps: r.Steps ?? "",
    expected: r["Expected Result"] ?? "", version: r.Version ?? "", priority: r.Priority ?? "", result: r["Claude Code Result"] ?? "",
    evidence: r["Claude Code Notes/Evidence"] ?? "", manual: r["Manual Result"] ?? "",
  }));
}

export function testingRoutes(deps: Deps) {
  const r = Router();
  const admin = requireUser(["admin"]);

  r.get("/testing", admin, handle(async () => ({
    demo: deps.config.DEMO_URL ? {
      url: deps.config.DEMO_URL,
      // Example data only, on its own server: one shared password for the demo accounts, shown to admins here.
      password: deps.config.DEMO_PASSWORD ?? null,
      accounts: exampleAccounts(DEMO_ADMIN_EMAIL).map((a) => ({ role: a.role, who: a.who, email: a.email })),
    } : null,
    results: (() => { const j = read("results.json"); return j ? JSON.parse(j) : null; })(),
    documents: Object.entries(DOCS).map(([id, d]) => ({ id, title: d.title, available: !!read(d.file) })),
  })));
  r.get("/testing/cases", admin, handle(async () => ({ cases: parseTestCases(read(DOCS["test-cases"].file) ?? "") })));
  r.get("/testing/documents/:id", admin, (req, res, next) => {
    try {
      const id = parse(z.enum(["test-cases", "feature-status"]), req.params.id);
      const text = read(DOCS[id].file);
      if (!text) throw notFound("That document");
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${DOCS[id].file}"`);
      res.send(text);
    } catch (e) { next(e); }
  });
  return r;
}
