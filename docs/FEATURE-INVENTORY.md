# ProofPocket feature inventory

Built from the code on branch `dashboard-cleanup` (25 Oct 2026), not from the prototype:
- API endpoints come from `apps/api/src/routes/*.ts` and `app.ts`. The guard on each route gives the roles.
- Pages come from `apps/web/src/app/router.tsx`, `guards.tsx` and `nav.ts`.
- Jobs come from `apps/api/src/jobs.ts`, and emails from every `mailer.send`.

The endpoint tables are generated from [`system/apps/api/test/access-matrix.ts`](../system/apps/api/test/access-matrix.ts). The test `access-matrix.test.ts` does two things:
- calls **every endpoint as every role**, and checks the result against this matrix
- **fails if the API serves an endpoint that isn't listed here**, so this inventory can't silently go out of date

## Roles

| Role | What it is | Where it comes from |
|---|---|---|
| **Public** | Not signed in (clients on a payment page, directory visitors) | No token; database context `public` |
| **Joining** | Signed in, but no ProofPocket account yet: a founder part-way through Join, or a funder/NGO applicant | Valid token with no `users` row; database context `joining` |
| **Founder** | Business owner (Starter or Verified) | `user_role = founder` |
| **Funder** | Person at a verified funder; Google Authenticator required | `user_role = funder` |
| **Adviser** | Person at an incubator or NGO; Google Authenticator required | `user_role = adviser` |
| **Buyer** | Person at a buyer organisation, invited by the admin; no portal of its own (home is the public directory) | `user_role = buyer` |
| **Admin** | ProofPocket checker and administrator; Google Authenticator required | `user_role = admin` |

**Access values**
- **Allowed:** the role passes access control.
- **Denied:** refused with 401 (signed out), 403 (wrong role or no account), or 409 `already_joined` (Join, for people with an account).
- **Link:** no role gives access; a valid payment-page token, signed storage link or PayFast signature does, and every role gets the same answer without one.
- **Not applicable:** see the notes; it is used for system jobs.

## 1. API features (128 endpoints in 23 modules)

### System

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| SYS-01 | Health check | `GET /health` | — | Everyone |  |
| SYS-02 | API description (OpenAPI) | `GET /openapi.json` | — | Everyone |  |

### Sign-in

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| AUTH-01 | Sign in with email and password (local) | `POST /auth/local/sign-in` | /sign-in | Everyone |  |
| AUTH-02 | Create a sign-in (local, used by Join) | `POST /auth/local/sign-up` | /join | Everyone |  |
| AUTH-03 | Who am I (account, role, company) | `GET /me` | every signed-in page | Founder, Funder, Adviser, Buyer, Admin |  |
| AUTH-04 | Start Google Authenticator set-up | `POST /auth/totp/setup` | /verify, Business settings | Founder, Funder, Adviser, Buyer, Admin | Staff who already have it get 409; founders may start it any time |
| AUTH-05 | Activate Google Authenticator | `POST /auth/totp/activate` | /verify, Business settings | Founder, Funder, Adviser, Buyer, Admin |  |
| AUTH-06 | Enter the code at sign-in | `POST /auth/totp/verify` | /verify | Founder, Funder, Adviser, Buyer, Admin |  |
| AUTH-07 | Turn Google Authenticator off (founders and buyers only) | `POST /auth/totp/disable` | Business settings | Founder, Buyer | Staff get 403: always on |
| AUTH-09 | Waiting counts on the menu | `GET /me/counts` | every portal sidebar | Founder, Funder, Adviser, Buyer, Admin |  |

### Admin

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| AUTH-08 | Reset a lost authenticator | `POST /admin/users/:id/reset-authenticator` | /admin/organisations | Admin |  |

### Join

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| JOIN-01 | Incubators a founder can choose | `GET /join/options` | /join | Everyone |  |
| JOIN-02 | Save founder and business details | `POST /join` | /join | Joining, Founder | A founder who already joined gets 409; other roles get 409 already_joined |
| JOIN-03 | Consent and send documents for checking | `POST /join/complete` | /join | Founder |  |

