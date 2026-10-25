# Feature status report

Branch `dashboard-cleanup`, 25 Oct 2026. Every status below comes from a test that was run, or from a probe whose output is quoted. Nothing is marked Working without a passing run. The features are listed in [`FEATURE-INVENTORY.md`](FEATURE-INVENTORY.md); the test cases are in [`TEST-CASES.md`](TEST-CASES.md).

**Environment:** local only.

- PostgreSQL 18 in Docker. The API tests use their own `proofpocket_test` database; the browser tests use a separate test database seeded with example data.
- API in `AUTH_MODE=dev` (tests) and `local` (browser tests).
- Web: a production build served by `vite preview`, tested in Chromium at phone (Pixel) and desktop sizes.
- No production data was read or changed.

**Runs** (all on 25 Oct 2026, after the fixes in section 3):

| Suite | Result |
|---|---|
| `pnpm test`: shared rules, web units, API (includes the access matrix: 896 role × endpoint checks) | 354 / 354 pass (55 + 9 + 290) |
| `pnpm test:e2e`: browser, phone + desktop | 66 pass, 6 skipped (desktop-only by design), 0 fail |
| `pnpm typecheck`, `pnpm lint` | pass; 0 lint errors (30 warnings: security-rule notes in seed/config and React-compiler notes on forms) |

## 1. Executive summary

- **Features:** 128 API features, 11 page groups, 12 other features (jobs, emails, web-only), so **151 in total**.
- **Roles:** 7 (Public, Joining, Founder, Funder, Adviser, Buyer, Admin).
- **Feature × role results:** 986 (896 API + 77 page + 12 other + 1 buyer-portal row).

| Status | Count |
|---|---|
| Working | 968 |
| Working with issues | 2 |
| Broken | 0 |
| Incomplete | 15 |
| Not tested | 1 |
| Security/permission issue | 0 |

**Per role (API features):**

| Role | Allowed and working | Blocked as intended | Working with issues | Incomplete | Link-only | Total |
|---|---|---|---|---|---|---|
| Public | 8 | 111 | 0 | 2 | 7 | 128 |
| Joining | 11 | 108 | 0 | 2 | 7 | 128 |
| Founder | 72 | 46 | 1 | 2 | 7 | 128 |
| Funder | 27 | 92 | 0 | 2 | 7 | 128 |
| Adviser | 28 | 91 | 0 | 2 | 7 | 128 |
| Buyer | 16 | 103 | 0 | 2 | 7 | 128 |
| Admin | 34 | 84 | 1 | 2 | 7 | 128 |

**Headlines**
- **No access-control gaps.** Every endpoint refused every role it should, with 401 or 403, both in the API and by direct URL in the web app. No Security/permission issue was found.
- **No Broken features.**
- **3 bugs fixed** on the branch (BUG-01 to BUG-03).
- **4 left open for your decision** (BUG-04 to BUG-07), because they change business rules or product scope, or because the feature is switched off.
- **No Critical issues.** The one High issue (BUG-07) only matters if PayFast is switched on.

## 2. Status per feature and role

Each cell shows the status, then the access result:
- **Allowed:** passed access control, and works as the evidence shows.
- **Blocked:** refused as intended, with the HTTP status shown.
- **Link:** access comes only from a valid link or signature, and every role gets the same answer without one.

Evidence for each feature is the named tests that call it (all passing in the runs above), plus the access check, which `access-matrix.test.ts` runs for every cell.

### System

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-SYS-01** Health check `GET /health` | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | api.test.ts › health and OpenAPI; api.test.ts › sets security headers and hides the framework; security.test.ts › API responses carry the security headers |
| **F-SYS-02** API description (OpenAPI) `GET /openapi.json` | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | api.test.ts › health and OpenAPI |

### Sign-in

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-AUTH-01** Sign in with email and password (local) `POST /auth/local/sign-in` | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | auth.test.ts › gives the same answer for a wrong password and an unknown email; auth.test.ts › locks the account after five wrong passwords, even for the right one; auth.test.ts › rejects a tampered token; +4 more |
| **F-AUTH-02** Create a sign-in (local, used by Join) `POST /auth/local/sign-up` | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | auth.test.ts › rejects weak passwords at sign-up; join.spec.ts › the logo on Join always leads to sign-in, even part-way through joining; roles.spec.ts › joining (signed in, no account): every portal sends you to Join |
| **F-AUTH-03** Who am I (account, role, company) `GET /me` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | api.test.ts › a signed-in stranger has no account yet; api.test.ts › founders sign in without a PIN; the role comes from the database; api.test.ts › funders must set up Google Authenticator, then enter a code on every sign-in; +17 more |
| **F-AUTH-04** Start Google Authenticator set-up `POST /auth/totp/setup` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | api.test.ts › funders must set up Google Authenticator, then enter a code on every sign-in; api.test.ts › locks after five wrong codes; auth.test.ts › a founder turns it on, later sign-ins need a code, and turning it off needs one too; +3 more |
| **F-AUTH-05** Activate Google Authenticator `POST /auth/totp/activate` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | api.test.ts › funders must set up Google Authenticator, then enter a code on every sign-in; api.test.ts › locks after five wrong codes; auth.test.ts › a founder turns it on, later sign-ins need a code, and turning it off needs one too; +2 more |
| **F-AUTH-06** Enter the code at sign-in `POST /auth/totp/verify` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | api.test.ts › errors use { error: { code, message } }; api.test.ts › funders must set up Google Authenticator, then enter a code on every sign-in; api.test.ts › locks after five wrong codes; +2 more |
| **F-AUTH-07** Turn Google Authenticator off (founders and buyers only) `POST /auth/totp/disable` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | auth.test.ts › a founder turns it on, later sign-ins need a code, and turning it off needs one too; auth.test.ts › staff can't turn it off; admin can reset a lost phone |
| **F-AUTH-09** Waiting counts on the menu `GET /me/counts` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | applications.test.ts › only the admin sees the queue; it shows the ID number masked; figures.test.ts › admin counts: documents waiting and applications waiting; phase5.test.ts › match the prototype's rail for Nala |

