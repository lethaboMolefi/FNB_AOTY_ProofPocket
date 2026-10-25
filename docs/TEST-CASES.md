# ProofPocket test cases (V1 vs V2)

Test cases for the whole system on branch `dashboard-cleanup`: V2 (the dashboard branch) with V1 merged in and cleaned up.

- **V1** = `main-shadcn-onboarding`, live on 25 Oct 2026.
- **V2** = this branch. The differences are explained in [`V1-vs-V2-changes.md`](V1-vs-V2-changes.md).

**Version column**

| Value | Meaning |
|---|---|
| **V1 – Unchanged** | Existed in V1 and behaves the same in V2 |
| **V1 – Modified** | Existed in V1 but changed in V2 (the change is noted) |
| **V2 – New** | Only exists in V2 |

## Summary

<!-- counts: generated from the tables below -->
| Version | Test cases |
|---|---|
| V1 – Unchanged | 145 |
| V1 – Modified | 7 |
| V2 – New | 17 |
| **Total** | **169** |

**Where to test**
- Locally: `cd system && pnpm db:reset && pnpm dev`, then http://localhost:5173. Example passwords are in `apps/api/.seed-credentials.json`.
- Example accounts:
  - founders `zanele@` (Nala Nails & Lashes, Starter), `tumelo@` (Verified), `kabelo@`, `palesa@`, `umnotho@`
  - funders `lesedi@`, `kopano@`, `bophelo@` (not set up yet)
  - advisers `n.mokoena@`, `l.dube@`
  - admin `admin@`
  - all `@proofpocket.example`
- **Automated** marks a case covered by `pnpm test` or `pnpm test:e2e` (the file is named). The rest are manual; [`testing/manual-test-cases.md`](testing/manual-test-cases.md) has longer step-by-step versions of many of them.

---

## 1. Signing in and accounts

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| AUTH-01 | Founder signs in | Sign in as `zanele@` | Lands on `/app/home`. Automated: `shell.spec.ts` | V1 – Unchanged |
| AUTH-02 | Wrong password | Sign in with a wrong password | One message: "That email and password don't match. Check them and try again." Automated: `shell.spec.ts` | V1 – Unchanged |
| AUTH-03 | Unknown email | Sign in with an email that has no account | Same message as AUTH-02 (no hint whether the email exists) | V1 – Unchanged |
| AUTH-04 | Lockout | Five wrong passwords in a row | Sixth try is refused for a while, with "Too many tries" wording. Automated: `auth.test.ts` | V1 – Unchanged |
| AUTH-05 | Signed-out visitor | Open `/app/home` signed out | Sent to `/sign-in`. Automated: `shell.spec.ts` | V1 – Unchanged |
| AUTH-06 | Sign out with unsent offline entries | Save an entry offline, then Sign out | Asks to confirm: the entries stay on the phone and send at next sign-in | V1 – Unchanged |
| AUTH-07 | Show/hide password | Tap the eye on the password field | Password shown, then hidden again | V1 – Unchanged |
| AUTH-08 | Forgot password (production) | On the live site, enter an email, choose Forgot password | "If there's an account for that email, we've sent a link…" whether or not it exists | V1 – Unchanged |
| AUTH-09 | Continue with Google: pop-up | On the live site, Continue with Google | Google's account chooser opens showing "continue to proofpocket-aoty.firebaseapp.com" | V1 – Unchanged |
| AUTH-10 | Continue with Google: existing account | Choose a Google account whose email has a ProofPocket account | Signed in to that account's portal | V1 – Unchanged |
| AUTH-11 | Continue with Google: new person | Choose a Google account with no ProofPocket account | Sent to Join | V1 – Unchanged |
| AUTH-12 | Continue with Google: cancel | Close the Google window | No error shown | V1 – Unchanged |
| AUTH-13 | Continue with Google: pop-up blocked | Block pop-ups, then try | "Your browser blocked the Google window. Allow pop-ups…" Automated: `google-sign-in.test.ts` | V1 – Unchanged |
| AUTH-14 | Email codes are gone | `POST /api/v1/auth/email-otp/send` | 404: two-step sign-in is Google Authenticator only | V1 – Unchanged |
| AUTH-15 | No separate sign-up page | Open `/sign-up` | Not a page; "Join ProofPocket" link on sign-in opens `/join` | V1 – Unchanged |