### Applications

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| JOIN-04 | Apply for a funder or support-organisation portal | `POST /join/applications` | /join | Joining | Users with an account get 409 already_joined |
| JOIN-05 | My application's status | `GET /join/application` | /join | Joining, Founder, Funder, Adviser, Buyer, Admin | Users with an account get { application: null } |
| ADM-05 | Portal applications queue | `GET /admin/applications` | /admin/applications | Admin |  |
| ADM-06 | Approve or turn down an application | `POST /admin/applications/:id` | /admin/applications | Admin |  |

### Documents

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| DOC-01 | Start an upload | `POST /founder/uploads` | /join, /app/start, Bookkeeping | Founder |  |
| DOC-02 | Finish an upload (type and fingerprint checks) | `POST /founder/uploads/:id/complete` | /join, /app/start | Founder |  |
| DOC-03 | Attach a document | `POST /founder/documents` | /join, /app/start | Founder |  |
| DOC-04 | My documents and checker | `GET /founder/documents` | /join, /app/start | Founder |  |
| DOC-05 | Add a CIPC number | `PUT /founder/cipc` | /app/start | Founder |  |
| DOC-06 | Signed download link for a file | `GET /files/:id/download-url` | checker queue, payments, drawer | Founder, Funder, Adviser, Buyer, Admin | Then row-level security: 404 unless the person may see the file |
| DOC-07 | Upload bytes to a signed link (local storage) | `PUT /storage/:token` | — | Anyone with a valid link or signature |  |
| DOC-08 | Download from a signed link (local storage) | `GET /storage/:token` | — | Anyone with a valid link or signature |  |

### Document checks

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| CHK-01 | Adviser checking queue | `GET /adviser/checks` | /adviser/checks | Adviser |  |
| CHK-02 | Adviser approves a document | `POST /adviser/checks/:id/approve` | /adviser/checks | Adviser |  |
| CHK-03 | Adviser sends a document back | `POST /adviser/checks/:id/reject` | /adviser/checks | Adviser |  |
| CHK-04 | Admin checker queue | `GET /admin/checks` | /admin/checks | Admin |  |
| CHK-05 | Admin approves a document | `POST /admin/checks/:id/approve` | /admin/checks | Admin |  |
| CHK-06 | Admin sends a document back | `POST /admin/checks/:id/reject` | /admin/checks | Admin |  |

### Founder Home

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| HOME-01 | Home: journey, figures, notices, next steps | `GET /founder/home` | /app/home, notification bell | Founder |  |

### Bookkeeping

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| BOOK-01 | Books: entries, totals, statement lines | `GET /founder/books` | /app/books | Founder |  |
| BOOK-02 | Add an entry (offline-safe) | `POST /founder/entries` | /app/books | Founder |  |
| BOOK-03 | Mark a personal purchase paid back | `POST /founder/entries/:id/paid-back` | /app/books | Founder |  |
| BOOK-04 | Correct (void) an entry | `POST /founder/entries/:id/void` | /app/books | Founder |  |
| BOOK-05 | Import a bank statement | `POST /founder/statements` | /app/books | Founder |  |
| BOOK-06 | Sort a statement line | `POST /founder/statement-lines/:id` | /app/books | Founder |  |
| BOOK-07 | Earlier months (before ProofPocket) | `PUT /founder/history` | /app/books | Founder |  |

### Stock

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| STK-01 | Stock list | `GET /founder/stock` | /app/stock | Founder |  |
| STK-02 | Add an item | `POST /founder/stock` | /app/stock | Founder |  |
| STK-03 | Edit an item | `PATCH /founder/stock/:id` | /app/stock | Founder |  |
| STK-04 | Remove an item | `DELETE /founder/stock/:id` | /app/stock | Founder |  |
| STK-05 | Use one | `POST /founder/stock/:id/use` | /app/stock | Founder |  |
| STK-06 | Restock (records the cost) | `POST /founder/stock/:id/restock` | /app/stock | Founder |  |

### Cash flow

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| CF-01 | Cash flow: cash on hand, usual month, coming up | `GET /founder/cashflow` | /app/cashflow | Founder |  |

### Business settings

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| SET-01 | Business settings | `GET /founder/settings` | /app/settings | Founder |  |
| SET-02 | Save business settings | `PUT /founder/settings` | /app/settings | Founder |  |