### Admin

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-AUTH-08** Reset a lost authenticator `POST /admin/users/:id/reset-authenticator` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | auth.test.ts › staff can't turn it off; admin can reset a lost phone |

### Join

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-JOIN-01** Incubators a founder can choose `GET /join/options` | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | roles-and-features.test.ts › lists only verified incubators, by name, to anyone |
| **F-JOIN-02** Save founder and business details `POST /join` | W · Blocked 401 | W · Allowed | W · Allowed | W · Blocked 409 | W · Blocked 409 | W · Blocked 409 | W · Blocked 409 | join.spec.ts › a funder applies, the admin approves, and the funder's portal opens; join.spec.ts › join → upload → approve → Verified; join.spec.ts › the logo on Join always leads to sign-in, even part-way through joining; +6 more |
| **F-JOIN-03** Consent and send documents for checking `POST /join/complete` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | join.test.ts › can't finish joining without the four documents; join.test.ts › fingerprints each upload with SHA-256 and finishes joining |

### Applications

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-JOIN-04** Apply for a funder or support-organisation portal `POST /join/applications` | W · Blocked 401 | W · Allowed | W · Blocked 409 | W · Blocked 409 | W · Blocked 409 | W · Blocked 409 | W · Blocked 409 | applications.test.ts › a support organisation becomes an incubator with a lead adviser; applications.test.ts › an application grants nothing until an admin approves it; applications.test.ts › approval creates the organisation and the funder, linked, and the funder sets requirements first; +4 more |
| **F-JOIN-05** My application's status `GET /join/application` | W · Blocked 401 | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | applications.test.ts › an application grants nothing until an admin approves it; applications.test.ts › turning one down needs a reason, which the applicant sees and is emailed |
| **F-ADM-05** Portal applications queue `GET /admin/applications` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | applications.test.ts › a support organisation becomes an incubator with a lead adviser; applications.test.ts › approval creates the organisation and the funder, linked, and the funder sets requirements first; applications.test.ts › only the admin sees the queue; it shows the ID number masked; +2 more |
| **F-ADM-06** Approve or turn down an application `POST /admin/applications/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | applications.test.ts › a support organisation becomes an incubator with a lead adviser; applications.test.ts › approval creates the organisation and the funder, linked, and the funder sets requirements first; applications.test.ts › turning one down needs a reason, which the applicant sees and is emailed |

### Documents

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-DOC-01** Start an upload `POST /founder/uploads` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › is off for services businesses; jobs.test.ts › check the audit chain, export yesterday's entries and purge abandoned uploads; security.test.ts › refuses files over 5 MB and bytes that don't match the signed size |
| **F-DOC-02** Finish an upload (type and fingerprint checks) `POST /founder/uploads/:id/complete` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › is off for services businesses |
| **F-DOC-03** Attach a document `POST /founder/documents` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | join.test.ts › fingerprints each upload with SHA-256 and finishes joining; join.test.ts › send back needs a reason, messages the founder and lets them upload again; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator; +2 more |
| **F-DOC-04** My documents and checker `GET /founder/documents` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | join.test.ts › fingerprints each upload with SHA-256 and finishes joining; join.test.ts › send back needs a reason, messages the founder and lets them upload again; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator; +2 more |
| **F-DOC-05** Add a CIPC number `PUT /founder/cipc` | W · Blocked 401 | W · Blocked 403 | WI · Allowed (BUG-04) | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › saves a valid number, refuses a wrong format, and records it |
| **F-DOC-06** Signed download link for a file `GET /files/:id/download-url` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | join.test.ts › signed links only for people who can see the file; security.test.ts › a founder can't fetch another company's file by id; security.test.ts › a tampered link is refused; +2 more |
| **F-DOC-07** Upload bytes to a signed link (local storage) `PUT /storage/:token` | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | security.test.ts › refuses files over 5 MB and bytes that don't match the signed size; join.test.ts › fingerprints each upload with SHA-256 and finishes joining; join.spec.ts › join → upload → approve → Verified |
| **F-DOC-08** Download from a signed link (local storage) `GET /storage/:token` | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | security.test.ts › serves an accepted file only as a sandboxed download; security.test.ts › download links stop working after 5 minutes; security.test.ts › a tampered link is refused |

### Document checks

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-CHK-01** Adviser checking queue `GET /adviser/checks` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | api.test.ts › funders must set up Google Authenticator, then enter a code on every sign-in; join.test.ts › approves ReKasi's pending CSD only as its own incubator's adviser; join.test.ts › goes to the admin queue (no incubator), not to advisers; +2 more |
| **F-CHK-02** Adviser approves a document `POST /adviser/checks/:id/approve` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | join.test.ts › approves ReKasi's pending CSD only as its own incubator's adviser |
| **F-CHK-03** Adviser sends a document back `POST /adviser/checks/:id/reject` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › needs a reason, reaches the founder by message and email, and other incubators can't touch it |
| **F-CHK-04** Admin checker queue `GET /admin/checks` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | dashboard.spec.ts › adviser: every page loads cleanly; dashboard.spec.ts › founder: every page loads cleanly, and the bell shows real items; join.test.ts › founders can't use the checker routes; +6 more |
| **F-CHK-05** Admin approves a document `POST /admin/checks/:id/approve` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | join.test.ts › the fourth approval makes the company Verified and sends “You're verified” |
| **F-CHK-06** Admin sends a document back `POST /admin/checks/:id/reject` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | join.test.ts › send back needs a reason, messages the founder and lets them upload again |

### Founder Home

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-HOME-01** Home: journey, figures, notices, next steps `GET /founder/home` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | auth.test.ts › a founder turns it on, later sign-ins need a code, and turning it off needs one too; books.test.ts › is for founders only; books.test.ts › personal purchases count against readiness until paid back; +3 more |

### Bookkeeping

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-BOOK-01** Books: entries, totals, statement lines `GET /founder/books` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › Use 1 and Restock are idempotent; restock records the cost; books.test.ts › corrections remove an entry from the totals but keep it in history; books.test.ts › imports lines, marks ones already in the books, and doesn't import a line twice; +2 more |
| **F-BOOK-02** Add an entry (offline-safe) `POST /founder/entries` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › a sale linked to stock reduces it and never below zero; books.test.ts › asks for a second confirmation for the same amount out within 7 days; books.test.ts › corrections remove an entry from the totals but keep it in history; +4 more |
| **F-BOOK-03** Mark a personal purchase paid back `POST /founder/entries/:id/paid-back` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › personal purchases count against readiness until paid back |
| **F-BOOK-04** Correct (void) an entry `POST /founder/entries/:id/void` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › corrections remove an entry from the totals but keep it in history |
| **F-BOOK-05** Import a bank statement `POST /founder/statements` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › asks for the columns when the CSV has no headings; books.test.ts › imports lines, marks ones already in the books, and doesn't import a line twice |
| **F-BOOK-06** Sort a statement line `POST /founder/statement-lines/:id` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › imports lines, marks ones already in the books, and doesn't import a line twice |
| **F-BOOK-07** Earlier months (before ProofPocket) `PUT /founder/history` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › earlier months only |

### Stock

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-STK-01** Stock list `GET /founder/stock` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › Use 1 and Restock are idempotent; restock records the cost; books.test.ts › a sale linked to stock reduces it and never below zero; books.test.ts › is off for services businesses; +1 more |
| **F-STK-02** Add an item `POST /founder/stock` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › Use 1 and Restock are idempotent; restock records the cost; books.test.ts › a sale linked to stock reduces it and never below zero; books.test.ts › is off for services businesses; +1 more |
| **F-STK-03** Edit an item `PATCH /founder/stock/:id` | W · Blocked 401 | W · Blocked 403 | W · Allowed (BUG-01) | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › edits an item, refuses bad values, and removes it from the list |
| **F-STK-04** Remove an item `DELETE /founder/stock/:id` | W · Blocked 401 | W · Blocked 403 | W · Allowed (BUG-01) | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › edits an item, refuses bad values, and removes it from the list |
| **F-STK-05** Use one `POST /founder/stock/:id/use` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › Use 1 and Restock are idempotent; restock records the cost |
| **F-STK-06** Restock (records the cost) `POST /founder/stock/:id/restock` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › Use 1 and Restock are idempotent; restock records the cost |

### Cash flow

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-CF-01** Cash flow: cash on hand, usual month, coming up `GET /founder/cashflow` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › opening balance with a date drives cash on hand |

### Business settings

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-SET-01** Business settings `GET /founder/settings` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › opening balance with a date drives cash on hand |
| **F-SET-02** Save business settings `PUT /founder/settings` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | books.test.ts › opening balance with a date drives cash on hand |

### Payments

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-PAY-01** Payments: requests, details, suppliers `GET /founder/payments` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | jobs.test.ts › expire old requests, expired documents, and catch a swapped file; payments.test.ts › PayFast stays off until its merchant details are set; payments.test.ts › a fake proof: wrong amount, used twice, rejected twice → flagged with a fraud warning; +7 more |
| **F-PAY-02** Create a payment request `POST /founder/payment-requests` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | jobs.test.ts › expire old requests, expired documents, and catch a swapped file; payments.test.ts › PayFast stays off until its merchant details are set; payments.test.ts › a fake proof: wrong amount, used twice, rejected twice → flagged with a fraud warning; +5 more |
| **F-PAY-03** Cancel a request `POST /founder/payment-requests/:id/cancel` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › “Paid me cash” and cancelling |
| **F-PAY-04** Paid me cash `POST /founder/payment-requests/:id/cash` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › “Paid me cash” and cancelling |
| **F-PAY-05** The money is in my account (confirm proof) `POST /founder/proofs/:id/confirm` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › “The money is in my account” records money in with the proof attached, once |
| **F-PAY-06** Not received (reject proof) `POST /founder/proofs/:id/reject` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › a fake proof: wrong amount, used twice, rejected twice → flagged with a fraud warning |
| **F-PAY-07** Change payment details (needs a code) `PUT /founder/payment-details` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › are refused without it, then saved with a valid code and the incubator's advisers are told; security.test.ts › never contain tokens, passwords, account or ID numbers |
| **F-PAY-08** Add a supplier `POST /founder/suppliers` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › payments are blocked while a supplier's bank details are on hold; roles-and-features.test.ts › holds payments until the founder confirms by phone |
| **F-PAY-09** Supplier sent new bank details (hold) `PUT /founder/suppliers/:id/bank` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › payments are blocked while a supplier's bank details are on hold; roles-and-features.test.ts › holds payments until the founder confirms by phone |
| **F-PAY-10** Confirm a supplier's new details `POST /founder/suppliers/:id/confirm` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › holds payments until the founder confirms by phone |
| **F-PAY-11** Reject a supplier's new details `POST /founder/suppliers/:id/reject` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › payments are blocked while a supplier's bank details are on hold |
| **F-PAY-12** Record a supplier payment `POST /founder/supplier-payments` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › payments are blocked while a supplier's bank details are on hold; roles-and-features.test.ts › holds payments until the founder confirms by phone |
| **F-PAY-13** Record a cash payment out (offline-safe) `POST /founder/cash-payouts` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › cash payouts give a slip number once |

### Payment page (public)

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-PP-01** Client opens a payment link `GET /pay/:ref` | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | payments.spec.ts › a wrong payment link shows nothing about the business; payments.spec.ts › full payment flow: request → client proof → not received twice → flagged; payments.test.ts › PayFast stays off until its merchant details are set; +6 more |
| **F-PP-02** Client starts a proof upload `POST /pay/:ref/uploads` | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | payments.test.ts › a fake proof: wrong amount, used twice, rejected twice → flagged with a fraud warning; payments.spec.ts › full payment flow: request → client proof → not received twice → flagged |
| **F-PP-03** Client finishes a proof upload `POST /pay/:ref/uploads/:id/complete` | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | payments.test.ts › a fake proof: wrong amount, used twice, rejected twice → flagged with a fraud warning; payments.spec.ts › full payment flow: request → client proof → not received twice → flagged |
| **F-PP-04** Client sends proof of payment `POST /pay/:ref/proof` | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | payments.test.ts › a fake proof: wrong amount, used twice, rejected twice → flagged with a fraud warning; payments.test.ts › “The money is in my account” records money in with the proof attached, once |
| **F-PP-05** Client reports a payment request `POST /pay/:ref/report` | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | W · Link | roles-and-features.test.ts › a client's report reaches the admin's reports |
| **F-PP-06** Start a PayFast payment (off until configured) `POST /pay/:ref/payfast/initiate` | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | payments.test.ts › PayFast stays off until its merchant details are set |
| **F-PP-07** PayFast confirmation webhook (ITN) `POST /payfast/itn` | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | I · Link (BUG-07) | roles-and-features.test.ts › the PayFast webhook answers 200 and changes nothing while PayFast is off |

### Fraud protection

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-FR-01** Messages, supplier holds, fingerprints `GET /founder/protection` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | jobs.test.ts › expire old requests, expired documents, and catch a swapped file; payments.test.ts › a fake proof: wrong amount, used twice, rejected twice → flagged with a fraud warning; payments.test.ts › reporting a scammer warns the next founder who checks a message from them; +1 more |
| **F-FR-02** Report and block, or mark genuine `POST /founder/messages/:id` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › reporting a scammer warns the next founder who checks a message from them; roles-and-features.test.ts › a sender blocked by a founder reaches the admin, who confirms the scam |
| **F-FR-03** Check a message `POST /founder/check-message` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › reporting a scammer warns the next founder who checks a message from them; roles-and-features.test.ts › a sender blocked by a founder reaches the admin, who confirms the scam |

### Privacy

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-PRV-01** Sharing, incubator and requests `GET /founder/privacy` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › sharing and incubator membership; phase5.test.ts › accepts a founder's request to join; phase5.test.ts › never shows Starter companies or companies sharing nothing |
| **F-PRV-02** Change what funders see `PUT /founder/privacy` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › sharing and incubator membership; phase5.test.ts › accepts a founder's request to join; phase5.test.ts › never shows Starter companies or companies sharing nothing |
| **F-PRV-03** Download my data `GET /founder/privacy/export` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | applications.test.ts › keeps the founder's ID number encrypted, readable by the owner's export only without it; security.test.ts › a founder downloads their own data, without storage paths or encrypted values; security.test.ts › signed-out requests to private endpoints are refused |
| **F-PRV-04** Agree to the updated privacy notice `POST /founder/privacy/consent` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | security.test.ts › asks founders to agree again when the notice changes |
| **F-PRV-05** Ask to correct or delete my data `POST /founder/privacy/requests` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | security.test.ts › a correction or deletion request reaches the admin's reports |
| **F-PRV-06** Ask to join, move or leave an incubator `POST /founder/incubator` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | payments.test.ts › sharing and incubator membership; phase5.test.ts › accepts a founder's request to join |

### Profile & marketing

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-MKT-01** Profile, posts and buyers `GET /founder/markets` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › buyers and tenders need Verified; interest goes to the adviser; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator; roles-and-features.test.ts › records where a post was shared, only for known networks and own posts; +2 more |
| **F-MKT-02** Save public profile `PUT /founder/profile` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › saves the profile (shown publicly) and validates it |
| **F-MKT-03** Save a post (and ask for a feature) `POST /founder/posts` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › posts: feature requests only when Verified; admin features one; the directory shows it; roles-and-features.test.ts › records where a post was shared, only for known networks and own posts; security.test.ts › SQL in input is treated as data; +2 more |
| **F-MKT-04** Record a share (WhatsApp, Facebook, X) `POST /founder/posts/:id/shared` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › records where a post was shared, only for known networks and own posts |
| **F-MKT-05** Ask to meet a buyer `POST /founder/intros/:id` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › buyers and tenders need Verified; interest goes to the adviser; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |

### Funding readiness

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-FUND-01** Score, programmes and gaps, applications `GET /founder/funding` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › Starters see every programme's gaps but can't apply; phase5.test.ts › apply → offer change needs a reason → ask why → approve commits the budget; phase5.test.ts › the founder can ask why about the R28 000 offer, once; +1 more |
| **F-FUND-02** Apply to a programme `POST /founder/applications` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › apply → offer change needs a reason → ask why → approve commits the budget; roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |
| **F-FUND-03** Ask the funder for a reason `POST /founder/applications/:id/ask-reason` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › the founder can ask why about the R28 000 offer, once |
| **F-FUND-04** Withdraw an application `POST /founder/applications/:id/withdraw` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |

### Procurement

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-PROC-01** Tenders and what's missing `GET /founder/procurement` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › buyers and tenders need Verified; interest goes to the adviser; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |
| **F-PROC-02** Express interest in a tender `POST /founder/tenders/:id/interest` | W · Blocked 401 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › buyers and tenders need Verified; interest goes to the adviser; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |

### Directory (public)

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-DIR-01** Directory of Verified businesses `GET /public/directory` | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | phase5.test.ts › posts: feature requests only when Verified; admin features one; the directory shows it |
| **F-DIR-02** A business's public page `GET /public/b/:slug` | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | phase5.test.ts › profiles: Starters have a page with the Starter badge; reports reach admin; roles-and-features.test.ts › saves the profile (shown publicly) and validates it |
| **F-DIR-03** Report a business `POST /public/b/:slug/report` | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | W · Allowed | phase5.test.ts › profiles: Starters have a page with the Starter badge; reports reach admin |

### Funder portal

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-FUN-01** Company pipeline `GET /funder/pipeline` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | applications.test.ts › an application grants nothing until an admin approves it; dashboard.spec.ts › founder: every page loads cleanly, and the bell shows real items; phase5.spec.ts › a new funder must set requirements first; +9 more |
| **F-FUN-02** Applications to this funder `GET /funder/applications` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › apply → offer change needs a reason → ask why → approve commits the budget; roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |
| **F-FUN-03** Programmes & requirements `GET /funder/programmes` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › a newly invited funder must set requirements and be verified before the pipeline opens; phase5.test.ts › apply → offer change needs a reason → ask why → approve commits the budget; roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |
| **F-FUN-04** Add a programme (also first set-up) `POST /funder/programmes` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › a newly invited funder must set requirements and be verified before the pipeline opens; phase5.test.ts › apply → offer change needs a reason → ask why → approve commits the budget; roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |
| **F-FUN-05** Change a programme's required documents `POST /funder/programmes/:id/requirements` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |
| **F-FUN-06** Close or reopen a programme `POST /funder/programmes/:id/status` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |
| **F-FUN-07** Company drawer `GET /funder/companies/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › the drawer shows book entries only with full sharing; security.test.ts › a funder can't open a company that hasn't shared with funders (a Starter, not an applicant) |
| **F-FUN-08** Invite a company to apply `POST /funder/companies/:id/invite` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |
| **F-FUN-09** Change an offer (reason required) `POST /funder/applications/:id/offer` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › apply → offer change needs a reason → ask why → approve commits the budget |
| **F-FUN-10** Approve the current offer `POST /funder/applications/:id/approve` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › apply → offer change needs a reason → ask why → approve commits the budget |
| **F-FUN-11** Decline (reason required) `POST /funder/applications/:id/decline` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › apply → offer change needs a reason → ask why → approve commits the budget |
| **F-FUN-12** Under review / awaiting co-funding `POST /funder/applications/:id/status` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › runs a whole programme from set-up to withdrawal |

