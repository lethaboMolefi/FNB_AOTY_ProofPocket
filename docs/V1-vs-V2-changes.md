# V1 vs V2: what the dashboard branch changes

| | Branch | Commit | What it is |
|---|---|---|---|
| **V1** | `main-shadcn-onboarding` | `1c2041a` | What is live on proofpocket-aoty.web.app (25 Oct 2026) |
| **V2** | `origin/dashborad` | `66e55a5` | One commit, "dashboard", by NkgopolengGift (25 Oct 2026, 18:05) |

V2 is built on `main-shadcn-merge` (`dc58488`), not on V1. Both branches then took the `onboarding` branch's redesign separately, in different ways:

- **V1** (`2c7cf87`) used onboarding's look but kept ProofPocket's tested API, and added safe funder/NGO applications.
- **V2** (`66e55a5`) took onboarding's screens *and* its parallel API, then added the dashboard work.

Size of the change: `git diff main-shadcn-onboarding...origin/dashborad` (V2's own changes since the shared base) is 55 files, +13 258 / −1 991. Most of that is `drizzle/meta/0010_snapshot.json` (5 104 lines) and `pnpm-lock.yaml` (2 104 lines). Merging the two branches has 26 conflicting files.

Decisions already made by the project owner (25 Oct):

- PayFast stays as a founder option, **switched off** until the merchant details are approved.
- The email sign-in codes and the `/sign-up` page stay **dropped**: two-step sign-in is Google Authenticator only, and Join is the sign-up page.

---

## 1. In V2 but not in V1

### 1.1 PayFast card/EFT rail (new)

| Part | Where |
|---|---|
| Service: builds the PayFast form, checks the MD5 signature, validates the ITN with PayFast, marks the request paid and books the entry | `apps/api/src/services/payfast.ts` (237 lines) |
| `POST /pay/:ref/payfast/initiate` (public, rate-limited) | `apps/api/src/routes/pay.ts` |
| `POST /payfast/itn` (PayFast's webhook) | `apps/api/src/routes/pay.ts` |
| `express.urlencoded` body parser (50 kB), for ITN posts | `apps/api/src/app.ts` |
| Config: `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`, `PAYFAST_SANDBOX` (defaults to sandbox). Empty ID or key = off | `apps/api/src/config.ts` |
| Migration `0010_marvelous_prima.sql`: adds `payfast` to `pay_method` and `rail`, and `payfast_itn` to `entry_source` | `apps/api/drizzle/` |
| `RAILS.payfast = "Card / EFT (PayFast)"`, and `GATEWAY_RAILS` | `packages/shared/src/constants.ts` |
| Payment page: "PayFast coming soon" notice when the rail is on a request; result banners for `?payfast=success` / `cancelled` | `apps/web/src/features/public/PayPage.tsx` |
| Public payment data includes `ways.payfast` | `apps/api/src/services/payments.ts` |

> **Rule conflict.** CLAUDE.md says ProofPocket must never hold or move money, or use bank or payment-provider integrations. PayFast collects the client's money and pays it to the merchant, and ProofPocket marks the request paid from PayFast's webhook. The owner chose to keep it switched off for now. CLAUDE.md needs updating before it is ever switched on.

> **Migration clash.** V1 already has a migration `0010_identity_applications`, and it is applied in production. V2's `0010_marvelous_prima` must be renumbered (to `0011`) when merging, or migrations will fail.

### 1.2 Notification bell (new)

- `apps/web/src/components/NotificationPanel.tsx` (190 lines): a bell in the founder top bar with an unread count and a slide-out panel. Items can be dismissed, apart from "persistent" ones; dismissals are kept in memory only.
- `FounderShell.tsx` builds the items from `/founder/home` notices (possible scams, proofs to check), whether two-step sign-in is off, whether the business is a Starter, and a fixed note about SARS Turnover Tax (an external link with a hard-coded R335 000 threshold).
- `TopBar.tsx` gains a `right` slot for the bell.

### 1.3 Cash-entry velocity check (new)

- `velocityFlag()` in `packages/shared/src/rules/fraud.ts` returns a warning when there are more than 5 entries in 10 minutes, or more than 15 in an hour.
- `services/books.ts` runs it on manual cash entries and writes the warning to the company's activity feed. It never blocks the entry.
- No unit test was added for it.

### 1.4 Layout changes (new)

- **Bookkeeping:** two columns on desktop (statement import and entry form on the left; totals and entries on the right).
- **Business settings:** two columns (form on the left; Google Authenticator card and a "Your data is private" card on the right).
- **Founder and portal shells:** wider (1 440 px; sidebar 240 px). Portal top bar shows the organisation name in the new style.
- **`BrandMark`** accepts a `className`.
- **`ui/` additions** shared with onboarding: `badge`, `progress`, `radio-group`, `select`, `separator`, `table`, `textarea`, `password-strength`, plus `PageHeader`.
- **New dependencies** (web): `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-select`, `@radix-ui/react-separator`.

### 1.5 Parallel founder API from `onboarding` (new in V2, deliberately not taken in V1)

V2 replaces `founderMarketRoutes` with onboarding's `founderMarketsRoutes` (`routes/founder-markets.ts`, 470 lines). It registers that router **before** `founderPayRoutes`, so these addresses now go to onboarding's handlers:

| Endpoint in V2 | Replaces in V1 |
|---|---|
| `GET /founder/payments`, `POST /founder/payments`, `/:id/received`, `/:id/not-received`, `/:id/cancel` | `GET /founder/payments` (the V1 handler is now shadowed), `/founder/payment-requests`, `/founder/proofs/:id/confirm` and `/reject`, `…/cash`, `PUT /founder/payment-details` |
| `GET /founder/protection`, `POST /founder/protection/report` | `GET /founder/protection` (shadowed), `/founder/messages/:id`, `/founder/check-message`, supplier confirm/reject |
| `GET` and `PUT /founder/privacy` | Same addresses (shadowed); V1 also returns incubators, the adviser and pending requests |
| `GET /founder/funding`, `POST /founder/funding/apply` | `/founder/applications`, `/ask-reason`, `/withdraw` |
| `GET /founder/procurement`, `/procurement/tenders/:id/interest`, `/procurement/buyers/:id/intro` | `/founder/tenders/:id/interest`, `/founder/intros/:id` |
| `GET /founder/markets`, `PUT /founder/markets/profile`, `POST` and `DELETE /founder/markets/posts` | `/founder/profile`, `/founder/posts`, `/posts/:id/shared` |

It also brings back `POST /auth/email-otp/send` and `/verify`, `services/email-otp.ts`, `/join/investor`, `/join/org`, the `/sign-up` page and `SignUp.tsx`.

---

## 2. In V1, unchanged in V2

Everything outside the files listed in sections 1 and 3 is the same. In particular:

- Bookkeeping, statements, stock and cash-flow **rules and services**: only `services/books.ts` gains the velocity check.
- Document upload, checker queue, verification and the "You're verified" flow.
- Funder, adviser and admin portals (apart from the shell layout).
- Public directory, profiles and the payment page (apart from PayFast).
- Two-step sign-in with Google Authenticator; local and Firebase auth.
- The branded HTML emails, CSP, deploy script and production defaults from `main-shadcn-merge`.
- Readiness, flags, eligibility and journey rules in `packages/shared`.

---

## 3. In V1 but missing or changed in V2

These are regressions to restore when merging. V2 doesn't have V1's last four commits (`2c7cf87`, `7e08e9f`, `57678d3`, `1c2041a`).

| Area | V1 | V2 |
|---|---|---|
| Founder API | ProofPocket's tested routes | Onboarding's parallel routes shadow them (see 1.5). V2's Payments, Protection, Privacy, Funding, Procurement and Markets screens call those routes |
| Payments | Cash "Paid me cash", WhatsApp/QR share, payment details behind Google Authenticator, suppliers, cash payouts, offline queue | Only create, list, cancel and check proof |
| Fraud protection | Check a message, mark genuine or block, supplier bank-change hold (confirm/reject), document fingerprints | Report only; the hold text describes a "24-hour hold" that doesn't exist |
| Privacy | Download my data, correction/deletion requests (POPIA), choose/leave incubator | Sharing level only. Its wording says funders see "documents" and advisers can be hidden, both wrong |
| Funding | Readiness ring, gaps per programme, apply with amount, offer history, ask for a reason, withdraw | Onboarding's version without reasons or withdraw |
| Funder/NGO sign-up | Application → admin review → organisation + user created and linked; admin **Applications** page | `/join/investor` and `/join/org` insert an unlinked user and organisation with no review (any signed-in person becomes a funder). `users_org_matches_role` makes it fail |
| Founder identity | SA ID number checked (date + check digit), encrypted, owner/admin only; co-founders stored | ID number and co-founders validated, then discarded (not stored) |
| Email sign-in codes, `/sign-up` | Removed (Google Authenticator only) | Back |
| Google sign-in | Plain-language errors, quiet cancel, clears previous person's cache; `AUTH_DOMAIN` setting in `deploy.sh` | Same code; `deploy.sh` hard-codes the site's own auth domain (works, since that redirect is now approved) |
| Join | Shows which email is used when already signed in; logo leads to sign-in | Hidden email; logo loops back to Join |
| Portal shell | Waiting counts on funder, adviser and admin menus | Counts removed (`useCounts` dropped) |
| Top bar | Asks before signing out with unsent offline entries; "Offline" and "Sign out" visible on phones | Signs out at once; labels hidden on phones |
| Home | "Home" title, prototype notice wording, all notices shown | Business name as title; Starter notice hidden when another shows |
| Colours | `bg-muted` replaced by the surface token (shadcn's `--muted` kept away from text grey) | `bg-muted` used in 30+ places, so text grey becomes a background |
| Wording | "Cash on hand now" | "Cash on hand" |
| Lint | 0 errors | 37 errors (unused imports; 4 "components created during render" in Join) |
| Tests | 206 unit, 46 browser, all passing | V1's browser tests for payments, privacy and join fail against V2's screens (to be confirmed in phase 3) |
