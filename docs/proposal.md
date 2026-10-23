# ProofPocket build proposal

For approval before scaffolding. Covers the folder structure, data model, phase plan, the dependencies I'd need to add, and the decisions that block phase 1 or 2. The gaps found in the prototype are in `docs/feature-inventory.md`, section 12.

## 1. Folder structure

```
ProofPocket/
├── CLAUDE.md                     stack, commands, section 8 rules, where things live, "v2/ is the reference"
├── package.json  pnpm-workspace.yaml  tsconfig.base.json  eslint.config.js  .npmrc (save-exact)
├── docker-compose.yml            Postgres 15 (+ fake-gcs-server for local uploads)
├── .github/workflows/ci.yml      typecheck, lint (+ security rules), unit, API, e2e, pnpm audit, Semgrep, gitleaks
├── docs/                         feature-inventory.md, proposal.md, adr/
├── v2/                           prototype, untouched
├── packages/shared/
│   └── src/
│       ├── constants.ts          DOCS, JOIN_DOCS, START_STEPS, TYPES, SECTORS, IN/OUT_CATS, METHODS, RAILS, PROVINCES, STAGES, SUPPORT_TYPES
│       ├── schemas/              Zod: join, entry, stock, payment-request, proof, profile, post, programme, offer, …
│       ├── rules/                readiness, flags, verification, journey, programme-gaps, tender-eligibility,
│       │                         proof-checks, duplicate-check, cashflow, record-months, statement-matching
│       ├── format.ts             R(), shortDate(), slug()
│       └── *.test.ts             written first, one per rule
├── apps/api/
│   └── src/
│       ├── app.ts  server.ts  config.ts (Zod-validated env)
│       ├── db/                   schema/*.ts (Drizzle), migrations/, rls.sql, client.ts, seed/ (data.ts from seed(), run.ts)
│       ├── middleware/           auth (firebase-admin), require-role, db-context (txn + SET LOCAL), rate-limit, validate, errors
│       ├── routes/               auth, me, join, founder/*, pay, funder, adviser, admin, public  (→ /api/v1)
│       ├── services/             one per area; calls the shared rules; writes activity and audit_log
│       ├── repositories/         Drizzle queries only
│       ├── lib/                  storage (signed URLs, SHA-256), crypto (AES-256-GCM account numbers),
│       │                         file-signature, statements/ (CSV parsers per bank), otp, mailer, audit
│       ├── jobs/                 expire requests, expire documents, re-hash files (Cloud Scheduler → Cloud Run)
│       └── openapi.ts
│   └── test/                     Supertest + test DB
├── apps/web/
│   ├── vite.config.ts  tailwind.config.ts  index.html  public/icons/
│   └── src/
│       ├── main.tsx  app/ (router per role, providers, auth guard)  sw.ts (Workbox injectManifest)
│       ├── components/ui/        Button, Pill, Panel, Stat, Ring, BarChart, Sparkline, Checklist, Timeline, Steps,
│       │                         Notice, Drawer, Toast, Field, Seg, Chip, RadioCard, QrBox, CopyRow, Upload
│       ├── components/layout/    FounderShell (rail + bottom tabs), PortalShell
│       ├── features/             join/  founder/{home,start,books,stock,payments,cashflow,markets,funding,
│       │                         procurement,protection,privacy,settings}/  pay/  profile/  directory/
│       │                         funder/  adviser/  admin/
│       └── lib/                  api client, query keys, offline outbox (idb), upload (compress → signed PUT), sw-update
│   └── e2e/                      Playwright, phone + desktop projects
└── infra/                        terraform/ (network, sql, run, storage, secrets, scheduler, budget), firebase.json (headers, /api rewrite)
```

Serving `/api` through a Firebase Hosting rewrite to Cloud Run keeps the web app and API on one origin. That makes CORS and CSP simpler and keeps the ID token off third-party origins.

## 2. Data model

The brief's tables, with these changes. All tables have UUID keys and `created_at`/`updated_at`. Money is `numeric(12,2)`. Every company-owned table has `company_id` with RLS on it. Every row from the seed has `is_example = true`.