## 2. Two-step sign-in (Google Authenticator)

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| TFA-01 | Staff must set it up | First sign-in as a funder, adviser or admin | Set-up screen with QR code before the portal opens. Automated: `security.spec.ts` | V1 – Unchanged |
| TFA-02 | Code on every staff sign-in | Sign in again as staff | Asked for a 6-digit code | V1 – Unchanged |
| TFA-03 | Code used once | Reuse the same code within its 30 s | Refused | V1 – Unchanged |
| TFA-04 | Lockout after five wrong codes | Enter five wrong codes | Locked; admin can reset. Automated: `totp.test.ts` | V1 – Unchanged |
| TFA-05 | Founder optional | Founder opens Business settings | Can turn it on; a reminder shows on Home and in the bell until on | V1 – Unchanged |
| TFA-06 | Founder turns it off | Turn off with a current code | Off, and an email "Two-step sign-in was turned off" | V1 – Unchanged |
| TFA-07 | Staff can't turn it off | Staff tries to turn it off (API) | 403 "Two-step sign-in is always on for this account." | V1 – Unchanged |
| TFA-08 | Admin resets a lost phone | Admin resets a user's authenticator | User sets it up again at next sign-in; email "Your ProofPocket authenticator was reset" | V1 – Unchanged |

## 3. Join (founders)

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| JOIN-01 | Choose a track | Open `/join` | Three choices: Business founder, Funder or investor, Incubator/NGO/NPO; Sign in link | V1 – Unchanged |
| JOIN-02 | Full founder join | Business founder → details → 4 documents → tick → Join | Lands on Registration steps: "Welcome! A ProofPocket checker is reviewing your documents." Automated: `join.spec.ts` | V1 – Unchanged |
| JOIN-03 | Password rules | Password under 12 characters, or the two don't match | Field messages; nothing sent | V1 – Unchanged |
| JOIN-04 | SA ID number checked | Enter a 13-digit number with a wrong check digit or date | "Check the ID number…"; Automated: `identity.test.ts` | V1 – Unchanged |
| JOIN-05 | Cellphone format | Enter `011 123 4567` as the founder's cellphone | "Enter a valid South African cellphone number" | V1 – Unchanged |
| JOIN-06 | CIPC number format | Registered = Yes, CIPC `2025-48` | "The CIPC number should look like 2024/123456/07." Automated: `join.test.ts` | V1 – Unchanged |
| JOIN-07 | Sector follows type | Change Type of business | Sector list changes to that type's sectors | V1 – Unchanged |
| JOIN-08 | Starter path | Registered = Not yet | Only ID and proof of address are asked for | V1 – Unchanged |
| JOIN-09 | Consent required | Join without ticking | "Tick the box to confirm before joining." Automated: `join.spec.ts` | V1 – Unchanged |
| JOIN-10 | Come back before finishing | Stop after details, sign in again | Join opens at Documents | V1 – Unchanged |
| JOIN-11 | Already signed in | Signed in (e.g. Google) with no business, open Join → founder | "You're signing up as …"; "Use a different email" brings back the email field. Automated: `join.spec.ts` | V1 – Unchanged |
| JOIN-12 | Logo leads to sign-in | On Join (signed out, or half-joined), tap the logo | Opens `/sign-in`; a half-joined person is signed out first. Automated: `join.spec.ts` | V1 – Unchanged |
| JOIN-13 | Co-founders | Add a co-founder with a valid ID | Saved encrypted; not visible to advisers or funders | V1 – Unchanged |
| JOIN-14 | ID number never shown or logged | Join, then check the API log and Download my data | No ID number in the log; export has no `idNumberEnc` | V1 – Unchanged |
| JOIN-15 | File type by content | Upload a program renamed `.pdf` | Refused: file type. Automated: `join.test.ts` | V1 – Unchanged |

