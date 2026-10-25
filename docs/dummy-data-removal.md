# Dummy data removal (dashboard branch)

Working branch: `dashboard-cleanup`, off `origin/dashborad` (V2), with V1 (`main-shadcn-onboarding`) merged in first so nothing live is lost (`bf8e8cf`).

## How the search was done

All runtime code was searched: `apps/api/src`, `apps/web/src` and `packages/shared/src`, excluding `*.test.ts` and `e2e/`. The search covered:

- `Math.random`, `faker`, random number helpers
- `lorem`, `ipsum`, `dummy`, `mock`, `stub`, `fixture`, `sample`, `fake`, `TODO`, `FIXME`, `coming soon`
- example people, emails and numbers (`@example`, `0821234567`, seed names) outside `db/seed/`
- money, score, count and percentage literals (`amount: 500`, `score: 72`, `45%` and similar)
- top-level constant arrays in screens and components
- fallbacks that would show a made-up figure while the real one is missing (`?? 50`, `|| 12`)

## What was found and changed

| # | Where | What it was | Change |
|---|---|---|---|
| 1 | `apps/web/src/features/public/PayPage.tsx` | `PayFastSection`: a fixed "coming soon… our PayFast merchant application is being processed" message, shown to clients whenever a request included PayFast, even though PayFast can't take payments | Replaced with a real **Pay by card or EFT** button (asks the API to start a PayFast payment, then sends the client to PayFast). It only appears when PayFast is switched on; the API leaves PayFast out of the page otherwise (`services/payments.ts`) |
| 2 | `apps/web/src/features/founder/Payments.tsx` | The PayFast choice could be ticked although PayFast is off, which created requests with a payment method that doesn't work | Greyed out, with "available once ProofPocket's PayFast account is approved", driven by the real `payfastEnabled` setting from `GET /founder/payments`. The API refuses PayFast on a request while it's off (`payfast_off`) |
| 3 | `apps/web/src/components/layout/FounderShell.tsx` (V2) | The notification bell always held a fixed "Good news about SARS and tax" item with hard-coded figures (R0 tax up to R335 000, "a salon doing R5 000–R20 000 a month"). The count on the bell was never below 1, whatever the founder's situation | Removed. The bell is built only from the founder's own data: possible scams and proofs to check (from `/founder/home`), two-step sign-in off, Starter account. With nothing to show, it shows its empty state |
| 4 | `apps/api/src/routes/founder-markets.ts` (V2's version) | Fixed Fraud protection "tips" and Privacy "explanation" text, served as if they were data, with wrong statements: a "24-hour hold" on payment details that doesn't exist, "funders see … documents", and advisers being hidden | V2's parallel API dropped in the merge; V1's API (real data, correct wording) is used |
| 5 | `apps/web/src/features/founder/Settings.tsx` (V2) | "Funders and advisers only see what you choose to share" | Now: "Your incubator's adviser sees your books and documents in order to help. Funders see only what you allow under Privacy & sharing." |

## Checked and left as is (not dummy data)

| Where | Why it stays |
|---|---|
| Form option lists in `Join.tsx` (investor types, stages, budget bands, beneficiary groups), Privacy `OPTIONS`, Fraud protection `RULES`, `CompanyDrawer` support stages, Privacy notice sections | Fixed choices and fixed product wording, not figures about a business |
| `placeholder="e.g. …"` hints in forms | Input hints, never stored or shown as data |
| "fake" in `services/payments.ts`, `Payments.tsx`, `Reviews.tsx` | Real fraud wording ("Possible fake proof of payment") |
| `sample` in `lib/file-signature.ts` | A variable name (the bytes checked for file type) |
| `Settings.tsx`: `Number(f.employees) \|\| 1` | Form input default; the server stores what is saved |
| `config.ts`: `MAIL_FROM` default `no-reply@proofpocket.example` | Development default; production refuses console mail and sets `MAIL_FROM` in `deploy.sh` |
| Charts, Home figures, Cash flow, readiness, counts | All come from the API. With no data they show empty states ("Add bookkeeping entries to see your chart") and loading skeletons, never invented values |

## Example (seed) data

- `apps/api/src/db/seed/` holds the example businesses used by `pnpm db:reset`, the API tests and the browser tests. At runtime it is loaded only by `db/bootstrap.ts`, and only when `SEED_EXAMPLE_DATA=yes` and the database is empty. `infra/deploy.sh` now defaults to `no`.
- Test fixtures (`packages/shared/src/rules/fixtures.test-helpers.ts`, `apps/api/test/*`, `apps/web/e2e/*`) are imported only by tests.
- **Still open, needs the owner's decision:** the production database still holds the example businesses and their sign-in accounts loaded while it was a demo. Removing them deletes rows from the live database, so it hasn't been done. The suggested route is a Cloud SQL backup first, then a one-off delete of rows marked `is_example = true`.

## Tests added with these changes

- `packages/shared/src/rules/velocity.test.ts`: V2's cash-entry velocity check had no tests (4 cases).
- `apps/api/test/payments.test.ts` › "PayFast stays off until its merchant details are set": the founder's payments view reports it off, a PayFast request is refused, the start-payment endpoint returns 404, and the client's page leaves PayFast out.