### Payments

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| PAY-01 | Payments: requests, details, suppliers | `GET /founder/payments` | /app/payments | Founder |  |
| PAY-02 | Create a payment request | `POST /founder/payment-requests` | /app/payments | Founder |  |
| PAY-03 | Cancel a request | `POST /founder/payment-requests/:id/cancel` | /app/payments | Founder |  |
| PAY-04 | Paid me cash | `POST /founder/payment-requests/:id/cash` | /app/payments | Founder |  |
| PAY-05 | The money is in my account (confirm proof) | `POST /founder/proofs/:id/confirm` | /app/payments | Founder |  |
| PAY-06 | Not received (reject proof) | `POST /founder/proofs/:id/reject` | /app/payments | Founder |  |
| PAY-07 | Change payment details (needs a code) | `PUT /founder/payment-details` | /app/payments | Founder |  |
| PAY-08 | Add a supplier | `POST /founder/suppliers` | /app/payments | Founder |  |
| PAY-09 | Supplier sent new bank details (hold) | `PUT /founder/suppliers/:id/bank` | /app/protection | Founder |  |
| PAY-10 | Confirm a supplier's new details | `POST /founder/suppliers/:id/confirm` | /app/protection | Founder |  |
| PAY-11 | Reject a supplier's new details | `POST /founder/suppliers/:id/reject` | /app/protection | Founder |  |
| PAY-12 | Record a supplier payment | `POST /founder/supplier-payments` | /app/payments | Founder |  |
| PAY-13 | Record a cash payment out (offline-safe) | `POST /founder/cash-payouts` | /app/payments | Founder |  |

### Payment page (public)

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| PP-01 | Client opens a payment link | `GET /pay/:ref` | /pay/:ref | Anyone with a valid link or signature |  |
| PP-02 | Client starts a proof upload | `POST /pay/:ref/uploads` | /pay/:ref | Anyone with a valid link or signature |  |
| PP-03 | Client finishes a proof upload | `POST /pay/:ref/uploads/:id/complete` | /pay/:ref | Anyone with a valid link or signature |  |
| PP-04 | Client sends proof of payment | `POST /pay/:ref/proof` | /pay/:ref | Anyone with a valid link or signature |  |
| PP-05 | Client reports a payment request | `POST /pay/:ref/report` | /pay/:ref | Anyone with a valid link or signature |  |
| PP-06 | Start a PayFast payment (off until configured) | `POST /pay/:ref/payfast/initiate` | /pay/:ref | Anyone with a valid link or signature |  |
| PP-07 | PayFast confirmation webhook (ITN) | `POST /payfast/itn` | — | Anyone with a valid link or signature | Always answers 200; acts only on a valid PayFast signature |

### Fraud protection

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| FR-01 | Messages, supplier holds, fingerprints | `GET /founder/protection` | /app/protection | Founder |  |
| FR-02 | Report and block, or mark genuine | `POST /founder/messages/:id` | /app/protection | Founder |  |
| FR-03 | Check a message | `POST /founder/check-message` | /app/protection | Founder |  |

### Privacy

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| PRV-01 | Sharing, incubator and requests | `GET /founder/privacy` | /app/privacy | Founder |  |
| PRV-02 | Change what funders see | `PUT /founder/privacy` | /app/privacy | Founder |  |
| PRV-03 | Download my data | `GET /founder/privacy/export` | /app/privacy | Founder |  |
| PRV-04 | Agree to the updated privacy notice | `POST /founder/privacy/consent` | every founder page (prompt) | Founder |  |
| PRV-05 | Ask to correct or delete my data | `POST /founder/privacy/requests` | /app/privacy | Founder |  |
| PRV-06 | Ask to join, move or leave an incubator | `POST /founder/incubator` | /app/privacy | Founder |  |

### Profile & marketing

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| MKT-01 | Profile, posts and buyers | `GET /founder/markets` | /app/markets | Founder |  |
| MKT-02 | Save public profile | `PUT /founder/profile` | /app/markets | Founder |  |
| MKT-03 | Save a post (and ask for a feature) | `POST /founder/posts` | /app/markets | Founder |  |
| MKT-04 | Record a share (WhatsApp, Facebook, X) | `POST /founder/posts/:id/shared` | /app/markets | Founder |  |
| MKT-05 | Ask to meet a buyer | `POST /founder/intros/:id` | /app/markets | Founder |  |