### Adviser portal

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-ADV-01** Cohort board and requests to join `GET /adviser/cohort` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | dashboard.spec.ts › founder: every page loads cleanly, and the bell shows real items; phase5.test.ts › accepts a founder's request to join; phase5.test.ts › cohort, stages, advisers, support log and needs attention; +4 more |
| **F-ADV-02** Needs attention `GET /adviser/attention` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › cohort, stages, advisers, support log and needs attention |
| **F-ADV-03** Support log, introductions and tender interest `GET /adviser/support` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › buyers and tenders need Verified; interest goes to the adviser; phase5.test.ts › cohort, stages, advisers, support log and needs attention; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |
| **F-ADV-04** Log support `POST /adviser/support` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › buyers and tenders need Verified; interest goes to the adviser; phase5.test.ts › cohort, stages, advisers, support log and needs attention; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |
| **F-ADV-05** Company drawer (full books) `GET /adviser/companies/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › cohort, stages, advisers, support log and needs attention |
| **F-ADV-06** Assign an adviser `POST /adviser/companies/:id/adviser` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › cohort, stages, advisers, support log and needs attention |
| **F-ADV-07** Move a support stage `POST /adviser/companies/:id/stage` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › cohort, stages, advisers, support log and needs attention |
| **F-ADV-08** Accept or decline a request to join `POST /adviser/memberships/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › accepts a founder's request to join |
| **F-ADV-09** Arrange or decline an introduction `POST /adviser/intros/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | phase5.test.ts › buyers and tenders need Verified; interest goes to the adviser |
| **F-ADV-10** Arrange or decline tender interest `POST /adviser/tenders/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | W · Blocked 403 | W · Blocked 403 | roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |

