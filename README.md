# ProofPocket

**One shared business record for young founders and township or rural businesses, their funders, incubators, buyers, clients and the public.** Everything a founder does builds proof that others can trust: checked documents, live books, payments confirmed against the founder's own bank, and a readiness score funders can rely on. Fraud protection runs underneath every step.

Built by team **KamosoByte** for the FNB App of the Year Hackathon 2026, in answer to: *How might digital tools help young founders and township or rural businesses start, trade, get paid, manage cash flow, and reach formal markets?*

> **ProofPocket never holds or moves money and has no bank integrations.** Clients pay founders directly with PayShap, EFT, card machines or cash. ProofPocket records payments and checks proofs of payment.

---

## Contents

1. [What's in this repository](#whats-in-this-repository)
2. [Build status](#build-status)
3. [Quick start](#quick-start)
4. [Signing in](#signing-in)
5. [Two-step sign-in with Google Authenticator](#two-step-sign-in-with-google-authenticator)
6. [Everyday commands](#everyday-commands)
7. [How it's built](#how-its-built)
8. [Security](#security)
9. [Troubleshooting](#troubleshooting)
10. [Deploying to Google Cloud](#deploying-to-google-cloud)

---

## What's in this repository

| Path | What it is |
|---|---|
| [`system/`](system/) | **The real system**: a pnpm workspace with the API, the web app (a PWA) and the shared business rules. |
| [`v2/`](v2/) | The original prototype (`index.html`, `app.js`, `styles.css`). It is the specification and is never edited. |
| [`docs/feature-inventory.md`](docs/feature-inventory.md) | Every screen, action and rule from the prototype, with a tick box per build phase. Section 12 lists the gaps found and the approved decisions. |
| [`docs/proposal.md`](docs/proposal.md) | Folder structure, data model, phase plan, approved decisions and the ways the build differs from the brief. |
| [`CLAUDE.md`](CLAUDE.md) | Working notes for AI-assisted development: commands, rules, where things live. |

Inside `system/`:

```
system/
├── packages/shared   Business rules (readiness, flags, verification, proof checks, …), constants and Zod schemas, with unit tests
├── apps/api          Node + Express + Drizzle + PostgreSQL (row-level security), routes → services → repositories
└── apps/web          React + Vite + Tailwind PWA: founder, funder, adviser and admin portals, public pages
```

## Build status

The build runs in phases (brief section 13). Each phase is committed and pushed separately.

| Phase | What | State |
|---|---|---|
| 1 | Foundations: monorepo, schema, RLS, API, PWA shell, seed | ✅ Done |
| 2 | Join and Start: join wizard, signed uploads, SHA-256, document checks, Verified | ✅ Done |
| — | Secure sign-in: passwords, lockout, Google Authenticator two-step sign-in | ✅ Done |
| 3 | Trade and cash flow: books, offline outbox, statements, stock, cash flow, Home | ✅ Done |
| 4 | Get paid and stay safe: payment requests, public pay page, proofs, suppliers, fraud | ⏳ Next |
| 5 | Formal markets and the other portals | ⏳ |
| 6 | Deploy to Google Cloud (`africa-south1`) | ⏳ Needs access to the Google Cloud project |

Screens not built yet show a "Being built" notice naming their phase.

## Quick start

### What you need

- **Node.js 26** (`node -v`), the latest release (`system/.nvmrc`). With nvm: `nvm install && nvm use` in `system/`.
- **pnpm 12**: `npm install -g pnpm@12.15.0`. Node 25 and later no longer include Corepack.
- **Docker** (Docker Desktop or Docker Engine) for the local PostgreSQL database.
- **Google Authenticator** on your phone, for staff accounts and any founder who turns on two-step sign-in.

### First time

```bash
git clone git@github.com:lethaboMolefi/FNB_AOTY_ProofPocket.git
cd FNB_AOTY_ProofPocket/system

pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Then fill the two secrets in `apps/api/.env`. Each needs 32 random bytes:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # run twice
# ACCOUNT_NUMBER_KEY=<first value>
# OTP_SECRET=<second value>
```

Start the database and load the example data:

```bash
pnpm db:up       # PostgreSQL 18 in Docker, on localhost:5433
pnpm db:reset    # creates the tables and loads the example businesses, funders and incubators
```

`db:reset` prints a table of every example account and its password. See [Signing in](#signing-in).

### Every time

```bash
cd system
pnpm db:up       # only if Docker was restarted
pnpm dev         # API on :8787 and web app on :5173
```

Open **http://localhost:5173**. Press **Ctrl+C** to stop.

## Signing in

There is no list of accounts on the sign-in page; everyone signs in with an email and password.

- **Your example-account passwords** are printed by `pnpm db:reset` and saved in `system/apps/api/.seed-credentials.json` (git-ignored, readable only by you). They stay the same each time you reset. To get new ones, delete that file and run `pnpm db:reset` again.
- **Example accounts:** six founders (`zanele@…` is the Starter salon), four funders (`bophelo@…` still needs to set up a programme), four advisers in two incubators, and the admin (ProofPocket checker), whose email is `SEED_ADMIN_EMAIL` in `apps/api/.env`.
- **Your own account:** choose **Join ProofPocket** on the sign-in page and create one as a founder.

In local development the API checks the password itself (scrypt hashes, generic error messages, and a 15-minute lockout after five wrong passwords). In production, Firebase Authentication does this and the local sign-in is switched off.

## Two-step sign-in with Google Authenticator

ProofPocket's two-step sign-in uses **Google Authenticator only** (6-digit, 30-second codes; RFC 6238). There are no SMS or email codes.

| Account | Two-step sign-in |
|---|---|
| Funder, adviser, admin | **Required.** Set up at the first sign-in, before anything else opens. |
| Founder | **Optional and encouraged.** Home shows a reminder; set it up under **Business settings**. |

**Setting it up**

1. Install Google Authenticator from the Play Store or App Store.
2. Sign in. Staff accounts go straight to **Set up two-step sign-in**; founders open **Business settings → Set up Google Authenticator**.
3. In the app, tap **+ → Scan a QR code** and scan the code on screen. On the same phone, choose **Enter a setup key** and type the key shown.
4. Enter the 6-digit code the app shows for ProofPocket.

From then on, every sign-in asks for a fresh code after the password. A code can be used only once. Five wrong codes lock two-step sign-in for 15 minutes. Turning it off (founders only) needs a current code, so a stolen password can't switch it off. Each change is emailed to the account owner and written to the audit log.

**Lost phone:** an admin can reset the authenticator after checking who the person is. The person then sets it up again at their next sign-in.

## Everyday commands

Run these in `system/`.

| Command | What it does |
|---|---|
| `pnpm dev` | API (:8787) and web app (:5173, proxies `/api`) with live reload |
| `pnpm db:up` | Start PostgreSQL 18 in Docker |
| `pnpm db:reset` | **Development only.** Drop everything, migrate, load the example data, print the passwords |
| `pnpm db:migrate` | Apply new migrations without losing data |
| `pnpm db:generate` | Create a migration from schema changes (`apps/api/src/db/schema`) |
| `pnpm test` | Unit tests (shared rules, web) and API tests (needs the database) |
| `pnpm test:e2e` | Playwright end-to-end tests on phone and desktop. Uses its own test database and API port, so your dev data is never touched |
| `pnpm lint` / `pnpm typecheck` | ESLint (with security rules) and TypeScript |
| `pnpm build` | Production builds of the API (bundled) and web app (with service worker) |

To try the installable app and offline mode, run the production build: `pnpm --filter @proofpocket/web build && pnpm --filter @proofpocket/web preview`, then open http://localhost:4173. The service worker isn't active under `pnpm dev`.

## How it's built

- **Versions:** the latest stable release of everything as of October 2026: Node 26, pnpm 12, PostgreSQL 18, React 19, React Router 7, Vite 8, Tailwind CSS 4, Express 5, Vitest 5, ESLint 10. The one exception is TypeScript 6.0 (not 7), because typescript-eslint doesn't support TypeScript 7's native compiler yet.
- **Web:** React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form + Zod, Workbox (installable PWA, offline app shell, update prompt). Phone first, with white as the primary colour.
- **API:** Node.js, Express, Zod validation, Drizzle ORM, PostgreSQL. Errors are always `{ "error": { "code", "message" } }`. OpenAPI at `/api/v1/openapi.json`.
- **Shared rules:** `packages/shared/src/rules` holds the readiness score, flags, Verified rules, programme gaps, tender eligibility, proof-of-payment checks, duplicate-payment check, stock and cash flow. They are ported line by line from the prototype, unit-tested, and used by both the API and the web app. The server is authoritative.
- **Files:** uploaded straight to storage with 5-minute signed URLs. The API checks the real file type from its first bytes and records a SHA-256 fingerprint. Photos are compressed on the phone first.
- **Hosting (planned):** Cloud Run (API), Firebase Hosting (web), Cloud SQL with private IP only, a private Cloud Storage bucket and Secret Manager, all in `africa-south1` (Johannesburg).

## Security

- **Two layers of access control.** Every route checks the caller's role and ownership, and PostgreSQL row-level security enforces the same rules again. Each request runs in a transaction with `SET LOCAL app.user_id / app.role` as a restricted database role. Founders see only their company, advisers only their incubator's cohort, funders only Verified companies that chose to share, and the payment page only its own request.
- **Roles come from the database**, never the client. A database trigger stops anyone but an admin changing a user's role, organisation or email.
- **Sign-in:** strong password rules, lockout, Google Authenticator two-step sign-in, single-use codes, encrypted authenticator secrets.
- **Data:** bank account numbers and authenticator secrets are encrypted with AES-256-GCM. ID numbers, account numbers, codes and passwords are never logged. `audit_log` is append-only.
- **Web:** Helmet security headers, strict CORS, rate limits on sign-in, uploads and the payment page, and no inline scripts.
- **Supply chain:** exact dependency versions, `pnpm audit`, ESLint security rules, Semgrep and gitleaks in CI.

## Troubleshooting

### `pnpm: command not found`, or the wrong Node version
ProofPocket needs **Node 26** and **pnpm 12**. Check with `node -v` and `pnpm -v`.
- With nvm: `cd system && nvm install && nvm use` (reads `.nvmrc`), then `npm install -g pnpm@12.15.0`.
- Without nvm or admin rights: download Node 26 from nodejs.org, unpack it to `~/.local/node26`, then `export PATH=~/.local/node26/bin:$PATH` (add that line to `~/.bashrc`) and `npm install -g pnpm@12.15.0`.
- Node 25 and later don't include Corepack, so `corepack enable` no longer works.

### `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` or `ERR_PNPM_IGNORED_BUILDS` during install
These are deliberate supply-chain safety rules in `system/pnpm-workspace.yaml`. pnpm won't install a version published less than 24 hours ago, and only esbuild may run an install script. If a brand-new release is refused, wait a day or pin the previous version. Don't turn the rules off.

### `Cannot connect to the Docker daemon`
Start Docker Desktop, or on Linux run `systemctl --user start docker-desktop` (Docker Desktop) or `sudo systemctl start docker` (Docker Engine). Check with `docker ps`.

### Port 5432 or 5433 already in use
ProofPocket's database uses **5433** so it doesn't clash with a local PostgreSQL on 5432. If 5433 is also taken, change the port in `system/docker-compose.yml` and in both `DATABASE_URL` lines in `apps/api/.env`.

### Port 8787 or 5173 already in use
Another `pnpm dev` is probably still running. Stop it with Ctrl+C, or find it with `ss -ltnp | grep -E '8787|5173'`. You can also change `PORT` in `apps/api/.env` (and the proxy in `apps/web/vite.config.ts`).

### `Invalid configuration: …` when the API starts
`apps/api/.env` is missing or a value is wrong; the message names the setting. The most common cause is that `ACCOUNT_NUMBER_KEY` or `OTP_SECRET` is empty or not 32 bytes in base64 (see [First time](#first-time)).

### Errors about a missing column or function after `git pull`
New migrations arrived. Run `pnpm db:migrate`, or `pnpm db:reset` to start fresh with the example data.

### The database won't start after updating (PostgreSQL 15 → 18)
The local database moved to PostgreSQL 18, which stores data differently. Recreate it (this deletes local data, which is only example data): `docker compose down -v && pnpm db:up && pnpm db:reset`.

### "That email and password don't match"
Check `system/apps/api/.seed-credentials.json` for the example accounts' passwords. They were regenerated if that file was deleted. After five wrong tries the account is locked for 15 minutes; `pnpm db:reset` clears it.

### Google Authenticator: "That code isn't right"
- **Clock out of sync.** Codes depend on the time, so the phone and the computer must both use automatic network time. On Android, open Google Authenticator → ⋮ → Settings → **Time correction for codes → Sync now**.
- Use the code shown for **ProofPocket**, not another account, and type it before it changes.
- "That code has already been used": each code works once, so wait for the next one.
- After `pnpm db:reset`, old entries in the app no longer match. Delete the old ProofPocket entry from Google Authenticator and set it up again.

### Locked out of two-step sign-in, or lost the phone
Five wrong codes lock it for 15 minutes; wait and try again. For a lost phone, an admin resets it (`POST /api/v1/admin/users/{id}/reset-authenticator`; a button arrives with the admin portal in phase 5). In local development, `pnpm db:reset` also clears it.

### Uploads fail: "That file isn't a PDF or photo we can open"
Only real PDF, JPG, PNG and WebP files up to 5 MB are accepted, and the type is read from the file's contents, not its name. Renamed files and Word documents are refused. Bank statements must be the CSV export from the banking app.

### The app looks out of date, or the "new version" message keeps coming back
Click **Refresh** on the "A new version is ready" message. If it persists, open developer tools → Application → Service workers → Unregister, then reload. The service worker is only active in the production build (`preview`), not `pnpm dev`.

### End-to-end tests fail to start
- First run: `pnpm --filter @proofpocket/web exec playwright install chromium`.
- The tests start their own API on **8788** and web preview on **4173**; stop anything else using those ports.
- The database must be running (`pnpm db:up`). The tests reset `proofpocket_test` themselves and never touch your dev data.

### API tests fail with "permission denied" or "role does not exist"
The database was created before the init script ran. Recreate it: `docker compose down -v && pnpm db:up && pnpm db:reset`. **This deletes local data.**

### Emails in development
With `MAIL_MODE=console`, nothing is sent; notification emails (such as "Two-step sign-in is on") appear in the API log. To send real email through Gmail, set `MAIL_MODE=smtp`, `SMTP_USER` and an **app password** in `SMTP_PASS` (Google account → Security → App passwords; needs Google two-step verification on that account).

## Deploying to Google Cloud

Phase 6 covers Terraform for `africa-south1`: Cloud SQL (PostgreSQL, private IP only, backups, deletion protection), VPC with Private Service Access, Cloud Run with Direct VPC egress and a least-privilege service account, a private bucket, Secret Manager, Firebase Hosting with security headers, and a billing budget alert. It needs access to the team's Google Cloud project. In production:

- `AUTH_MODE=firebase`, `MAIL_MODE=smtp`, `STORAGE_MODE=gcs`. The API refuses to start with development settings.
- Secrets (`ACCOUNT_NUMBER_KEY`, `OTP_SECRET`, `SMTP_PASS`, database password) live in Secret Manager.
- `pnpm db:reset` refuses to run against production or remote databases.

---

ProofPocket is example data until deployed. Every seeded business, funder, tender and message is marked as example data.
