// Writes docs/FEATURE-INVENTORY.md from test/access-matrix.ts (run: pnpm --filter @proofpocket/api exec tsx scripts/inventory-doc.ts).
import { writeFileSync } from "node:fs";
import { MATRIX, NON_HTTP, ROLES, type MatrixRole } from "../test/access-matrix";

const NAMES: Record<MatrixRole, string> = { public: "Public", joining: "Joining", founder: "Founder", funder: "Funder", adviser: "Adviser", buyer: "Buyer", admin: "Admin" };
const cell = (allow: MatrixRole[], role: MatrixRole, token?: boolean) => (token ? "Link" : allow.includes(role) ? "Allowed" : "Denied");

// Web pages and their guards (apps/web/src/app/router.tsx, guards.tsx, nav.ts).
const FOUNDER_PAGES = ["home", "start", "books", "stock", "payments", "cashflow", "markets", "funding", "procurement", "protection", "privacy", "settings", "more"];
const PAGES: { id: string; page: string; what: string; access: Record<MatrixRole, string> }[] = [
  { id: "F-UI-01", page: "/", what: "Sends each person to their own home (sign-in, Join, code step or portal)", access: { public: "→ /sign-in", joining: "→ /join", founder: "→ /app/home", funder: "→ /funder/pipeline", adviser: "→ /adviser/cohort", buyer: "→ /directory", admin: "→ /admin/checks" } },
  { id: "F-UI-02", page: "/sign-in", what: "Sign in; Continue with Google (production)", access: Object.fromEntries(ROLES.map((r) => [r, "Allowed"])) as Record<MatrixRole, string> },
  { id: "F-UI-03", page: "/join", what: "Join: founder track, funder and support-organisation applications, application status", access: { public: "Allowed", joining: "Allowed", founder: "Allowed until joined, then → /app/home", funder: "→ portal", adviser: "→ portal", buyer: "→ /directory", admin: "→ portal" } },
  { id: "F-UI-04", page: "/verify", what: "Google Authenticator set-up or code", access: { public: "→ /sign-in", joining: "→ /join", founder: "When two-step is on", funder: "Required", adviser: "Required", buyer: "When two-step is on", admin: "Required" } },
  { id: "F-UI-05", page: "/directory, /b/:slug", what: "Public directory and business pages", access: Object.fromEntries(ROLES.map((r) => [r, "Allowed"])) as Record<MatrixRole, string> },
  { id: "F-UI-06", page: "/pay/:ref-token", what: "Client payment page", access: Object.fromEntries(ROLES.map((r) => [r, "Link"])) as Record<MatrixRole, string> },
  { id: "F-UI-07", page: "/privacy-notice", what: "Privacy notice", access: Object.fromEntries(ROLES.map((r) => [r, "Allowed"])) as Record<MatrixRole, string> },
  { id: "F-UI-08", page: `/app/{${FOUNDER_PAGES.join(", ")}}`, what: "Founder portal (12 pages + More on phones)", access: { public: "→ /sign-in", joining: "→ /join", founder: "Allowed", funder: "→ own portal", adviser: "→ own portal", buyer: "→ /directory", admin: "→ own portal" } },
  { id: "F-UI-09", page: "/funder/{setup, pipeline, applications, programmes}", what: "Funder portal (set-up first)", access: { public: "→ /sign-in", joining: "→ /join", founder: "→ /app/home", funder: "Allowed", adviser: "→ own portal", buyer: "→ /directory", admin: "→ own portal" } },
  { id: "F-UI-10", page: "/adviser/{cohort, checks, attention, support}", what: "Incubator (adviser) portal", access: { public: "→ /sign-in", joining: "→ /join", founder: "→ /app/home", funder: "→ own portal", adviser: "Allowed", buyer: "→ /directory", admin: "→ own portal" } },
  { id: "F-UI-11", page: "/admin/{checks, applications, organisations, reports, features, flagged, tenders}", what: "Admin portal", access: { public: "→ /sign-in", joining: "→ /join", founder: "→ /app/home", funder: "→ own portal", adviser: "→ own portal", buyer: "→ /directory", admin: "Allowed" } },
];