### Funding readiness

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| FUND-01 | Score, programmes and gaps, applications | `GET /founder/funding` | /app/funding | Founder |  |
| FUND-02 | Apply to a programme | `POST /founder/applications` | /app/funding | Founder |  |
| FUND-03 | Ask the funder for a reason | `POST /founder/applications/:id/ask-reason` | /app/funding | Founder |  |
| FUND-04 | Withdraw an application | `POST /founder/applications/:id/withdraw` | /app/funding | Founder |  |

### Procurement

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| PROC-01 | Tenders and what's missing | `GET /founder/procurement` | /app/procurement | Founder |  |
| PROC-02 | Express interest in a tender | `POST /founder/tenders/:id/interest` | /app/procurement | Founder |  |

### Directory (public)

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| DIR-01 | Directory of Verified businesses | `GET /public/directory` | /directory | Everyone |  |
| DIR-02 | A business's public page | `GET /public/b/:slug` | /b/:slug | Everyone |  |
| DIR-03 | Report a business | `POST /public/b/:slug/report` | /b/:slug | Everyone |  |

### Funder portal

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| FUN-01 | Company pipeline | `GET /funder/pipeline` | /funder/pipeline | Funder |  |
| FUN-02 | Applications to this funder | `GET /funder/applications` | /funder/applications | Funder |  |
| FUN-03 | Programmes & requirements | `GET /funder/programmes` | /funder/programmes | Funder |  |
| FUN-04 | Add a programme (also first set-up) | `POST /funder/programmes` | /funder/setup, /funder/programmes | Funder |  |
| FUN-05 | Change a programme's required documents | `POST /funder/programmes/:id/requirements` | /funder/programmes | Funder |  |
| FUN-06 | Close or reopen a programme | `POST /funder/programmes/:id/status` | /funder/programmes | Funder |  |
| FUN-07 | Company drawer | `GET /funder/companies/:id` | pipeline, applications | Funder |  |
| FUN-08 | Invite a company to apply | `POST /funder/companies/:id/invite` | drawer | Funder |  |
| FUN-09 | Change an offer (reason required) | `POST /funder/applications/:id/offer` | drawer | Funder |  |
| FUN-10 | Approve the current offer | `POST /funder/applications/:id/approve` | drawer | Funder |  |
| FUN-11 | Decline (reason required) | `POST /funder/applications/:id/decline` | drawer | Funder |  |
| FUN-12 | Under review / awaiting co-funding | `POST /funder/applications/:id/status` | drawer | Funder |  |

### Adviser portal

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| ADV-01 | Cohort board and requests to join | `GET /adviser/cohort` | /adviser/cohort | Adviser |  |
| ADV-02 | Needs attention | `GET /adviser/attention` | /adviser/attention | Adviser |  |
| ADV-03 | Support log, introductions and tender interest | `GET /adviser/support` | /adviser/support | Adviser |  |
| ADV-04 | Log support | `POST /adviser/support` | /adviser/support | Adviser |  |
| ADV-05 | Company drawer (full books) | `GET /adviser/companies/:id` | cohort, attention | Adviser |  |
| ADV-06 | Assign an adviser | `POST /adviser/companies/:id/adviser` | drawer | Adviser |  |
| ADV-07 | Move a support stage | `POST /adviser/companies/:id/stage` | drawer | Adviser |  |
| ADV-08 | Accept or decline a request to join | `POST /adviser/memberships/:id` | /adviser/cohort | Adviser |  |
| ADV-09 | Arrange or decline an introduction | `POST /adviser/intros/:id` | /adviser/support | Adviser |  |
| ADV-10 | Arrange or decline tender interest | `POST /adviser/tenders/:id` | /adviser/support | Adviser |  |

### Admin portal

