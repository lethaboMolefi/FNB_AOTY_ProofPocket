# Dashboard test report (phase 3)

Branch `dashboard-cleanup`, 25 Oct 2026. The system was tested locally: PostgreSQL 18 in Docker, the API on :8787 and the web app on :5173. Browser tests run on a phone (Pixel-size) and a desktop viewport against a production build and their own test database.

## Results

| Check | Result |
|---|---|
| Type check (shared, API, web, service worker) | Pass |
| Lint | 0 errors (25 warnings: security-rule notes in seed and config files, React compiler notes on forms) |
| Unit and API tests | 213 / 213 pass (shared 55, web 9, API 149) |
| Production build | Pass |
| Browser tests | 53 pass, 5 skipped by design (desktop-only admin and set-up flows), 0 fail |

## New tests in this phase

| Test | What it proves |
|---|---|
| `apps/web/e2e/dashboard.spec.ts` | Every page of every portal (founder 12 + More, funder 3, adviser 4, admin 7) loads as its own role with a heading, finishes loading, has no console errors, no failed API calls and no sideways scrolling on phones. The notification bell shows real items only. Each role is sent back to its own portal from the others |
| `apps/api/test/figures.test.ts` | Home's money in, money out, cash on hand, proofs to check and open scams, and the admin's waiting counts (documents, applications), equal the same figures computed in plain SQL as the database owner |

## Bugs found and fixed

| # | Bug | Where it came from | Fix |
|---|---|---|---|
| 1 | Notification panel trapped inside the 56 px top bar: the list was cut off, the backdrop covered only the header, and clicking outside didn't close it | V2 (`NotificationPanel`): the top bar's `backdrop-blur` makes fixed children position inside it | Panel and backdrop rendered into `<body>` (portal) |
| 2 | Closed notification panel kept in the page, off-screen to the right: phones could scroll sideways and the bottom tab bar couldn't be tapped; screen readers saw an open dialog | V2 | Rendered only while open |
| 3 | Notification panel couldn't be closed with Escape, and focus didn't move into it | V2 | Escape closes it; focus moves to the panel |
| 4 | Bell button 32 px, below the 44 px tap-target rule | V2 | 44 px |
| 5 | Bookkeeping scrolled sideways on phones (31 px) | V2's two-column layout let wide content stretch the single column | `grid-cols-[minmax(0,1fr)]` on phones (Bookkeeping and Settings) |
| 6 | The stylesheet auto-merged into a mix of V1 and V2 and lost the `tailwindcss-animate` plugin | Merge | V1's stylesheet (V2's CSS changes were already in V1) |
| 7 | PayFast could be chosen on a request while switched off; clients then saw a "coming soon" stub | V2 | See `dummy-data-removal.md` |
| 8 | PayFast confirmation accepted any amount (a R1 payment could close a R200 request) | V2 | Amount must equal the request |
| 9 | PayFast `notify_url` pointed at the website, not the API, so confirmations could never arrive in production | V2 | Built from the API's own host |
| 10 | PayFast webhook errors logged the whole payload (payer's name and email) | V2 | Only the message and reference |
| 11 | V2's parallel founder API shadowed the tested routes; funder and NGO sign-up created unlinked accounts with no review; ID numbers dropped; waiting counts and the offline sign-out check removed; 37 lint errors | V2 | V1 kept (see `V1-vs-V2-changes.md` §3) |

## Roles and permissions

- **Founder:** only `/app/*`. Funder, adviser and admin pages send them back to `/app/home` (browser test). API rules are covered by the existing RLS and security tests (`rls.test.ts`, `rls-security.test.ts`, `security.test.ts`, all passing).
- **Funder, adviser, admin:** each needs Google Authenticator before their portal opens, and each is sent back to its own portal from the others (browser test).
- **Applicants** (funder or NGO, not yet approved) can only send and read their own application; RLS stops them approving themselves (`applications.test.ts`).
- **Public:** payment pages need the unguessable token; a wrong link shows nothing (existing browser test).

## Not fixed (needs a decision or outside access)

| Item | Why it's open |
|---|---|
| PayFast before it is switched on: (a) the webhook runs as the `anonymous` database role, which RLS blocks, so confirmations would always fail; (b) PayFast's signature is checked over sorted fields, but PayFast signs fields in the order sent; (c) no check that the webhook comes from PayFast's IP ranges; (d) the CSP `form-action 'self'` blocks sending clients to PayFast; (e) CLAUDE.md forbids payment-provider integrations | Switched off by owner decision. Needs a small database function for the webhook, the CSP change, and a rule change. Untestable without PayFast sandbox details |
| Example businesses and accounts still in the production database | Deleting rows from the live database needs the owner's go-ahead and a backup first |
| Real Google sign-in end to end | Needs a person choosing their Google account; the redirect and pop-up were checked |