const modules = [...new Set(MATRIX.map((e) => e.module))];
let md = `# ProofPocket feature inventory

Built from the code on branch \`dashboard-cleanup\` (25 Oct 2026), not from the prototype:
- API endpoints come from \`apps/api/src/routes/*.ts\` and \`app.ts\`. The guard on each route gives the roles.
- Pages come from \`apps/web/src/app/router.tsx\`, \`guards.tsx\` and \`nav.ts\`.
- Jobs come from \`apps/api/src/jobs.ts\`, and emails from every \`mailer.send\`.

The endpoint tables are generated from [\`system/apps/api/test/access-matrix.ts\`](../system/apps/api/test/access-matrix.ts). The test \`access-matrix.test.ts\` does two things:
- calls **every endpoint as every role**, and checks the result against this matrix
- **fails if the API serves an endpoint that isn't listed here**, so this inventory can't silently go out of date

## Roles

| Role | What it is | Where it comes from |
|---|---|---|
| **Public** | Not signed in (clients on a payment page, directory visitors) | No token; database context \`public\` |
| **Joining** | Signed in, but no ProofPocket account yet: a founder part-way through Join, or a funder/NGO applicant | Valid token with no \`users\` row; database context \`joining\` |
| **Founder** | Business owner (Starter or Verified) | \`user_role = founder\` |
| **Funder** | Person at a verified funder; Google Authenticator required | \`user_role = funder\` |
| **Adviser** | Person at an incubator or NGO; Google Authenticator required | \`user_role = adviser\` |
| **Buyer** | Person at a buyer organisation, invited by the admin; no portal of its own (home is the public directory) | \`user_role = buyer\` |
| **Admin** | ProofPocket checker and administrator; Google Authenticator required | \`user_role = admin\` |

**Access values**
- **Allowed:** the role passes access control.
- **Denied:** refused with 401 (signed out), 403 (wrong role or no account), or 409 \`already_joined\` (Join, for people with an account).
- **Link:** no role gives access; a valid payment-page token, signed storage link or PayFast signature does, and every role gets the same answer without one.
- **Not applicable:** see the notes; it is used for system jobs.

## 1. API features (${MATRIX.length} endpoints in ${modules.length} modules)

`;
for (const m of modules) {
  md += `### ${m}\n\n| ID | Feature | Method and endpoint | Page | Roles with access | Notes |\n|---|---|---|---|---|---|\n`;
  for (const e of MATRIX.filter((x) => x.module === m)) {
    const who = e.token ? "Anyone with a valid link or signature" : e.allow.length === ROLES.length ? "Everyone" : e.allow.map((r) => NAMES[r]).join(", ");
    md += `| ${e.id} | ${e.feature} | \`${e.method} ${e.path}\` | ${e.ui} | ${who} | ${e.note ?? ""} |\n`;
  }
  md += "\n";
}

md += `## 2. Pages (web app)\n\n| ID | Page | What it is | ${ROLES.map((r) => NAMES[r]).join(" | ")} |\n|---|---|---|${ROLES.map(() => "---").join("|")}|\n`;
for (const p of PAGES) md += `| ${p.id} | \`${p.page}\` | ${p.what} | ${ROLES.map((r) => p.access[r]).join(" | ")} |\n`;
md += `\nA redirect ("→") is how the web app refuses a page; the API behind it refuses the same role with 401/403 (section 4).\n\n`;

md += `**Menus.** Founder sidebar (desktop): Home · Start: Registration steps · Trade: Bookkeeping, Stock (hidden for services businesses) · Get paid: Payments · Manage cash flow: Cash flow · Reach formal markets: Profile & marketing, Funding readiness, Procurement · Stay safe: Fraud protection, Privacy & sharing · Account: Business settings. Phone tab bar: Home, Books, Get paid, Markets, More. Funder: Company pipeline, Applications, Programmes & requirements. Adviser: Cohort board, Document checks, Needs attention, Support log. Admin: Checker queue, Applications, Organisations, Reports, Feature requests, Flagged payments, Tenders & buyers. Each portal menu shows waiting counts (\`/me/counts\`).\n\n`;

md += `## 3. Features without an endpoint of their own\n\n| ID | Module | Feature | Where | Who |\n|---|---|---|---|---|\n`;
for (const n of NON_HTTP) md += `| ${n.id} | ${n.module} | ${n.feature} | ${n.where} | ${n.roles} |\n`;

md += `\n## 4. Role-by-feature access matrix (API)\n\n| ID | Feature | ${ROLES.map((r) => NAMES[r]).join(" | ")} |\n|---|---|${ROLES.map(() => "---").join("|")}|\n`;
for (const e of MATRIX) md += `| ${e.id} | ${e.feature} | ${ROLES.map((r) => cell(e.allow, r, e.token)).join(" | ")} |\n`;
md += `| F-JOB-01, F-JOB-02 | Background jobs | ${ROLES.map(() => "Not applicable").join(" | ")} |\n`;

const counts = Object.fromEntries(ROLES.map((r) => [r, MATRIX.filter((e) => !e.token && e.allow.includes(r)).length]));
md += `\n**Totals:** ${MATRIX.length} API endpoints, ${PAGES.length} page groups, ${NON_HTTP.length} other features. Endpoints allowed per role, not counting link-only ones (${MATRIX.filter((e) => e.token).length}): ${ROLES.map((r) => `${NAMES[r]} ${counts[r]}`).join(", ")}.\n`;

writeFileSync(new URL("../../../../docs/FEATURE-INVENTORY.md", import.meta.url), md);
console.log("written", MATRIX.length, "endpoints");