### Admin portal

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence (tests run) |
|---|---|---|---|---|---|---|---|---|
| **F-ADM-01** Organisations and their people `GET /admin/organisations` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.spec.ts › admin reviews a feature request; the directory shows it; phase5.test.ts › a newly invited funder must set requirements and be verified before the pipeline opens; phase5.test.ts › only staff of the right kind reach each portal; +3 more |
| **F-ADM-02** Add an organisation `POST /admin/organisations` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.spec.ts › admin reviews a feature request; the directory shows it; phase5.test.ts › a newly invited funder must set requirements and be verified before the pipeline opens; phase5.test.ts › only staff of the right kind reach each portal; +3 more |
| **F-ADM-03** Verify or unverify an organisation `POST /admin/organisations/:id/verified` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.test.ts › a newly invited funder must set requirements and be verified before the pipeline opens |
| **F-ADM-04** Invite a person (sends a sign-in) `POST /admin/users` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | WI · Allowed (BUG-05) | phase5.test.ts › a newly invited funder must set requirements and be verified before the pipeline opens; roles.spec.ts › admin invites a buyer; the buyer signs in with the emailed password and lands on the directory |
| **F-ADM-07** Reports and data requests `GET /admin/reports` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.test.ts › profiles: Starters have a page with the Starter badge; reports reach admin; roles-and-features.test.ts › a client's report reaches the admin's reports; security.test.ts › a correction or deletion request reaches the admin's reports; +1 more |
| **F-ADM-08** Resolve or dismiss a report `POST /admin/reports/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.test.ts › profiles: Starters have a page with the Starter badge; reports reach admin |
| **F-ADM-09** Feature requests `GET /admin/features` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.spec.ts › admin reviews a feature request; the directory shows it; phase5.test.ts › posts: feature requests only when Verified; admin features one; the directory shows it |
| **F-ADM-10** Feature or reject a post `POST /admin/features/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.test.ts › posts: feature requests only when Verified; admin features one; the directory shows it |
| **F-ADM-11** Flagged payments and reported senders `GET /admin/flagged` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | roles-and-features.test.ts › a sender blocked by a founder reaches the admin, who confirms the scam |
| **F-ADM-12** Confirm or clear a reported sender `POST /admin/watchlist/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | roles-and-features.test.ts › a sender blocked by a founder reaches the admin, who confirms the scam |
| **F-ADM-13** Tenders and requests `GET /admin/tenders` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.test.ts › admin publishes a tender; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |
| **F-ADM-14** Publish a tender `POST /admin/tenders` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | phase5.test.ts › admin publishes a tender; roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |
| **F-ADM-15** Arrange or decline an introduction (no incubator) `POST /admin/intros/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |
| **F-ADM-16** Arrange or decline tender interest (no incubator) `POST /admin/tenders/:id` | W · Blocked 401 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Blocked 403 | W · Allowed | roles-and-features.test.ts › adviser arranges tender interest from their own cohort only; admin handles companies without an incubator |

