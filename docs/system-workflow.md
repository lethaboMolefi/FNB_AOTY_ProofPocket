# ProofPocket: how the whole system works

ProofPocket is one shared business record for young founders and township or rural businesses, and for the people who support and fund them. Founders keep their books, get paid and build proof. Incubators support them, funders decide with trustworthy data, and clients and the public can check a business is real.

**ProofPocket never holds or moves money.** Clients pay founders directly. ProofPocket records the payment and checks the proof.

Live demo: https://proofpocket-aoty.web.app (example data only).

---

## 1. Who uses it

| Person | Portal | What they do |
|---|---|---|
| **Founder** | `/app` (phone first, works offline) | Joins, uploads documents, keeps books and stock, requests and confirms payments, builds a profile, applies for funding and tenders, controls sharing |
| **Client** of a founder | `/pay/PP-…` (no account) | Sees where to pay, pays the founder directly, sends a proof of payment |
| **Adviser** (incubator) | `/adviser` | Checks documents for their cohort, moves companies through support stages, logs support |
| **Funder** | `/funder` | Sets programme requirements, sees the pipeline of consented Verified companies, makes and changes offers with reasons |
| **Admin** (ProofPocket) | `/admin` | Checks documents for companies without an incubator, verifies organisations, handles reports, data requests, feature requests, flagged payments, tenders and buyers |
| **Public** | `/directory`, `/b/<name>` | Finds Verified businesses and reports anything suspicious |

---

## 2. Architecture at a glance

```
Phone / browser ──► Web app (React PWA, Firebase Hosting)
                        │  HTTPS + Firebase ID token
                        ▼
                    API (Express on Cloud Run, africa-south1)
                        │  every request: role from the database → withContext() → row-level security
                        ▼
                    PostgreSQL 18 (Cloud SQL, private IP, TLS verified)
Browser ──signed 5-minute URL──► Cloud Storage (private bucket: documents, receipts, proofs, statements)
Scheduled job (Cloud Run Job) ──► expiry, fingerprint re-check, audit-chain check and export, retention
```

- **Business rules** (readiness, flags, eligibility, proof checks, bookkeeping) live in `system/packages/shared/src/rules`. Web and API use the same code, but **the server's answer is the one that counts**.
- **Two layers of access control:** the API checks the role on every route, then PostgreSQL row-level security (RLS) checks every row again.
- **Audit:** important actions go to `audit_log`, which is append-only and hash-chained.

---

## 3. Signing in

1. The person enters an email and password. Firebase Authentication checks them (in local development, the API does, with a lockout after 5 wrong tries).
2. The API reads the person's **role from the database**, never from the browser.
3. **Two-step sign-in with Google Authenticator:**
   - It's **required** for funders, advisers and admins. At first sign-in they scan a QR code, then enter a 6-digit code on every sign-in.
   - It's **optional** for founders, who turn it on in Business settings. Home suggests it.
   - Each code works only once. Five wrong codes lock the account for a while. An admin can reset a lost phone.
4. The person lands in their own portal. Opening another role's portal is refused.

**Signing out:**
- clears the founder's cached data from the phone;
- warns if offline entries haven't been sent yet. They stay on the phone and send at the next sign-in by the same person.

---

## 4. Founder journey

### 4.1 Join (`/join`)

1. **Account:** email and a password of at least 12 characters (not a common one).
2. **Business details:**
   - name, type (beauty, food, retail, recycling, trades or services), sector, town, province and area;
   - an optional incubator;
   - whether the business is CIPC-registered. If it is, the CIPC number is needed (`2024/123456/07`).
3. **Documents:**
   - A registered business uploads **company registration (CIPC), owner ID, bank confirmation and proof of address**.
   - An unregistered business is a **Starter** and uploads only the **owner ID and proof of address**.
   - Each upload goes straight to private storage through a signed link. The API checks the real file type from its first bytes, then records its **SHA-256 fingerprint**.
4. **Consent:** the founder confirms the documents are theirs and agrees to the **privacy notice**. ProofPocket records which version they agreed to. If the notice changes later, every founder page asks them to agree again.
5. The documents go to the **checker**: the founder's incubator adviser, or the ProofPocket admin if there's no incubator.

### 4.2 Document checks and Verified

1. The checker opens each document (a 5-minute download link) and either **approves** it or **sends it back with a reason**.
2. A send-back messages the founder ("Please upload … again") and lets them upload a new version.
3. The approval that completes `cipc`, `id`, `bank` and `addr` makes the company **Verified**:
   - it's listed in the public directory;
   - the founder gets "You're verified".