| Table | Changes to the brief, and why |
|---|---|
| `organisations` | + `kind` (Grant/Loan/Equity/Blended for funders; buyer kind), `wants`, `sectors text[]` for buyers. Prototype data needs them. |
| `users` | + `firebase_uid` unique, `email`, `display_name`, `is_lead` (incubator lead who can invite colleagues). One founder owns one company. |
| `companies` | + `legal_name`, `slug` unique, `sector` from a fixed list, `opening_balance_date`, `account_in_business_name boolean`. Incubator membership moves to `incubator_memberships` (status requested / active / left) so a founder can change incubator. |
| **`files`** (new) | One row per stored object: bucket path, purpose, mime, size, sha256 (indexed), uploaded_by. Documents, receipts, proofs and statements point here, so signed URLs, signature checks and hashing live in one place. |
| `documents` | One row per upload, for version history; the latest is the current one. + `file_id`, `expires_on`. |
| `ledger_entries` | + `source` (manual / statement / proof / cash_request / restock / supplier_payment / cash_payout), `payment_request_id`, `statement_line_id`, `slip_number` unique per company, `paid_back_at`, `voided_at` + `void_reason`. Corrections void the old entry and add a new one; nothing is hard-deleted. |
| **`stock_movements`** (new) | `client_uuid` unique, `stock_item_id`, `delta`, `reason`, `ledger_entry_id`. Offline stock changes sync safely: quantity = sum of movements, not a number overwritten by whichever phone syncs last. |
| `monthly_history` | `month`, `money_in`, `money_out`, `source = self_reported`. |
| `suppliers` | As the brief. Plus `supplier_bank_changes` history (requested, confirmed/rejected, by whom) for the audit trail. |
| `payment_details` | One row per version; the latest is current. `account_number_enc` + `account_last4`. |
| `payment_requests` | + `public_token` (unguessable, used in the link), `rails text[]`, `cancelled_at`. Statuses as the brief. |
| `payment_proofs` | One row per submission; `status` submitted / confirmed / rejected. The reuse check uses `files.sha256` across all companies. |
| **`otp_challenges`** (new) | Hashed code, purpose (sign-in, change payment details), expiry, attempts. Needed for the email one-time PIN. |
| `messages` | + `kind` (system / organisation / client_flag / checked_by_founder), `sender_org_id`. **`sender_watchlist`** (new) for "Report and block", if you accept item 2 below. |
| `programmes` | + `status` (open/closed). `programme_requirements` = (programme_id, doc_type). |
| `applications`, `offers` | `offers.reason` required except the first; `changed_by`. Status changes written to `audit_log`. |
| `tenders` | + `buyer_org_id` (nullable), `sectors text[]`, `closes_on`, `min_months`. |
| `intro_requests`, `tender_interests` | + `status` (requested / arranged / declined), `handled_by`. |
| `reports` | `target_type` (company / payment_request / post), `target_id`, `reason`, `status`, `resolved_by`. |
| `activity`, `audit_log` | `audit_log` is append-only: the app role has INSERT and SELECT only, and a trigger blocks UPDATE and DELETE. |

**RLS:** the policies read `current_setting('app.user_id')` and `app.role`. A founder sees rows where they own the company. An adviser sees companies with an active membership in their organisation. A funder sees Verified companies with sharing ≠ none, plus its own applicants (inventory 12.20); entries need sharing = full. Admin sees everything. The public payment page and directory use their own narrow read-only queries through a separate `public` role, which can only read the views the page needs.

## 3. Phase plan

The brief's six phases, with two changes: phase 5 is split in two because it is about twice the size of the others, and each phase starts with the shared-rule tests it needs.