## 4. Funder and support-organisation applications

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| APP-01 | Funder applies | Join → Funder or investor → both steps → Send application | "We're checking your application" page. Automated: `join.spec.ts` | V1 – Unchanged |
| APP-02 | NGO needs an NPO number | Organisation type NGO, no NPO number | "NGOs and NPOs require an NPO registration number" | V1 – Unchanged |
| APP-03 | Organisation phone may be a landline | Organisation phone `011 123 4567` | Accepted | V1 – Unchanged |
| APP-04 | Applying grants nothing | After APP-01, open `/funder/pipeline` | No portal; applicant sees only their status. Automated: `applications.test.ts` | V1 – Unchanged |
| APP-05 | One application per sign-in | Send a second application | "You've already sent an application with this account." | V1 – Unchanged |
| APP-06 | Email already has an account | Apply with an email that has an account | "…already has a ProofPocket account. Sign in instead." | V1 – Unchanged |
| APP-07 | Admin approves | Admin → Applications → Approve | Organisation and linked user created; email with Sign in button. Automated: `applications.test.ts`, `join.spec.ts` | V1 – Unchanged |
| APP-08 | Rejection needs a reason | Turn down with under 10 characters | Refused; with a reason, applicant sees it and gets an email | V1 – Unchanged |
| APP-09 | Decided once | Approve an already-decided application (API) | Refused ("already approved") | V1 – Unchanged |
| APP-10 | ID masked for admin | Admin views an application | ID shows as `••••••••••087` | V1 – Unchanged |
| APP-11 | Approved funder sets up first | Approved funder signs in | Google Authenticator set-up, then Set your requirements | V1 – Unchanged |

## 5. Document checks and Verified

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| DOC-01 | Admin checks companies without an incubator | Admin → Checker queue | Only those companies' pending documents | V1 – Unchanged |
| DOC-02 | Fourth approval verifies | Approve all four joining documents | "{Business} is now Verified"; listed in the directory; "You're verified" email. Automated: `join.spec.ts` | V1 – Unchanged |
| DOC-03 | Send back needs a reason | Send back without a reason | Refused; with a reason the founder is messaged and emailed | V1 – Unchanged |
| DOC-04 | Adviser checks own incubator's companies | Adviser → Document checks | Only their incubator's companies | V1 – Unchanged |
| DOC-05 | Checked document can't be replaced | Founder tries to replace a verified document | Refused | V1 – Unchanged |
| DOC-06 | Same file used before | Upload a file used by another business | Flagged by its SHA-256 fingerprint | V1 – Unchanged |

## 6. Founder Home and shell

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| HOME-01 | Starter Home | Sign in as `zanele@` | "Home", "You're on a Starter account.", journey with 5 steps, Things to watch. Automated: `books.spec.ts` | V1 – Unchanged |
| HOME-02 | Figures match the database | Compare Money in/out this month and Cash on hand with SQL | Equal. Automated: `figures.test.ts` | V1 – Unchanged |
| HOME-03 | Empty chart | New founder with no entries | "Add bookkeeping entries to see your chart." (no invented values) | V1 – Unchanged |
| HOME-04 | Journey and Next steps links | Tap each | Opens the matching page | V1 – Unchanged |
| HOME-05 | Navigation (desktop) | Desktop sidebar | Groups Start, Trade, Get paid, Manage cash flow, Reach formal markets, Stay safe, Account; waiting counts. Automated: `shell.spec.ts` | V1 – Unchanged |
| HOME-06 | Navigation (phone) | Phone tab bar | Home, Books, Get paid, Markets, More. Automated: `shell.spec.ts` | V1 – Unchanged |
| HOME-07 | Wider layout | Desktop ≥ 1 440 px | Content up to 1 440 px wide, sidebar 240 px (V1: 1 280 px and 216 px) | V1 – Modified |
| HOME-08 | No sideways scrolling | Every founder page on a phone | Page never scrolls sideways. Automated: `dashboard.spec.ts` | V1 – Unchanged |
| HOME-09 | Every page loads cleanly | Visit every founder page | Heading, no console errors, no failed API calls. Automated: `dashboard.spec.ts` | V1 – Unchanged |

