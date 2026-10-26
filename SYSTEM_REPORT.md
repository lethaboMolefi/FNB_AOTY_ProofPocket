# ProofPocket system report

Branch `system-unify`, made from `dashboard-cleanup` (the live site on 26 Oct 2026). It takes the founder dashboard and the sign-up process from `dashborad`.

## How this was checked

- **Code read:**
  - `apps/web/src/app/router.tsx`, `app/nav.ts`, `app/guards.tsx`, every file in `features/`
  - the API's route table, through `apps/api/test/access-matrix.ts`, which a test keeps equal to what the API serves: 136 endpoints
- **Browser walk** (Playwright, production build, phone 412 px and desktop 1280 px), on 26 Oct 2026:
  - **roles:** signed out, founder (Starter `zanele@`, Verified `tumelo@`), funder (`lesedi@`, `kopano@`), adviser (`n.mokoena@`, `l.dube@`), admin (`admin@`)
  - **pages:** every page in each role's menu (108 page visits)
  - **recorded for each page:** console errors, failed requests, `h1` count and size, skipped heading levels, nav links with icons, sideways scroll, tap targets under 40 px, and old CSS classes still in use
- **Tests:**
  - API: `pnpm test`, Vitest against a real PostgreSQL
  - browser: `pnpm test:e2e`, phone and desktop
- **Buyer:** a buyer has no screens of their own. They land on the public directory (BUG-06), so "buyer" below means the public pages.

## 1. Page inventory

**Who can open what**
- **Guards:** the web guards (`RequireRole`, `RequireFunderSetup`) send anyone else to their own home. The API checks the role again on every call, and PostgreSQL row-level security is the third layer.
- **Homes:** founder `/app/home`, funder `/funder/pipeline`, adviser `/adviser/cohort`, admin `/admin/overview`, buyer `/directory`.

### Public (anyone, signed in or not)

| Route | Purpose |
|---|---|
| `/` | Sends each person where they belong: sign-in, Join, the two-step code, or their portal |
| `/sign-in` | Email and password, or Continue with Google (Google only when the site uses Firebase) |
| `/sign-up` | **From dashborad.** Email and password, then a 6-digit email code (local) or Firebase's verification email (live), then Join. Also Continue with Google |
| `/verify` | Google Authenticator: set it up (staff, first sign-in) or enter the code |
| `/join` | **From dashborad.** Choose Business Founder, Investor / Funder, or Incubator / NGO / NPO. Founders: details → documents → consent. Investors and organisations: two steps, then an application the admin approves |
| `/directory` | Verified businesses that list themselves, with search and sector filter |
| `/b/:slug` | One business's public page (Verified badge, services, WhatsApp, report) |
| `/pay/:ref` | A client's payment page: the founder's saved details for the allowed methods, upload proof of payment |
| `/privacy-notice` | The POPIA privacy notice |
| anything else | Page not found |

### Founder (`/app`, role founder, joined)

| Route | Purpose |
|---|---|
| `/app/home` | Today: money in and out, cash, readiness, journey, flags, messages, notifications bell |
| `/app/start` | Registration steps: the four joining documents, CIPC number, then the documents that open funding and tenders |
| `/app/books` | Bookkeeping: entries (offline-capable), statement import, monthly history, personal purchases, void |
| `/app/stock` | Stock items, use and restock (only for business types that hold stock) |
| `/app/payments` | Payment requests and links/QR, proofs to check, payment details (needs Google Authenticator), suppliers, cash out |
| `/app/cashflow` | Cash now, usual month, the next 30 days |
| `/app/markets` | Profile & marketing: public page, QR, posts shared through share links, buyers to meet |
| `/app/funding` | Funding readiness score and checklist; programmes with what's missing; applications and offers |
| `/app/procurement` | Tenders (interest) and buyers (introductions) |
| `/app/protection` | Fraud protection: messages to check, supplier bank changes on hold, document fingerprints |
| `/app/privacy` | Who sees what (funder sharing), incubator membership, data export and POPIA requests |
| `/app/settings` | Business details, opening balance, Google Authenticator |
| `/app/more` | Phone: every page not in the bottom tabs |

### Funder (`/funder`, role funder, verified organisation)

