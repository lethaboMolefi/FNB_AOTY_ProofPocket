# ProofPocket

One shared business record for young founders and township or rural businesses, their funders, incubators, buyers, clients and the public. Team KamosoByte, FNB App of the Year Hackathon 2026.

**ProofPocket never holds or moves money and has no bank integrations.** Clients pay founders directly; ProofPocket records payments and checks proofs. Never add features that hold or move money, call bank APIs, or post through social media APIs (share links only).

## Where things live

- `v2/` is the reference prototype and the specification. Never edit it. If it and the brief disagree, follow the brief and say so.
- `docs/feature-inventory.md` lists every screen, action and rule, with tick boxes per build phase. Section 12 (gaps, all approved) records decisions that change the prototype's behaviour.
- `docs/proposal.md` covers the folder structure, data model and phase plan.
- `system/` is the real system, a pnpm workspace:
  - `packages/shared`: constants (DOCS, categories, sectors…), Zod schemas, and **all business rules** (`src/rules/`). Used by both API and web.
  - `apps/api`: Express + Drizzle. `routes/` (HTTP, validation) → `services/` (logic, audit) → `repositories/` (queries). Schema in `src/db/schema/`, migrations in `drizzle/` (`0001_rls.sql` holds RLS, roles and triggers). Seed in `src/db/seed/`.
  - `apps/web`: React 18 + Vite + Tailwind PWA. `app/` (router, nav, guards), `components/`, `features/<area>/`, `lib/` (api, auth, me, pwa), `sw.ts` (Workbox).
- The app at the repo root (`app.js`, `index.html`, `styles.css`, `v2.zip`) is an older prototype copy, git-ignored.

## Commands (run in `system/`, Node 22)

```
pnpm install
pnpm db:up                    # Postgres 15 in Docker on localhost:5433
pnpm db:reset                 # DEV ONLY: drop, migrate, load example data (refuses production/remote)
pnpm db:generate              # new migration from schema changes (apps/api/drizzle)
pnpm dev                      # API :8787 + web :5173 (proxy /api)
pnpm test                     # shared + API (needs db) + web unit tests
pnpm test:e2e                 # Playwright, phone + desktop, production build, own API (:8788) and test DB
pnpm lint && pnpm typecheck
```

Local env files: `apps/api/.env` and `apps/web/.env`, copied from `.env.example`. With `AUTH_MODE=dev`, sign in by picking a seeded account; email PINs print in the API log (`MAIL_MODE=console`). Production uses Firebase Auth and Gmail SMTP (app password in Secret Manager); the config refuses dev auth and console mail in production.

## Working rules

- Business rules go in `packages/shared/src/rules` with **unit tests written first**. The server is authoritative (readiness is computed on the server).
- Ask before adding a dependency not already in a package.json. Pin exact versions (`save-exact`).
- Small commits with clear messages.
- Authorisation is enforced on the server for every route, and RLS is the second layer: each request runs in `withContext()` (transaction + `SET LOCAL app.user_id / app.role`) as `proofpocket_app`. Roles come from the database, never the client.
- Never log ID numbers, account numbers, PINs or file contents. Account numbers are AES-256-GCM encrypted (`lib/crypto.ts`). `audit_log` is append-only.
- Money is `numeric(12,2)`; display with `R()` from shared (`R12 450`). Dates are South African (`todayZA()`).
- Design: white is the primary colour; colour only for actions and state. Use the tokens in `apps/web/src/styles/index.css`. Phone first, 44 px tap targets, visible focus, `prefers-reduced-motion`.
- Keep the prototype's founder-facing copy (labels, hints, toasts) unless it refers to something simulated.

## Business rules (brief section 8)

- **Verified** = `cipc`, `id`, `bank`, `addr` all verified. A Starter shows only `id` and `addr`.
- **Document checks:** the adviser if the company has an incubator, otherwise the admin checker. Sending back needs a reason and messages the founder. The approval that completes the four makes the company Verified, lists it in the directory and sends "You're verified".
- **Readiness (server only):** cipc 15, id 5, bank 10, tax 15, business plan 10, signed management accounts 15; books updated in the last 7 days 10; no unresolved personal purchases 10; an "Owner salary" entry 5; six months of records 5. 70+ Funding ready, 45+ Getting there, else Early. Record months count the whole history (not capped at six).
- **Flags:** as `flags()` in `v2/app.js`, ported in `rules/flags.ts` (same order and wording).
- **Bookkeeping:** same-amount money out within 7 days needs a second confirmation; personal purchases count against readiness until Paid back; stock-linked entries move quantity; entries are voided, never deleted; offline items carry a client UUID.
- **Payments:** the page shows only the founder's saved details for the allowed methods. Proof checks: amount, reference used, paid on or after the request, file not used before (SHA-256 across all businesses), method allowed. `checking` until the founder confirms in their own bank; only "The money is in my account" records money in. A second "Not received" sets `flagged` and raises a fraud message. Cash can be marked paid directly. Requests expire after 7 days. Changing payment details needs an email PIN and notifies the adviser. Public links use an unguessable token after the `PP-` reference.
- **Suppliers:** changed bank details are pending; payments to that supplier are blocked until confirmed or rejected.
- **Funders:** set-up first; pipeline = Verified companies with sharing ≠ none (plus their own applicants at summary level); entries only with full sharing; offer changes and declines need reasons; founders can ask for a reason; everything goes to `audit_log`.
- **Programme gaps:** not Verified, missing required documents, too few months of records, score too low. Apply only with no gaps and an amount in range.
- **Tenders:** Verified, required documents, minimum months of records.
- **Posts:** shared from the founder's own accounts through share links; feature requests go to admin review.