## 7. Notification bell

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| BELL-01 | Bell count | Sign in as `zanele@` | Bell labelled "N notifications"; N equals the items in the panel. Automated: `dashboard.spec.ts` | V2 – New |
| BELL-02 | Real items only | Open the bell | Only: possible scams, proofs to check, Google Authenticator off, Starter account. No fixed tips (no SARS item). Automated: `dashboard.spec.ts` | V2 – New |
| BELL-03 | Empty state | Verified founder with two-step on and nothing pending | "You're all caught up" | V2 – New |
| BELL-04 | Panel full height | Open on a phone and on desktop | Panel covers the full height on the right; backdrop dims the page | V2 – New |
| BELL-05 | Close | Escape, the ✕, or clicking the backdrop | Panel closes. Automated: `dashboard.spec.ts` (Escape) | V2 – New |
| BELL-06 | Urgent items can't be dismissed | Look for a dismiss button on scams / proofs | None; they stay until resolved | V2 – New |
| BELL-07 | Item links | Tap Review on the scams item | Opens Fraud protection; panel closes | V2 – New |
| BELL-08 | Dismissals are not saved | Dismiss the Starter item, reload | It's back (dismissals last until reload) | V2 – New |

## 8. Bookkeeping

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| BOOK-01 | Add money in | Add R250 in, Cash | Entry listed; Money in rises by R250 | V1 – Unchanged |
| BOOK-02 | Amount above zero | Enter 0 | Refused | V1 – Unchanged |
| BOOK-03 | Same money out twice in 7 days | Add the same amount out twice | Second needs a second Save. Automated: `books.spec.ts` | V1 – Unchanged |
| BOOK-04 | Personal purchase | Mark an entry personal | Counts against readiness until Paid back | V1 – Unchanged |
| BOOK-05 | Void, never delete | Correct an entry | Old entry voided with a reason, still in history | V1 – Unchanged |
| BOOK-06 | Stock-linked sale | Sell a stock item | Stock quantity goes down | V1 – Unchanged |
| BOOK-07 | Statement import | Import a bank CSV, sort lines | Lines added, marked personal or skipped; no double counting | V1 – Unchanged |
| BOOK-08 | Offline entries | Go offline, add an entry, come back | Saved on the phone, sent exactly once. Automated: `books.spec.ts` | V1 – Unchanged |
| BOOK-09 | Two-column layout | Desktop | Statement import and Add an entry on the left; totals and entries on the right (V1: one column). Phone: one column, no sideways scrolling | V1 – Modified |
| BOOK-10 | Rapid cash entries flagged | Add 6 manual cash entries within 10 minutes | 6th is saved; activity feed shows "Rapid cash entry: more than 5 entries in 10 minutes…". Automated (rule): `velocity.test.ts` | V2 – New |
| BOOK-11 | Busy hour flagged | 16 manual cash entries within an hour, not in 10 minutes | "Unusual activity: more than 15 entries in one hour…" | V2 – New |
| BOOK-12 | Non-cash and automatic entries not flagged | Many EFT entries, or statement imports | No velocity note | V2 – New |

## 9. Stock, cash flow and settings

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| STK-01 | Services business has no Stock | Sign in as `tumelo@` (services) | No Stock in navigation. Automated: `shell.spec.ts` | V1 – Unchanged |
| STK-02 | Low stock count | Item below its reorder level | Count on Stock in the sidebar | V1 – Unchanged |
| CF-01 | Cash on hand | Open Cash flow | "Cash on hand now" equals opening balance plus all live entries since its date | V1 – Unchanged |
| CF-02 | Paying yourself | Cash flow with an Owner salary entry | Shown under Paying yourself | V1 – Unchanged |
| SET-01 | Two-column settings | Desktop Business settings | Form on the left; Google Authenticator and "Who sees your records" on the right (V1: one column) | V1 – Modified |
| SET-02 | Correct privacy wording | Read "Who sees your records" | Says the adviser sees books and documents; funders only what you allow | V1 – Modified |
| SET-03 | Save business details | Change employees, save | Saved; Home subtitle updates | V1 – Unchanged |