| Route | Purpose |
|---|---|
| `/funder/setup` | Requirements first (the only page until it's done) |
| `/funder/pipeline` | Verified companies that share with funders, by readiness; company drawer |
| `/funder/applications` | Applications to their programmes; change offers (with reason), approve, decline |
| `/funder/programmes` | Programmes and requirements founders see before applying |

### Adviser (`/adviser`, role adviser, incubator or NGO)

| Route | Purpose |
|---|---|
| `/adviser/cohort` | Their companies by support stage; company drawer |
| `/adviser/checks` | Document checks for their companies |
| `/adviser/attention` | Flags across the cohort, most urgent first |
| `/adviser/support` | Support log (interventions) |

### Admin (`/admin`)

| Route | Purpose |
|---|---|
| `/admin/overview` | Platform totals, 30-day trend, what's waiting |
| `/admin/activity` | The audit log with filters and its hash-chain check |
| `/admin/people` | Every account and business; opening a business is audited |
| `/admin/health` | Two-step gaps and lockouts, jobs, failed emails, rate limits |
| `/admin/checks` | Document checks for companies without an incubator |
| `/admin/applications` | Funder and organisation portal applications |
| `/admin/organisations` | Verify organisations, invite people, reset an authenticator |
| `/admin/reports` | Reported businesses, requests and senders |
| `/admin/features` | Directory feature requests |
| `/admin/flagged` | Payment requests flagged after two "Not received" |
| `/admin/tenders` | Tenders and buyers; introductions and interest for companies without an incubator |

## 2. Page-to-page connections

Every portal page is also reachable from its own sidebar (desktop) or tab bar and More (phone). The table lists the other links and redirects found in the code.

| From | Goes to | How |
|---|---|---|
| `/` | `/sign-in`, `/join`, `/verify`, role home | redirect (`RoleHome`) |
| any portal page, wrong role | that person's own home | redirect (`RequireRole`) |
| `/funder/*` before set-up | `/funder/setup` | redirect |
| `/sign-in` | `/join` ("New here? Join ProofPocket"), `/` after sign-in | link, navigate |
| `/sign-up` | `/join` after the code or Google, `/sign-in` | navigate, link |
| `/join` | `/sign-in` (logo, always), `/sign-up` (investor/organisation without a sign-in), `/app/home` or `/app/start` after joining, `/verify`, role home if already joined | link, redirect |
| `/verify` | `/`, `/join`, `/sign-in` | redirect |
| `/app/home` | `/app/start`, `/app/books`, `/app/payments`, `/app/cashflow`, `/app/protection`, journey steps, bell items (`/app/protection`, `/app/payments`, `/app/settings`, `/app/start`) | links |
| `/app/payments` | `/app/settings` (set up Google Authenticator first) | link |
| `/app/markets`, `/app/funding`, `/app/procurement` | `/app/start` ("Get verified") | link |
| `/app/privacy`, privacy prompt | `/privacy-notice` | link |
| founder 2FA prompt | `/app/settings` | link |
| `/directory` | `/b/:slug` | link |
| `/funder/pipeline` | `/funder/applications` | link |
| `/funder/setup` | `/funder/pipeline` after saving | navigate |
| `/adviser/cohort` | `/adviser/checks` | link |
| `/admin/overview` | `/admin/checks`, `/admin/applications`, `/admin/reports`, `/admin/flagged` ("Needs attention") | links |
| a payment request (founder) | `/pay/:ref` (shared over WhatsApp, QR, copy) | share link |
| a profile (founder) | `/b/:slug` (QR, copy, share links) | share link |
| `/privacy-notice`, not found | `/` | link |

## 3. Feature-to-feature connections

| Feature (where) | Feeds into or depends on |
|---|---|
| **Join documents → checks** (founder Join, Registration steps) | The adviser's Document checks (company with an incubator) or the admin's Checker queue (no incubator). The approval that completes `cipc`, `id`, `bank`, `addr` makes the company **Verified**, lists it in `/directory` and sends "You're verified" |
| **Verified** | Opens the funder pipeline (with sharing ≠ none), funding applications (a programme gap), tenders (a requirement), the public badge on `/b/:slug` and `/pay/:ref` |
| **Bookkeeping entries** | Home figures, Cash flow, readiness (books in the last 7 days, owner salary, six months of records, personal purchases), flags, the funder drawer (entries only with full sharing), adviser Needs attention, admin Overview totals |
| **Stock-linked entries** | Stock quantities (sales use, purchases restock) |
| **Payment request → proof → "The money is in my account"** | The only path that records money in from a request (books, Home). A second "Not received" flags it for the admin (`/admin/flagged`) and raises a fraud message. Cash can be marked paid directly |
| **Payment details change** (needs Google Authenticator) | What `/pay/:ref` shows; notifies the incubator's advisers |
| **Supplier bank change** | Holds supplier payments until confirmed (Fraud protection); shows on adviser Needs attention |
| **Privacy & sharing** | What funders see: none (hidden), summary, or full (entries) |
| **Incubator membership** | Who checks documents (adviser vs admin), the adviser's cohort, support logs |
| **Funder set-up and programmes** | The requirements founders see on Funding readiness and the "gaps" that block applying |
| **Applications and offers** | Funder Applications ↔ founder Funding (offer history, "Ask why", withdraw); approval commits the programme budget |
| **Posts and feature requests** (Profile & marketing) | Shared from the founder's own accounts through share links; feature requests go to `/admin/features`, approved ones show in `/directory` |
| **Tender interest and buyer introductions** (Procurement) | Adviser (with incubator) or admin `/admin/tenders` (without) arranges them |
| **Reports** (`/b/:slug`, pay page, messages) | `/admin/reports`; confirmed senders go on the watchlist |
| **Investor / NGO application** (Join) | `/admin/applications` → approval creates the organisation and the person's account → their first sign-in requires Google Authenticator |
| **Everything above** | `audit_log` (append-only, hash-chained) → `/admin/activity`; daily and weekly jobs (expire requests and documents, re-check fingerprints) → `/admin/health` |

## 4. Broken or incomplete features

Status is the state on `system-unify` when this report was written. Items fixed later in this branch are marked in **Step 4** at the end.

| # | Page | What's wrong | Likely cause |
|---|---|---|---|
| 1 | `/admin/activity`, `/admin/people` (phone) | The page scrolls sideways (247 px and 231 px at 412 px wide) | A filter row or table is wider than the phone and isn't contained. These pages were only tested on desktop |
| 2 | `/sign-up` | No `h1` on the page | The title is a `CardTitle` (a `div`), from dashborad |
| 3 | `/join` | Two `h1`s ("ProofPocket" and the step title), and a skipped heading level | dashborad's header uses an `h1` for the brand |
| 4 | `/pay/:ref` with a wrong or expired link | No heading on the error state | The error branch renders only a notice |
| 5 | Join side panel (funder) | Says "We verify your CIPC registration, **FSCA status** and representative ID". ProofPocket has no FSCA check; approval is a manual admin decision | Wording from dashborad |
| 6 | Phone, several pages | Tap targets of 32–36 px, under the 44 px rule: sector and requirement chips on `/funder/programmes` (16) and `/admin/tenders` (25), buttons on `/admin/organisations` (18), small buttons on founder Home and Payments | shadcn `size="sm"` buttons are 36 px high |
| 7 | Sign up in production | Not yet checked live. Firebase sends a verification link; the person must open it, come back, and continue. `/join/complete` and portal applications refuse until the email is verified | Production uses Firebase, not the local email code |
| 8 | `/sign-up` locally | The email code isn't tied to the sign-up call: `/auth/local/sign-up` works without it. Codes are kept in memory and lost on restart | dashborad's design; local development only (production uses Firebase) |
| 9 | Buyer | No buyer screens; a buyer lands on the public directory (**BUG-06**, open) | Not built; product decision |
| 10 | `/admin/organisations` | No people list or Invite form for buyer organisations (**BUG-05**, open) | One condition in the screen; the API accepts buyer invites |
| 11 | `/app/start` (Verified founder) | Changing the CIPC number after it was checked keeps the company Verified (**BUG-04**, open) | Business-rule decision |
| 12 | `/pay/:ref`, PayFast | Problems if PayFast is ever switched on (**BUG-07**, open; it's off) | Webhook role, signature order, IP check, CSP |
| 13 | Admin pages | Never walked on a phone by the tests before this audit | e2e skipped admin on phones |

### dashborad versions that didn't work, and what was done

| # | dashborad page | What's wrong there | What this branch does |
|---|---|---|---|
| D1 | Payments | Creates requests with `POST /founder/payments`, confirms with `/founder/payments/:id/received`, cancels with `/founder/payments/:id/cancel`. None of these exist in any version of the API. It also has no payment-details form (with Google Authenticator), no suppliers, no "Paid me cash" and no cash payouts | Kept the live screen (same shadcn components). **Flagged:** dashborad's version breaks functionality |
| D2 | Profile & marketing | `PUT /founder/markets/profile`, `POST /founder/markets/posts` and `DELETE /founder/markets/posts/:id` don't exist (the last one in neither API) | Kept live (flagged) |
| D3 | Procurement | `/founder/procurement/tenders/:id/interest` and `/founder/procurement/buyers/:id/intro` exist only as aliases in dashborad's newest API commit | Kept live (flagged) |
| D4 | Fraud protection | `POST /founder/protection/report` doesn't exist; no "check a message" box; no supplier bank-change confirm | Kept live (flagged) |
| D5 | Funding readiness | Uses a reshaped response in which `minMonths`, `minScore` and `requiredDocs` are always 0/empty and `application` is always null. No offer history, "Ask why" or Withdraw | Kept live (flagged) |
| D6 | Privacy & sharing | No data export, no POPIA requests, no incubator join/leave | Kept live (flagged) |
| D7 | Join: investor and NGO | `/join/investor` and `/join/org` create a funder or adviser user, which the database rules forbid (`users_join_insert` allows only founders; only admins create organisations), so it never saved | dashborad's screens kept; the form is sent as a portal application for the admin to approve (your decision) |
| D8 | Join: documents | The "ID selfie" and the "ID copy" both upload as document type `id`, so the second replaced the first; there's no selfie document type | Selfie box removed; ID copy kept |
| D9 | Join: all forms | Labels weren't tied to their fields (no `htmlFor`/`id`): screen readers can't name them. Password hint said 10 characters, the rule is 12 | Fixed |
| D10 | Join: investor/NGO step rules | Its own copy of the rules rejected landlines for an organisation phone that the server accepts | Uses the shared rules |
| D11 | Home | Score colour from a local function: 40+ showed "Getting there" while the rule (and label) say 45+ | Fixed (dashborad's own latest commit did the same) |
| D12 | Sign up | `/sign-up` isn't linked from anywhere on dashborad | Linked from the investor/organisation path on Join |

The founder screens Bookkeeping, Cash flow, Home, More, Business settings, Registration steps, Stock and the privacy prompt were already dashborad's design on the live branch. The differences were earlier fixes:
- `bg-muted` (dark grey in this theme) replaced with `bg-surface-2`
- the made-up "SARS and tax" bell item removed
- the PayFast choice greyed out while PayFast is off

These were kept.

### Not taken from dashborad's latest commit (38723df)
- It moved fixed strings into `@proofpocket/shared` constants (same values) and reshaped the founder funding/markets API responses with placeholder values (D5).
- It added 15 lines of seed data and changed two API tests.
- The readiness thresholds are unchanged (70/45).
- Only the Home score-colour fix (D11) was taken.

## 5. UI inconsistencies between roles (before Step 3)

| What | Founder | Funder / Adviser / Admin | Public pages |
|---|---|---|---|
| **Layout shell** | `FounderShell`: grouped sidebar with section labels and a footer note | `PortalShell`: flat sidebar with a portal title. Its own copy of the nav-link code and icon map | No shell; `AuthPageShell` or bare pages |
| **Phone navigation** | Bottom tab bar (5 tabs) + More page | A horizontal strip of every link at the top (3, 4 or 11 links) | none |
| **Nav icons** | Sidebar: lucide icons. Phone tabs: a separate hand-drawn icon set (`components/icons.tsx`) | lucide icons (same style as the founder sidebar) | — |
| **Spacing** | `gap-6`, `pt-6` | `gap-5`, `pt-5` | various |
| **Headings** | `h1` 24 px (`PageHeader` via `FounderHead`) | `h1` 24 px, except `/admin/applications` at 25.6 px | `h1` 25.6 px (old `.h1` style); `/sign-up` none; `/join` two |
| **Components** | shadcn, with a few old `.btn`/`.notice`/`.pill` left (two-step prompt and settings, install/update hints) | shadcn | old classes: `/directory` (`.pill`, `.field`), `/b/:slug` (`.pill`, `.btn`, `.notice`), `/pay/:ref` (`.notice`, `.btn`) |
| **Tap targets (phone)** | mostly 44 px; some `sm` buttons 36 px | chips and `sm` buttons 32–36 px | — |

No console errors and no failed requests on any page, for any role, phone or desktop, apart from the expected 404 for a made-up payment link. No placeholder ("not built yet") pages remain.

## Step 3: what changed to make it one system

- **One layout for every role:** `components/layout/AppShell.tsx`. Founder, funder, adviser and admin all get:
  - the same top bar
  - the same grouped sidebar with an icon on every link and a note at its foot
  - on phones, the same bottom tab bar (up to four pages + **More**)
- **Thin role wrappers:** `FounderShell` and `PortalShell` now only supply content. The founder adds the bell, the privacy and two-step prompts, and the business name; the portals add the organisation name.
- **One nav link style:** `NavItem`/`TabItem`. **One icon per page:** `app/nav-icons.ts`, lucide everywhere. The hand-drawn tab icons (`components/icons.tsx`) are gone.
- **One More page:** `MorePage`, for every role.
- **Shared building blocks:** `PageHeader` (one `h1`, 24 px), `Card`/`CardTitle` (`h2`), `Table`, `TextField`/`NativeSelect`, `Callout`, `EmptyState`, `StatCard`, `ToneBadge`.
  - **Public pages** (directory, business page, payment page, privacy notice, not found) moved off the old classes onto these.
  - **Sign-in pieces moved too:** two-step sign-in, the password field and the install/update hints.
- **Tap targets:** buttons, inputs and selects are at least 44 px on touch screens.

**Checked again after the changes** (same browser walk, 108 page visits on phone and desktop):
- one `h1` on every page, all 24 px
- no skipped heading levels
- no sideways scroll
- no old CSS classes in any page
- every nav link has an icon, for every role
- no console errors or failed requests apart from the expected 404 for a made-up payment link

## Step 4: fixed, and still open

**Fixed in this branch**

| From | Fix |
|---|---|
| §4 #1 | Admin Activity and People fit a phone (minor columns move under the name below `md`, as founder tables do) |
| §4 #2, #3, #4 | One `h1` on Sign up, Join, a bad payment link, and an unknown business page; Sign in's `h1` was nested inside another heading |
| §4 #5 | Join funder panel: "We check the representative's ID and your organisation's registration, and call to confirm" |
| §4 #6 | 44 px tap targets on touch screens |
| §4 #13 | e2e now walks admin pages on phones, and checks the shared shell for every role on phone and desktop |
| §5 | Every row in the inconsistency table (see Step 3) |
| D7–D12 | As described above |

**Not fixed, and why**

| Item | Why not |
|---|---|
| BUG-04 (CIPC number after Verified) | Changes when a company counts as Verified, which is a business rule. Needs your decision |
| BUG-05 (no Invite form for buyers) | Small, but goes with BUG-06: whether buyers get accounts at all is a product decision |
| BUG-06 (no buyer portal) | Product decision (build a small buyer portal, or keep buyers as organisations only) |
| BUG-07 (PayFast) | PayFast is switched off by your decision; the fixes need PayFast's keys to test |
| §4 #7 (Sign up live) | Checked on the live site after deploying (see the deploy notes) |
| §4 #8 (local email code not enforced) | Local development only; production uses Firebase's verification email, and joining refuses an unverified email |
| D1–D6 (dashborad founder screens) | dashborad's versions call endpoints that don't exist and drop features (payment details with Google Authenticator, suppliers, cash, offers, data export). The live screens use the same shadcn components and now sit in the same shell |