| ID | Feature | Method and endpoint | Page | Roles with access | Notes |
|---|---|---|---|---|---|
| ADM-01 | Organisations and their people | `GET /admin/organisations` | /admin/organisations | Admin |  |
| ADM-02 | Add an organisation | `POST /admin/organisations` | /admin/organisations | Admin |  |
| ADM-03 | Verify or unverify an organisation | `POST /admin/organisations/:id/verified` | /admin/organisations | Admin |  |
| ADM-04 | Invite a person (sends a sign-in) | `POST /admin/users` | /admin/organisations | Admin |  |
| ADM-07 | Reports and data requests | `GET /admin/reports` | /admin/reports | Admin |  |
| ADM-08 | Resolve or dismiss a report | `POST /admin/reports/:id` | /admin/reports | Admin |  |
| ADM-09 | Feature requests | `GET /admin/features` | /admin/features | Admin |  |
| ADM-10 | Feature or reject a post | `POST /admin/features/:id` | /admin/features | Admin |  |
| ADM-11 | Flagged payments and reported senders | `GET /admin/flagged` | /admin/flagged | Admin |  |
| ADM-12 | Confirm or clear a reported sender | `POST /admin/watchlist/:id` | /admin/flagged | Admin |  |
| ADM-13 | Tenders and requests | `GET /admin/tenders` | /admin/tenders | Admin |  |
| ADM-14 | Publish a tender | `POST /admin/tenders` | /admin/tenders | Admin |  |
| ADM-15 | Arrange or decline an introduction (no incubator) | `POST /admin/intros/:id` | /admin/tenders | Admin |  |
| ADM-16 | Arrange or decline tender interest (no incubator) | `POST /admin/tenders/:id` | /admin/tenders | Admin |  |

## 2. Pages (web app)

| ID | Page | What it is | Public | Joining | Founder | Funder | Adviser | Buyer | Admin |
|---|---|---|---|---|---|---|---|---|---|
| UI-01 | `/` | Sends each person to their own home (sign-in, Join, code step or portal) | → /sign-in | → /join | → /app/home | → /funder/pipeline | → /adviser/cohort | → /directory | → /admin/checks |
| UI-02 | `/sign-in` | Sign in; Continue with Google (production) | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| UI-03 | `/join` | Join: founder track, funder and support-organisation applications, application status | Allowed | Allowed | Allowed until joined, then → /app/home | → portal | → portal | → /directory | → portal |
| UI-04 | `/verify` | Google Authenticator set-up or code | → /sign-in | → /join | When two-step is on | Required | Required | When two-step is on | Required |
| UI-05 | `/directory, /b/:slug` | Public directory and business pages | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| UI-06 | `/pay/:ref-token` | Client payment page | Link | Link | Link | Link | Link | Link | Link |
| UI-07 | `/privacy-notice` | Privacy notice | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| UI-08 | `/app/{home, start, books, stock, payments, cashflow, markets, funding, procurement, protection, privacy, settings, more}` | Founder portal (12 pages + More on phones) | → /sign-in | → /join | Allowed | → own portal | → own portal | → /directory | → own portal |
| UI-09 | `/funder/{setup, pipeline, applications, programmes}` | Funder portal (set-up first) | → /sign-in | → /join | → /app/home | Allowed | → own portal | → /directory | → own portal |
| UI-10 | `/adviser/{cohort, checks, attention, support}` | Incubator (adviser) portal | → /sign-in | → /join | → /app/home | → own portal | Allowed | → /directory | → own portal |
| UI-11 | `/admin/{checks, applications, organisations, reports, features, flagged, tenders}` | Admin portal | → /sign-in | → /join | → /app/home | → own portal | → own portal | → /directory | Allowed |

A redirect ("→") is how the web app refuses a page; the API behind it refuses the same role with 401/403 (section 4).

**Menus.** Founder sidebar (desktop): Home · Start: Registration steps · Trade: Bookkeeping, Stock (hidden for services businesses) · Get paid: Payments · Manage cash flow: Cash flow · Reach formal markets: Profile & marketing, Funding readiness, Procurement · Stay safe: Fraud protection, Privacy & sharing · Account: Business settings. Phone tab bar: Home, Books, Get paid, Markets, More. Funder: Company pipeline, Applications, Programmes & requirements. Adviser: Cohort board, Document checks, Needs attention, Support log. Admin: Checker queue, Applications, Organisations, Reports, Feature requests, Flagged payments, Tenders & buyers. Each portal menu shows waiting counts (`/me/counts`).

## 3. Features without an endpoint of their own