## 10. Payments and the payment page

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| PAY-01 | Create a request | Client, amount, ways to pay → Create | "Request PP-1234 created…", link, WhatsApp, QR. Automated: `payments.spec.ts` | V1 – Unchanged |
| PAY-02 | Validation | No client, amount 0, or no way to pay | Messages; nothing created | V1 – Unchanged |
| PAY-03 | PayFast option while off | Look at Ways the client can pay | "Card / EFT (PayFast)" greyed out with "available once ProofPocket's PayFast account is approved" | V1 – Modified |
| PAY-04 | PayFast refused while off (API) | Create a request with `payfast` | 400 `payfast_off`. Automated: `payments.test.ts` | V2 – New |
| PAY-05 | Client sends proof | Open the link, upload proof | "Proof of payment sent." Automated: `payments.spec.ts` | V1 – Unchanged |
| PAY-06 | Proof checks | Wrong amount, no reference, file used before | Each check fails with its own line. Automated: `payments.spec.ts` | V1 – Unchanged |
| PAY-07 | Money in only after founder confirms | "The money is in my account" | Request Paid; entry in books | V1 – Unchanged |
| PAY-08 | Not received twice → flagged | Not received, client resends, Not received again | Flagged; fraud message raised. Automated: `payments.spec.ts` | V1 – Unchanged |
| PAY-09 | Cash | "Paid me cash" | Paid without proof | V1 – Unchanged |
| PAY-10 | Expiry | Request older than 7 days | Expired; link closed | V1 – Unchanged |
| PAY-11 | Change payment details | Change bank details | Needs a Google Authenticator code; adviser and founder emailed | V1 – Unchanged |
| PAY-12 | Supplier on hold | Supplier's bank changed, record a payment | "Payment blocked: … bank details changed." Automated: `payments.spec.ts` | V1 – Unchanged |
| PAY-13 | Wrong payment link | Open `/pay/PP-4821-not-the-real-token` | "This payment link isn't valid."; nothing about the business. Automated: `payments.spec.ts` | V1 – Unchanged |
| PAY-14 | Payment page hides PayFast while off | Open a request's page | No PayFast section; `ways.payfast` absent. Automated: `payments.test.ts` | V1 – Modified |
| PAY-15 | PayFast button (when switched on) | With PayFast keys set, request with PayFast, client taps "Pay by card or EFT" | Sent to PayFast. **Blocked until switched on** (see report) | V2 – New |
| PAY-16 | PayFast start refused while off | `POST /pay/:ref/payfast/initiate` | 404. Automated: `payments.test.ts` | V2 – New |
| PAY-17 | PayFast amount must match | ITN with a different amount (when on) | Rejected; request stays open | V2 – New |
| PAY-18 | PayFast result banners | Open `/pay/…?payfast=success`, then `?payfast=cancelled` | "Payment submitted to PayFast…", then "Payment cancelled. You can try again below." | V2 – New |

## 11. Fraud protection

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| FR-01 | Check a message | Paste a message asking for an upfront fee | Warning signs listed; saved for reporting | V1 – Unchanged |
| FR-02 | Report and block | Report and block an unverified sender | Status Reported and blocked; other founders warned after repeat reports | V1 – Unchanged |
| FR-03 | Mark genuine | It's genuine | Marked genuine | V1 – Unchanged |
| FR-04 | Supplier bank change | Supplier sent new details → confirm by phone, or reject | Payments held until decided | V1 – Unchanged |
| FR-05 | Document fingerprints | Open Fraud protection | One fingerprint per uploaded document | V1 – Unchanged |
| FR-06 | Attention banner | Open with unverified messages or holds | Red banner with both counts; green when nothing needs attention | V1 – Unchanged |