4. A Starter shows only `id` and `addr`. It can't be Verified until it registers and adds the other two.
5. Documents with a "valid until" date expire automatically (daily job), and the founder is asked for a current one.
6. Every week the job re-checks each stored document against its fingerprint. If a file changed or went missing, the founder, adviser and funders see a warning.

### 4.3 Home

The founder's dashboard shows:
- the **readiness score**, worked out on the server: CIPC 15, ID 5, bank 10, tax 15, business plan 10, signed management accounts 15, books updated in the last 7 days 10, no unresolved personal purchases 10, an "Owner salary" entry 5, six months of records 5;
- what that score means: 70 or more is **Funding ready**, 45 or more is **Getting there**, otherwise **Early**;
- **flags** (what to fix next), the journey, money in and out, and things waiting.

### 4.4 Bookkeeping, stock and cash flow

- **Money in / Money out entries** record the amount, date, method and category. A receipt photo is optional.
  - **Same amount paid out twice within 7 days** needs a second confirmation ("Save anyway").
  - **Personal purchases** are marked as such and count against readiness until they're **Paid back**.
  - Entries are **voided, never deleted**.
- **Offline:**
  - Entries, stock changes and cash payouts save on the phone first, each with its own ID.
  - They send when the connection is back, and each is stored exactly once even if sent twice.
- **Bank statements:**
  - The founder imports a CSV and matches the columns.
  - Each line becomes an entry or is skipped.
- **Stock:**
  - Items have quantities and a reorder level.
  - "Use" and "Restock" move the quantity, and stock-linked entries move it too.
  - Businesses that don't sell goods (services) don't see Stock.
- **Suppliers:**
  - Saved suppliers have bank details.
  - **Changed bank details are held as pending.** Payments to that supplier are blocked until the founder confirms or rejects the change.
- **Cash flow:** a monthly picture of money in and out, with history months added for readiness.

### 4.5 Getting paid

1. **Payment details:**
   - The founder saves the bank account and/or ShapID that clients should pay.
   - Changing them needs a **Google Authenticator code**, so the founder must have it set up.
   - Their adviser is told about the change.
   - The account number is encrypted; clients see only what's needed to pay.
2. **Create payment request:**
   - The founder enters the client, amount and allowed methods (EFT, ShapID, cash).
   - ProofPocket makes a link: `/pay/PP-1234` plus an unguessable token.
   - The founder shares it themselves (copy link, WhatsApp share link).
3. **The client** opens the link and sees only:
   - this request;
   - the founder's saved details for the allowed methods.

   They pay **from their own bank** and upload a **proof of payment**.
4. **ProofPocket checks the proof:**
   - the amount matches;
   - the reference was used;
   - it was paid on or after the request date;
   - the file wasn't used before, anywhere (SHA-256 across all businesses);
   - the method is allowed.

   The request moves to **checking**.
5. **The founder checks their own bank** and chooses one of these:
   - **"The money is in my account"** records the money in, with the proof attached. Only this records income.
   - **"Not received"** sends the request back to the client. A second "Not received" sets the request to **flagged**, raises a fraud message, and the request appears in admin → Flagged payments.
   - **"Paid me cash"** marks a cash payment as paid directly.
6. Requests with no proof **expire after 7 days** (daily job).

### 4.6 Fraud protection

- **Check a message:** the founder pastes a suspicious SMS, WhatsApp or email, and ProofPocket lists the warning signs (urgency, changed bank details, requests for codes, and so on).
- **Report a scammer:** the sender goes on a watch list, so the next founder who checks a message from them is warned. Admin confirms or clears it.
- ProofPocket says it will never phone or message anyone to ask for a password or a code.

### 4.7 Privacy & sharing

- **What verified funders can see:**
  - **Nothing**;
  - **Summary**: score, document status (not the files) and monthly totals;
  - **Full books**: every entry.

  Applying to a programme still shares the profile with that funder only.
- **Always private:** document files, ID and account numbers, and personal purchases.
- **Incubator:** ask to join one (the incubator must accept), move to another, or leave.
- **Your data (POPIA):**
  - **Download my data** gives a JSON file of everything kept about the business.
  - **Ask ProofPocket to correct or delete** sends a data request to admin, who must reply within 30 days.

### 4.8 Reaching formal markets

- **Profile & marketing:**
  - a public page with a tagline, services, WhatsApp, Instagram and hours;
  - a verified QR code;
  - **posts** the founder shares from their own WhatsApp or social media (share links only, never posted for them);
  - Verified businesses can **ask for a weekly feature**, which goes to admin review.
- **Funding readiness:**
  - Open programmes show their **gaps**: not Verified, missing required documents, too few months of records, or a score too low.
  - The founder can **apply only with no gaps** and an amount in the programme's range.
  - They see offers and every change with its reason, can **ask for a reason** after a decline, and can **withdraw**.