| ID | Module | Feature | Where | Who |
|---|---|---|---|---|
| JOB-01 | Background jobs | Daily: expire payment requests after 7 days, expire documents past their date, audit-chain check and export, retention purge, abandoned uploads | apps/api/src/jobs.ts (Cloud Run Job) | system |
| JOB-02 | Background jobs | Weekly: re-check every stored document against its SHA-256 fingerprint | apps/api/src/jobs.ts | system |
| MAIL-01 | Emails | Invitation with sign-in instructions | POST /admin/users | invited funder, adviser or buyer |
| MAIL-02 | Emails | Application approved / not approved | POST /admin/applications/:id | applicant |
| MAIL-03 | Emails | You're verified / Please upload again | document checks | founder |
| MAIL-04 | Emails | Payment details changed (founder and advisers) | PUT /founder/payment-details | founder, adviser |
| MAIL-05 | Emails | Two-step sign-in on / off / reset | auth routes | any user |
| WEB-01 | Web app | Notification bell (founder) | FounderShell, data from /founder/home | founder |
| WEB-02 | Web app | Offline entries saved on the phone and sent once | lib/outbox.ts, sw.ts | founder |
| WEB-03 | Web app | Install as an app (PWA), app shell offline | manifest, sw.ts | everyone |
| WEB-04 | Web app | Continue with Google (Firebase only) | /sign-in | everyone (production) |
| WEB-05 | Web app | Privacy notice page | /privacy-notice | everyone |

## 4. Role-by-feature access matrix (API)