## 12. Privacy and incubators

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| PRV-01 | Sharing level | Choose Summary, Save | Saved; funders see summary only | V1 – Unchanged |
| PRV-02 | Download my data | Download my data | File `proofpocket-my-data-YYYY-MM-DD.json`. Automated: `security.spec.ts` | V1 – Unchanged |
| PRV-03 | Correction or deletion | Ask to delete my data | Confirmation; request appears for admin; reply within the stated days | V1 – Unchanged |
| PRV-04 | Leave an incubator | Leave | Adviser no longer sees the records | V1 – Unchanged |
| PRV-05 | Ask an incubator | Choose one, Send request | "You asked to join …" until accepted | V1 – Unchanged |
| PRV-06 | Privacy notice is public | Open `/privacy-notice` signed out | Shown. Automated: `security.spec.ts` | V1 – Unchanged |

## 13. Profile, posts and the directory

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| MKT-01 | Save profile | Edit tagline, services, save | Saved; public page updates | V1 – Unchanged |
| MKT-02 | Post and share links | Save a post, tap WhatsApp | Opens WhatsApp share with the profile link (no social media API) | V1 – Unchanged |
| MKT-03 | Feature request | Verified founder: Save and request a feature | "Saved. ProofPocket reviews feature requests weekly." Automated: `phase5.spec.ts` | V1 – Unchanged |
| MKT-04 | Starters can't request features | Starter founder | No feature button | V1 – Unchanged |
| MKT-05 | Buyer introduction | Verified founder: Request introduction | Requested; Starter sees "Verified only" | V1 – Unchanged |
| MKT-06 | Directory | Open `/directory` signed out | Verified businesses only, with featured posts. Automated: `phase5.spec.ts` | V1 – Unchanged |
| MKT-07 | Script in a post | Post `<script>alert(1)</script>` | Shown as text, never runs. Automated: `security.spec.ts` | V1 – Unchanged |

## 14. Funding readiness and procurement

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| FUND-01 | Readiness score | Open Funding readiness | Score and label (Funding ready 70+, Getting there 45+, else Early) | V1 – Unchanged |
| FUND-02 | Programme gaps | Starter founder | Each programme lists what's missing; no Apply | V1 – Unchanged |
| FUND-03 | Apply in range | Verified, no gaps, amount in range → Apply | "Application sent to …". Automated: `phase5.spec.ts` | V1 – Unchanged |
| FUND-04 | Amount out of range | Amount above the programme maximum | Refused | V1 – Unchanged |
| FUND-05 | Ask for a reason | Offer changed without a reason → Ask | Reason requested | V1 – Unchanged |
| FUND-06 | Withdraw | Withdraw an open application | Withdrawn | V1 – Unchanged |
| PROC-01 | Tender actions | Open Procurement | Each tender: Verify first / Add documents / more months / Express interest. Automated: `phase5.spec.ts` | V1 – Unchanged |
| PROC-02 | Express interest | Qualifying tender → Express interest | "Interest sent" | V1 – Unchanged |

## 15. Funder portal

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| FUN-01 | Set requirements first | New funder `bophelo@` signs in | Set your requirements before the pipeline. Automated: `phase5.spec.ts` | V1 – Unchanged |
| FUN-02 | Pipeline hides Starters and sharing "none" | Open Company pipeline | Only Verified companies sharing summary or full, plus own applicants. Automated: `phase5.spec.ts` | V1 – Unchanged |
| FUN-03 | Entries only with full sharing | Open a summary-sharing company | No book entries | V1 – Unchanged |
| FUN-04 | Offer changes need a reason | Change an offer without a reason | Refused. Automated: `phase5.spec.ts` | V1 – Unchanged |
| FUN-05 | Every funder page loads cleanly | Visit all funder pages | No errors, no failed calls, waiting counts shown. Automated: `dashboard.spec.ts` | V1 – Unchanged |
| FUN-06 | Funder kept to own portal | Funder opens `/app/home` | Sent to `/funder/pipeline`. Automated: `dashboard.spec.ts` | V1 – Unchanged |