W = Working, WI = Working with issues, B = Broken, I = Incomplete, NT = Not tested, S = Security/permission issue.

### Pages (web app)

| Feature | Public | Joining | Founder | Funder | Adviser | Buyer | Admin | Evidence |
|---|---|---|---|---|---|---|---|---|
| **F-UI-01** `/ (home redirect)` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-02** `/sign-in` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-03** `/join` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-04** `/verify` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-05** `/directory, /b/:slug` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-06** `/pay/:ref-token` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-07** `/privacy-notice` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-08** `Founder portal /app/*` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-09** `Funder portal /funder/*` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-10** `Adviser portal /adviser/*` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |
| **F-UI-11** `Admin portal /admin/*` | W | W | W | W | W | W | W | roles.spec.ts (every role × every portal by URL), dashboard.spec.ts (every page as its role: heading, no console errors, no failed calls, no sideways scrolling), shell.spec.ts |

Each page group behaves for every role as the inventory says: allowed roles see it, and the rest are redirected to their own home. Every page also passed the loading, empty and error checks (BUG-03 fixed).

### Other features

| Feature | Who | Status | Evidence |
|---|---|---|---|
| **F-JOB-01** Daily: expire payment requests after 7 days, expire documents past their date, audit-chain check and export, retention purge, abandoned uploads | system | Working | jobs.test.ts › expire old requests, expired documents, and catch a swapped file; › check the audit chain, export yesterday's entries and purge abandoned uploads |
| **F-JOB-02** Weekly: re-check every stored document against its SHA-256 fingerprint | system | Working | jobs.test.ts › expire old requests, expired documents, and catch a swapped file (re-hash) |
| **F-MAIL-01** Invitation with sign-in instructions | invited funder, adviser or buyer | Working | phase5.test.ts › a newly invited funder…; roles.spec.ts › admin invites a buyer… (BUG-02 fixed) |
| **F-MAIL-02** Application approved / not approved | applicant | Working | applications.test.ts › turning one down needs a reason, which the applicant sees and is emailed; approval email |
| **F-MAIL-03** You're verified / Please upload again | founder | Working | join.test.ts › the fourth approval makes the company Verified and sends “You're verified”; roles-and-features.test.ts › adviser sends a document back |
| **F-MAIL-04** Payment details changed (founder and advisers) | founder, adviser | Working | payments.test.ts › are refused without it, then saved with a valid code and the incubator's advisers are told |
| **F-MAIL-05** Two-step sign-in on / off / reset | any user | Working | auth.test.ts › a founder turns it on…; staff can't turn it off; admin can reset a lost phone |
| **F-WEB-01** Notification bell (founder) | founder | Working | dashboard.spec.ts › founder: every page loads cleanly, and the bell shows real items |
| **F-WEB-02** Offline entries saved on the phone and sent once | founder | Working | books.spec.ts › offline entries are saved on the phone and sync exactly once |
| **F-WEB-03** Install as an app (PWA), app shell offline | everyone | Working | shell.spec.ts › the manifest makes ProofPocket installable; › the app shell opens offline. Installing on a real phone: Not tested |
| **F-WEB-04** Continue with Google (Firebase only) | everyone (production) | Not tested | Needs a person to choose a Google account. Checked on the live site (25 Oct): the pop-up opens Google's chooser for proofpocket-aoty.firebaseapp.com |
| **F-WEB-05** Privacy notice page | everyone | Working | security.spec.ts › privacy: the notice is public… |
| **F-UI-12** Buyer portal (anything a buyer can do beyond the public directory) | Buyer | Incomplete | A buyer signs in and lands on `/directory` (roles.spec.ts); there are no buyer screens or buyer-only endpoints (BUG-06) |