| ID | Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin |
|---|---|---|---|---|---|---|---|---|
| SYS-01 | Health check | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| SYS-02 | API description (OpenAPI) | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| AUTH-01 | Sign in with email and password (local) | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| AUTH-02 | Create a sign-in (local, used by Join) | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| AUTH-03 | Who am I (account, role, company) | Denied | Denied | Allowed | Allowed | Allowed | Allowed | Allowed |
| AUTH-04 | Start Google Authenticator set-up | Denied | Denied | Allowed | Allowed | Allowed | Allowed | Allowed |
| AUTH-05 | Activate Google Authenticator | Denied | Denied | Allowed | Allowed | Allowed | Allowed | Allowed |
| AUTH-06 | Enter the code at sign-in | Denied | Denied | Allowed | Allowed | Allowed | Allowed | Allowed |
| AUTH-07 | Turn Google Authenticator off (founders and buyers only) | Denied | Denied | Allowed | Denied | Denied | Allowed | Denied |
| AUTH-08 | Reset a lost authenticator | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| AUTH-09 | Waiting counts on the menu | Denied | Denied | Allowed | Allowed | Allowed | Allowed | Allowed |
| JOIN-01 | Incubators a founder can choose | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| JOIN-02 | Save founder and business details | Denied | Allowed | Allowed | Denied | Denied | Denied | Denied |
| JOIN-03 | Consent and send documents for checking | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| JOIN-04 | Apply for a funder or support-organisation portal | Denied | Allowed | Denied | Denied | Denied | Denied | Denied |
| JOIN-05 | My application's status | Denied | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| DOC-01 | Start an upload | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| DOC-02 | Finish an upload (type and fingerprint checks) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| DOC-03 | Attach a document | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| DOC-04 | My documents and checker | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| DOC-05 | Add a CIPC number | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| DOC-06 | Signed download link for a file | Denied | Denied | Allowed | Allowed | Allowed | Allowed | Allowed |
| DOC-07 | Upload bytes to a signed link (local storage) | Link | Link | Link | Link | Link | Link | Link |
| DOC-08 | Download from a signed link (local storage) | Link | Link | Link | Link | Link | Link | Link |
| CHK-01 | Adviser checking queue | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| CHK-02 | Adviser approves a document | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| CHK-03 | Adviser sends a document back | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| CHK-04 | Admin checker queue | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| CHK-05 | Admin approves a document | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| CHK-06 | Admin sends a document back | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| HOME-01 | Home: journey, figures, notices, next steps | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| BOOK-01 | Books: entries, totals, statement lines | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| BOOK-02 | Add an entry (offline-safe) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| BOOK-03 | Mark a personal purchase paid back | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| BOOK-04 | Correct (void) an entry | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| BOOK-05 | Import a bank statement | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| BOOK-06 | Sort a statement line | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| BOOK-07 | Earlier months (before ProofPocket) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| STK-01 | Stock list | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| STK-02 | Add an item | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| STK-03 | Edit an item | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| STK-04 | Remove an item | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| STK-05 | Use one | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| STK-06 | Restock (records the cost) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| CF-01 | Cash flow: cash on hand, usual month, coming up | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| SET-01 | Business settings | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| SET-02 | Save business settings | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-01 | Payments: requests, details, suppliers | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-02 | Create a payment request | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-03 | Cancel a request | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-04 | Paid me cash | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-05 | The money is in my account (confirm proof) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-06 | Not received (reject proof) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-07 | Change payment details (needs a code) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-08 | Add a supplier | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-09 | Supplier sent new bank details (hold) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-10 | Confirm a supplier's new details | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-11 | Reject a supplier's new details | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-12 | Record a supplier payment | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PAY-13 | Record a cash payment out (offline-safe) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PP-01 | Client opens a payment link | Link | Link | Link | Link | Link | Link | Link |
| PP-02 | Client starts a proof upload | Link | Link | Link | Link | Link | Link | Link |
| PP-03 | Client finishes a proof upload | Link | Link | Link | Link | Link | Link | Link |
| PP-04 | Client sends proof of payment | Link | Link | Link | Link | Link | Link | Link |
| PP-05 | Client reports a payment request | Link | Link | Link | Link | Link | Link | Link |
| PP-06 | Start a PayFast payment (off until configured) | Link | Link | Link | Link | Link | Link | Link |
| PP-07 | PayFast confirmation webhook (ITN) | Link | Link | Link | Link | Link | Link | Link |
| FR-01 | Messages, supplier holds, fingerprints | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| FR-02 | Report and block, or mark genuine | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| FR-03 | Check a message | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PRV-01 | Sharing, incubator and requests | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PRV-02 | Change what funders see | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PRV-03 | Download my data | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PRV-04 | Agree to the updated privacy notice | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PRV-05 | Ask to correct or delete my data | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PRV-06 | Ask to join, move or leave an incubator | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| MKT-01 | Profile, posts and buyers | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| MKT-02 | Save public profile | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| MKT-03 | Save a post (and ask for a feature) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| MKT-04 | Record a share (WhatsApp, Facebook, X) | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| MKT-05 | Ask to meet a buyer | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| FUND-01 | Score, programmes and gaps, applications | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| FUND-02 | Apply to a programme | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| FUND-03 | Ask the funder for a reason | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| FUND-04 | Withdraw an application | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PROC-01 | Tenders and what's missing | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| PROC-02 | Express interest in a tender | Denied | Denied | Allowed | Denied | Denied | Denied | Denied |
| DIR-01 | Directory of Verified businesses | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| DIR-02 | A business's public page | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| DIR-03 | Report a business | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| FUN-01 | Company pipeline | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-02 | Applications to this funder | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-03 | Programmes & requirements | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-04 | Add a programme (also first set-up) | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-05 | Change a programme's required documents | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-06 | Close or reopen a programme | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-07 | Company drawer | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-08 | Invite a company to apply | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-09 | Change an offer (reason required) | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-10 | Approve the current offer | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-11 | Decline (reason required) | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| FUN-12 | Under review / awaiting co-funding | Denied | Denied | Denied | Allowed | Denied | Denied | Denied |
| ADV-01 | Cohort board and requests to join | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-02 | Needs attention | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-03 | Support log, introductions and tender interest | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-04 | Log support | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-05 | Company drawer (full books) | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-06 | Assign an adviser | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-07 | Move a support stage | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-08 | Accept or decline a request to join | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-09 | Arrange or decline an introduction | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADV-10 | Arrange or decline tender interest | Denied | Denied | Denied | Denied | Allowed | Denied | Denied |
| ADM-01 | Organisations and their people | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-02 | Add an organisation | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-03 | Verify or unverify an organisation | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-04 | Invite a person (sends a sign-in) | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-05 | Portal applications queue | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-06 | Approve or turn down an application | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-07 | Reports and data requests | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-08 | Resolve or dismiss a report | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-09 | Feature requests | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-10 | Feature or reject a post | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-11 | Flagged payments and reported senders | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-12 | Confirm or clear a reported sender | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-13 | Tenders and requests | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-14 | Publish a tender | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-15 | Arrange or decline an introduction (no incubator) | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| ADM-16 | Arrange or decline tender interest (no incubator) | Denied | Denied | Denied | Denied | Denied | Denied | Allowed |
| JOB-01, JOB-02 | Background jobs | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable | Not applicable |

**Totals:** 128 API endpoints, 11 page groups, 12 other features. Endpoints allowed per role, not counting link-only ones (9): Public 8, Joining 11, Founder 73, Funder 27, Adviser 28, Buyer 16, Admin 35.