| Phase | Contents | Check |
|---|---|---|
| **1 Foundations** | git init, monorepo, shared constants + rule tests (readiness, flags, verification), Drizzle schema + migrations + RLS, Docker Compose, Express with auth/role/db-context middleware and error format, React shell with white tokens, role routing, rail + bottom tabs, PWA manifest + SW + update prompt, seed + `pnpm db:reset` (dev only), CLAUDE.md, CI | Installs on an Android emulator; opens offline to the shell; RLS tests prove a founder can't read another company |
| **2 Join and Start** | Sign-up + join wizard, signed uploads + signature check + SHA-256, Registration steps, adviser document queue, admin checker queue, Verified transition + message, document expiry | Playwright: join → upload → approve ×4 → Verified |
| **3 Trade and cash flow** | Bookkeeping, offline outbox, duplicate and personal checks, stock + movements, statement CSV import + "Already in your books" matching, earlier months, Business settings, cash flow, server readiness, Home | Offline entries sync exactly once |
| **4 Get paid and stay safe** | Payment details + email PIN, requests + QR + WhatsApp, `/pay/:token`, proofs + checks + confirm/reject/flag, expiry job, cash payouts, suppliers + holds, fraud messages (+ "Check a message"), privacy | Full payment flow including the second-rejection flag |
| **5a Markets and funders** | Profile, `/b/:slug`, posts + share links, directory, funder set-up, pipeline, drawer, applications + offers + audit log, programmes | A funder can't see Starter or `none` companies |
| **5b Incubators, tenders, admin** | Cohort board, needs attention, support log, stage/adviser moves, buyers + introductions, tenders + interest, admin portal (orgs, reports, features, flagged requests, tenders) | Every row in `feature-inventory.md` ticked |
| **6 Deploy** | Terraform, Cloud Run, Firebase Hosting, Cloud SQL migrations, Scheduler jobs, smoke tests, Lighthouse | PWA and accessibility 90+ on founder Home |

## 4. Dependencies not named in the brief (asking before adding)

| Package | Why |
|---|---|
| `firebase` (web SDK) | Client sign-in; implied by Firebase Auth |
| `helmet`, `cors`, `express-rate-limit` | Named in section 11 as features; these are the standard packages |
| `@google-cloud/storage` | Signed URLs |
| `file-type` | Checking file type by signature |
| `@asteasolutions/zod-to-openapi` | OpenAPI from the Zod schemas |
| `papaparse` | Statement CSV parsing |
| `pino` + `pino-http` | Structured logs with redaction of ID and account numbers |
| `drizzle-kit`, `@testing-library/react`, `eslint-plugin-security`, `msw` | Migrations and tests |
| An email provider SDK | See decision 1 |

## 5. Decisions (approved 24 October 2026)

1. **Email one-time PIN:** the API generates the PIN (`otp_challenges`, HMAC-hashed, 10 minutes, 5 tries, 5 per hour) and sends it from the team's Gmail account over SMTP with an app password. The password goes in Secret Manager; in development, PINs print to the API log. Gmail allows about 500 messages a day, which is enough for the hackathon. Move to a transactional provider before a public launch.
2. **Section 12 of the inventory:** all recommendations approved as written.
3. **Folder:** the real system lives in `system/`. The old prototype copy at the repo root is git-ignored, and `v2/` is untouched.
4. **Git:** `main`, pushed to https://github.com/lethaboMolefi/FNB_AOTY_ProofPocket.
5. **Data location:** Firebase Auth keeps accounts outside South Africa; everything else stays in `africa-south1`. Region availability gets checked in phase 6.

## 6. Changes from the brief made during phase 1

- **Node 22 LTS instead of Node 20.** Node 20 reached end-of-life in April 2026, and `firebase-admin` 14 (needed to drop the unpatched `node-forge`) requires Node 22.
- **zod 4 instead of zod 3.** Every zod 3 release is affected by GHSA-mrhx-c7xc-m3w5 (memory exhaustion on oversized input); it is fixed in 4.6.6.
- **`@firebase/app` + `@firebase/auth` instead of the `firebase` umbrella package.** The umbrella pulls in Firestore and a vulnerable gRPC. ProofPocket uses Firebase only for sign-in.
- Other upgrades to patched releases: Express 4.22.3, Drizzle ORM 0.45.4 / drizzle-kit 0.31.11, nodemailer 10.0.16, React Router 6.30.6, React Hook Form 7.89.0. `pnpm audit --prod` shows no high or critical advisories. Two moderate React Router 6 advisories remain; the fix is in React Router 7, a bigger move planned before phase 5.
- **Dependencies added** (from the section 4 list): helmet, cors, express-rate-limit, pino, pino-http, pino-pretty (dev), @asteasolutions/zod-to-openapi, nodemailer, drizzle-kit, esbuild (API bundle), workbox-* and workbox-window, @testing-library/react, jsdom, eslint-plugin-security, eslint-plugin-react-hooks, globals. `@google-cloud/storage`, `file-type`, `papaparse`, `idb` and `qrcode` arrive in the phases that use them.