- **Procurement:**
  - Tenders show their requirements (Verified, required documents, minimum months of records).
  - The founder **expresses interest** and can ask for introductions to buyers.

---

## 5. Client and public

- **Payment page** (`/pay/PP-…`): pay directly, upload a proof, or **report this request**. A wrong or guessed link shows nothing about the business.
- **Directory** (`/directory`) and **business profiles** (`/b/<name>`): only Verified businesses, with public fields only. Anyone can report a business.
- **Privacy notice** (`/privacy-notice`): public.

---

## 6. Incubator adviser journey (`/adviser`)

1. **Cohort board:** companies in the incubator by support stage (0–4). The adviser opens a company drawer to see its score, documents, books and timeline, and moves it **a stage forward or back**. Only the incubator can change the stage.
2. **Document checks:** approve or **send back with a reason** for the cohort's documents. The approval that completes the four makes the company Verified.
3. **Needs attention:** companies with flags (stale books, unresolved personal purchases, expired documents, fraud warnings, changed payment details).
4. **Support log:** records of meetings and help given, and **membership requests** from founders who want to join (accept or decline).

---

## 7. Funder journey (`/funder`)

1. **Set your requirements first:** a new funder must create a programme before seeing the pipeline. The programme sets its name, amount range, minimum months of records, minimum score and required documents.
2. **Company pipeline:**
   - It shows **Verified companies whose sharing isn't "Nothing"**, plus the funder's own applicants at summary level. Starters and private companies show only as a count.
   - Book entries are visible only with **full** sharing.
   - The funder can open a company drawer and **invite** a company to apply.
3. **Applications:**
   - Move an application through **under review**, **offer made**, **awaiting co-funding** and **approved** or **declined**.
   - **Changing an offer or declining needs a reason**, which the founder sees. Offers are append-only history.
   - Approving over the programme budget needs a confirmation.
4. **Programmes & requirements:** close or reopen programmes and change their required documents.
5. Every decision is written to the audit log.

---

## 8. Admin journey (`/admin`)

| Page | What admin does |
|---|---|
| **Checker queue** | Checks documents for companies without an incubator: approve, or send back with a reason |
| **Organisations** | Creates and **verifies** funders, incubators and buyers; invites their users (a sign-in is created and two-step sign-in is required); resets a lost authenticator |
| **Reports** | Public, founder and client reports about businesses, payment requests and posts, plus **data requests** (correction or deletion within 30 days). Each is resolved or dismissed with a note |
| **Feature requests** | Approves posts for a 7-day feature in the directory, or rejects them with a note |
| **Flagged payments** | Requests rejected twice; confirms or clears **scam senders** on the watch list |
| **Tenders & buyers** | Creates tenders with requirements; handles founders' interest and introduction requests |

---

## 9. Scheduled job (`proofpocket-jobs`)

Run daily. Cloud Scheduler isn't available in africa-south1, so for now it's started by hand (`docs/security/not-implemented.md` A8).

| Task | When |
|---|---|
| Expire payment requests older than 7 days | Daily |
| Mark documents past their "valid until" date as expired, and message the founder | Daily |
| Check the audit log's hash chain; export yesterday's entries and the latest hash to `audit-exports/` in the bucket | Daily |
| Delete unfinished uploads (after 24 hours) and old rate-limit counters | Daily |
| Re-check every stored document against its SHA-256 fingerprint | Weekly (Sundays, or `--rehash`) |

An integrity problem (broken chain or changed document) is logged as an error for alerting.

---

## 10. Security built into the flow

| Where | Protection |
|---|---|
| Every request | Role from the database, server checks, then row-level security on every table |
| Sign-in | Firebase Auth; Google Authenticator for staff (and founders who choose it); lockouts; rate limits shared across servers |
| Data in transit | HTTPS with HSTS; TLS to the database with the server certificate checked |
| Data at rest | Google encryption; account numbers and authenticator secrets encrypted again by the app (AES-256-GCM) |
| Files | Private bucket, 5-minute signed links, real-type check, 5 MB limit, SHA-256, sandboxed downloads, old versions kept for 30 days |
| Browser | Strict Content Security Policy, all scripts, styles and fonts from ProofPocket's own origin, no third-party trackers |
| Records | Entries voided not deleted; offers and audit log append-only; audit log hash-chained and exported |
| Logs | No passwords, codes, tokens, ID or account numbers |
| Checks on every change | Lint, types, unit/API/security tests, end-to-end on phone and desktop, dependency audit, Semgrep, gitleaks, OWASP ZAP, SBOM |

Details: `docs/security/` (threat model, ASVS checklist, requirements matrix, testing evidence, POPIA documents, incident plan, go-live gate).