## 16. Incubator (adviser) portal

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| ADV-01 | Cohort board | Open Cohort board, move a stage | Stage saved. Automated: `phase5.spec.ts` | V1 – Unchanged |
| ADV-02 | Own incubator only | Adviser opens another incubator's company (API) | Refused (RLS). Automated: `rls.test.ts` | V1 – Unchanged |
| ADV-03 | Needs attention | Open Needs attention | Companies with urgent flags | V1 – Unchanged |
| ADV-04 | Support log | Log support for a company | Saved in the log | V1 – Unchanged |
| ADV-05 | Adviser kept to own portal | Adviser opens `/admin/checks` | Sent to `/adviser/cohort`. Automated: `dashboard.spec.ts` | V1 – Unchanged |

## 17. Admin portal

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| ADM-01 | Waiting counts match the database | Compare Checker queue and Applications counts with SQL | Equal. Automated: `figures.test.ts` | V1 – Unchanged |
| ADM-02 | Organisations | Add, verify, invite a person | Invite email with Sign in button | V1 – Unchanged |
| ADM-03 | Reports | Resolve or dismiss a report | Status changes with a note | V1 – Unchanged |
| ADM-04 | Feature requests | Feature a post | "Featured for 7 days". Automated: `phase5.spec.ts` | V1 – Unchanged |
| ADM-05 | Flagged payments | Open Flagged payments | Requests rejected twice; reported senders | V1 – Unchanged |
| ADM-06 | Tenders & buyers | Add a tender | Founders see it in Procurement | V1 – Unchanged |
| ADM-07 | Every admin page loads cleanly | Visit all admin pages | No errors or failed calls. Automated: `dashboard.spec.ts` | V1 – Unchanged |
| ADM-08 | Portal shell width | Desktop | 1 440 px content, 240 px sidebar (V1: 1 280 px, 220 px) | V1 – Modified |

## 18. Emails

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| MAIL-01 | Branded layout | Trigger any email (e.g. DOC-02) | ProofPocket header, subject heading, button, safety footer, plain-text part. Automated: `email-template.test.ts` | V1 – Unchanged |
| MAIL-02 | Sender | Check From | `ProofPocket <pegphina1@gmail.com>` in production | V1 – Unchanged |
| MAIL-03 | Escaping | Business name with `<script>` in an email | Shown as text. Automated: `email-template.test.ts` | V1 – Unchanged |

## 19. Security and data

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| SEC-01 | Row-level security | Founder reads another company's entries (API) | Nothing returned. Automated: `rls.test.ts`, `rls-security.test.ts` | V1 – Unchanged |
| SEC-02 | Roles from the database | Send a role in a request body | Ignored. Automated: `security.test.ts` | V1 – Unchanged |
| SEC-03 | Audit log append-only | Try to edit `audit_log` as the app | Refused; hash chain verifies. Automated: `security.test.ts` | V1 – Unchanged |
| SEC-04 | Account numbers encrypted | Read `payment_details` directly | AES-256-GCM value, never plain | V1 – Unchanged |
| SEC-05 | Security headers | `curl -I` the site | CSP, HSTS, nosniff, frame-ancestors none | V1 – Unchanged |
| SEC-06 | Rate limits | Many requests to sign-in or pay | 429 after the limit | V1 – Unchanged |
| SEC-07 | Upload limits | Upload over 5 MB or a wrong type | Refused. Automated: `security.test.ts` | V1 – Unchanged |
| SEC-08 | No personal data in logs | PayFast webhook error (when on) | Log has the message and reference only, no payer name or email | V2 – New |

## 20. App (PWA) and offline

| ID | Description | Steps | Expected result | Version |
|---|---|---|---|---|
| PWA-01 | Installable | Check the manifest | ProofPocket, standalone. Automated: `shell.spec.ts` | V1 – Unchanged |
| PWA-02 | Opens offline | Load once, go offline, reload | App shell opens; "Offline" shown. Automated: `shell.spec.ts` | V1 – Unchanged |
| PWA-03 | Install on Android and iPhone | Add to home screen | Opens full screen with the ProofPocket icon | V1 – Unchanged |