## 3. Bug list

| ID | Severity | Status | Feature · role | Steps to reproduce | Expected | Actual (before any fix) | Suggested fix |
|---|---|---|---|---|---|---|---|
| BUG-01 | Low | **Fixed** (`9d5b7cb`) | F-STK-03, F-STK-04 · Founder | As founder B, `PATCH /founder/stock/<founder A's item>` `{name:"Hijacked"}`; or any founder with an unknown ID; or `DELETE` the same | 404, nothing changed | 200 "Item updated" / "Item removed"; nothing changed (row-level security held). Probe output: `other founder PATCH -> 200 {"message":"Item updated"}; unknown id PATCH -> 200 …; row now {"name":"Mealie meal","archived_at":null}` | Done: update with `returning()`, and 404 when no row matched. Regression: `roles-and-features.test.ts › stock: edit and remove` |
| BUG-02 | Low | **Fixed** (`84e6883`) | F-ADM-04, F-MAIL-01 · Admin → Buyer | Admin invites a person to a buyer organisation | Buyers aren't told to set up Google Authenticator (they don't use it) | Invite said "You'll set up Google Authenticator the first time", and the local password line said "you'll be asked to set up Google Authenticator" | Done: only funder, adviser and admin invites mention it. Regression: `roles.spec.ts` (buyer mail), `phase5.test.ts` (funder mail still mentions it) |
| BUG-03 | Medium | **Fixed** (`a320f1b`) | 21 of 27 data screens · all signed-in roles | Block the service worker; make `/api/v1/founder/cashflow` return 500; open Cash flow | An error with a way to retry | "Loading…" for ever (screenshots: `docs/testing/evidence/bug-03-before-*.png`) | Done: the shared `Spinner` sees a failed active request and shows "Couldn't load this. Check your connection, then try again." with **Try again**. Regression: `e2e/errors.spec.ts` (phone and desktop) |
| BUG-04 | Medium | **Open: needs your decision** | F-DOC-05 · Founder | As a Verified founder (`tumelo@`), `PUT /founder/cipc {cipcNumber:"2099/999999/07"}` | Refused once the CIPC certificate is checked, or the CIPC check goes back to pending | 200 "CIPC number saved. Upload the certificate next."; the company stays Verified with an unchecked number. Probe: `before 2021/554019/07; PUT -> 200 …; still verified=true` (the test value was put back) | Either (a) refuse with 409 when the `cipc` document is verified ("Ask your checker to change it"), or (b) accept it but set the `cipc` document back to pending, which removes Verified until it is re-checked. (b) changes the Verified status, so it's your call |
| BUG-05 | Medium | **Open: needs your decision** | F-ADM-04 · Admin | Admin → Organisations → Buyers | An Invite form, as for funders and incubators | No people list or Invite form for buyer organisations. The API accepts buyer invites (`roles.spec.ts` invites one through it) | Show the people list and Invite form for buyers too (one condition in `Organisations.tsx`). It changes a shadcn screen, so I didn't do it without asking |
| BUG-06 | Medium | **Open: needs your decision** | F-UI-12 · Buyer | Sign in as an invited buyer | Some buyer screens (e.g. see introductions, tenders they posted) | Lands on the public directory; no buyer screens or buyer-only endpoints exist. Founders' introduction requests go to advisers and the admin, never to the buyer | Product decision: either build a small buyer portal, or stop creating buyer *accounts* (keep buyers as organisations only) |
| BUG-07 | High (only if PayFast is switched on) | **Open: switched off by your decision** | F-PP-06, F-PP-07 · Public | Read `routes/pay.ts` and `services/payfast.ts` (can't be run without PayFast keys) | A valid PayFast confirmation marks the request paid once | (a) The webhook runs as database role `anonymous`, which row-level security blocks, so every confirmation would fail; (b) the signature is checked over alphabetically sorted fields, but PayFast signs in the order sent; (c) no check that the call comes from PayFast's IP ranges; (d) CSP `form-action 'self'` stops the browser posting to PayFast; (e) CLAUDE.md forbids payment-provider integrations. Already fixed earlier: amount must match, `notify_url` points at the API, and no payer details in logs | Before switching on: a `SECURITY DEFINER` database function for the webhook, PayFast-order signature, an IP allow-list, a CSP change, sandbox tests, and a CLAUDE.md update |

Severity: **Critical** = data loss, money or a security breach now. **High** = a feature can't work, or a serious risk once used. **Medium** = wrong behaviour with a workaround. **Low** = misleading or cosmetic.

## 4. Dummy or hard-coded data still present

| Where | What | Risk | Recommendation |
|---|---|---|---|
| Production database | The example businesses and their sign-in accounts from the demo period (`is_example = true`) | Real founders see example companies in the directory and funder pipelines | Owner decision (deleting live rows). Back up Cloud SQL first, then delete `is_example` rows |
| `components/CompanyDrawer.tsx` | The 5 support stage names are written in the web app, as well as on the server (`STAGES`) | They could drift apart | Use the stage names the API already sends (`d.stages`) |
| `CompanyDrawer.tsx` "of 9 documents checked", Procurement "of 6 months", "of 3" tender documents | Totals written as numbers | They go wrong if the document list changes | Take them from `DOC_TYPES.length` and the shared constants |
| `NotificationPanel.tsx` empty state | "New tips and alerts will appear here": there are no tips any more (the SARS item was removed) | Cosmetic | "New alerts will appear here" |
| Fraud protection `RULES`, Privacy `OPTIONS`, Join option lists | Fixed product wording and choices | None: these are copy, not data | Keep |
| `apps/api/src/db/seed/` | Example data for `pnpm db:reset` and the tests; loaded at runtime only with `SEED_EXAMPLE_DATA=yes` (production default `no`) | None | Keep |

No `Math.random` values, lorem ipsum, or made-up figures are shown anywhere. `figures.test.ts` checks Home's figures and the admin counts against SQL.

## 5. Fixed on this branch during the audit

| Bug | Commit | Test that proves it |
|---|---|---|
| BUG-01 | `9d5b7cb` | `apps/api/test/roles-and-features.test.ts › stock: edit and remove` |
| BUG-02 | `84e6883` | `apps/web/e2e/roles.spec.ts › admin invites a buyer…`, `apps/api/test/phase5.test.ts › a newly invited funder…` |
| BUG-03 | `a320f1b` | `apps/web/e2e/errors.spec.ts › a failed request shows an error with Try again, which recovers` |

Fixed earlier on this branch (phases 2–5, see [`dashboard-test-report.md`](dashboard-test-report.md)):
- the notification panel
- sideways scrolling on phones
- the PayFast amount check, `notify_url` and log privacy
- the stylesheet merge
- the merge of V2's parallel API

## 6. What could not be tested, and why

| What | Why | What was checked instead |
|---|---|---|
| Choosing a Google account in Continue with Google | Needs a person and a real Google account | Live site: the pop-up reaches Google's account chooser for `proofpocket-aoty.firebaseapp.com`, with no errors |
| PayFast payments end to end | Switched off; needs PayFast sandbox merchant details | Off-state behaviour (404, 200 webhook, no change), plus a code review (BUG-07) |
| Installing the app on a real Android phone or iPhone | Needs the devices | The manifest and offline app shell (browser tests) |
| Firebase password-reset and email-verification emails | Production-only (Firebase) | The local equivalents; Gmail delivery was confirmed on 25 Oct (a sample email sent from `pegphina1@gmail.com`) |
| This branch on the live site | Not deployed (the audit used local data only) | Everything ran against a production build locally |

## 7. Coverage

_Filled in by phase E (completeness check)._
