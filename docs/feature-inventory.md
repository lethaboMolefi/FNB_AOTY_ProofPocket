# ProofPocket feature inventory

Source: `v2/app.js` (1 062 lines), `v2/index.html`, `v2/styles.css`, read in full.
Checked against the build brief, section 7 (screens) and section 8 (rules).

Each row has a **Build** column: ✅ = built and covered by tests, ☐ = not built yet. Reviewed on 24 October 2026 after phase 3.

Key:
- ✓ = in the prototype and the brief agrees
- ⚠ = in both, but they disagree or the real version needs a decision (see section 12)
- ✚ = in the prototype, not covered by the brief
- ◇ = in the brief, not in the prototype
- `L123` = line in `v2/app.js`

---

## 1. Shell and navigation

| Item | Prototype | Brief | Build |
|---|---|---|---|
| Top bar: brand, "Prototype · example data" tag | index.html | ✓ the tag becomes a dev-only badge | ✅ |
| Role switcher (Founders, Funders & investors, Incubators & NGOs, Public directory, Join) | index.html, `role` L862 | ✓ replaced by sign-in; each role sees only its portal | ✅ |
| "Viewing as" / "Signed in as" pickers | `renderTop` L320, `who` L943 | ✓ replaced by the signed-in user | ✅ |
| Founder rail, grouped: (none) Home · **Start** Registration steps · **Trade** Bookkeeping, Stock · **Get paid** Payments · **Manage cash flow** Cash flow · **Reach formal markets** Profile & marketing, Funding readiness, Procurement · **Stay safe** Fraud protection, Privacy & sharing | `RAIL` L313 | ✓ desktop rail; phone bottom tabs Home, Books, Get paid, Markets, More ◇ | ✅ |
| Stock hidden from the rail when the business type has no stock (services) | L340 | ✓ | ✅ |
| Rail counts: protection = unverified open messages + pending supplier changes; start = joining docs not verified (Starter only); stock = low items; payments = proofs to check | L331–336 | ✓ (needs a home on the bottom tabs too) | ☐ |
| Funder rail: Company pipeline, Applications (count = Submitted + Under review), Programmes & requirements | L315, L339 | ✓ | ✅ |
| Incubator rail: Cohort board, Document checks (count = queue), Needs attention (count = "bad" flags), Support log | L316, L338 | ✓ | ✅ |
| Rail footer "Example data… ProofPocket never holds money" + **Reset example data** | L344, `reset` L866 | ✓ reset becomes a dev-only seed command | ✅ |
| Page head: "{Company} · {town}, {province}", title, subtitle, Starter/Verified pill | `fHead` L348 | ✓ | ✅ |
| Toast (3.2 s, `aria-live="polite"`) | `toast` L836 | ✓ | ✅ |
| Drawer: scrim, Esc closes, focus moves to the drawer, body scroll locked | L822, L932 | ✓ full screen on phones ◇ | ☐ |
| Enter on a focused pipeline row opens it | L934 | ✓ | ☐ |
| Hash routing `#founder`, `#funder`… | L838, L1054 | ✓ replaced by React Router paths | ✅ |
| Light and dark theme tokens | styles.css | ⚠ brief: light only, white background, tokens kept ready for dark mode | ✅ |

## 2. Join (`vJoin` L734), brief 7.1

| Item | Prototype | Brief | Build |
|---|---|---|---|
| Steps: Details → Documents → Join | L765 | ✓ | ✅ |
| Fields: your name, business name, type of business (6 types), town or township, province (9), area (Township/Urban/Rural), incubator or NGO ("None yet") | L739–746 | ✓ | ✅ |
| "Is the business registered with CIPC?" radio cards, *Not yet* / *Yes*; switching re-renders the form and keeps typed values | L748, L940 | ✓ | ✅ |
| If Yes: registered name + CIPC number (`^\d{4}/\d{6}/\d{2}$`) | L751, L1030 | ✓ | ✅ |
| Errors: "Add your name, the business name and your town." / "The CIPC number should look like 2024/123456/07." | L1029–1030 | ✓ | ✅ |
| Documents: Not yet → ID + address; Yes → CIPC, ID, bank, address. "PDF or photo, up to 5 MB"; shows file name + fingerprint; Upload/Replace | L754–755 | ✓ | ✅ |
| Continue blocked: "Attach: {names}." | `joinnext` L917 | ✓ | ✅ |
| Check and join summary: business (legal name if registered, CIPC no.), owner, type and area, supported by, account (Starter / "Verified, once documents are checked"), attached docs | L758–760 | ✓ | ✅ |
| Consent checkbox (exact copy L761); error "Tick the box to confirm before joining." | L761, L919 | ✓ | ✅ |
| "Starter or Verified?" side panel; "Both are free." | L767 | ✓ | ✅ |
| On join: company created with docs `pending`, sector = type label, founded = this year, employees 1, opening balance 0, stage "Early", sharing "summary", support stage 0; activity "Joined ProofPocket…"; lands on Registration steps | `joinsubmit` L918–928 | ⚠ see 12.9, 12.10 | ✅ |
| Welcome toast: "Welcome! {Incubator} will check your documents." / "Welcome! A ProofPocket checker is reviewing your documents." | L928 | ✓ | ✅ |
| Account creation (email + password) | none | ◇ the wizard needs a sign-up step (12.1) | ✅ |

## 3. Founder portal, brief 7.2

### 3.1 Home (`vHome` L360)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Subtitle: type · area · N person/people · trading since YEAR | L364 | ✓ | ✅ |
| Starter notice + Continue → Registration steps | L365 | ✓ | ✅ |
| "N client(s) say(s) they have paid" notice + Check → Payments | L366 | ✓ | ✅ |
| "N possible scam(s) need your attention" + Review → Fraud protection | L367 | ✓ | ✅ |
| Journey, 5 steps, each opens its screen (rules in 11.6) | `journey` L349 | ✓ | ✅ |
| Tiles: money in this month, money out this month, cash on hand ("Bank and cash together"), readiness score + label | L369–374 | ✓ | ✅ |
| "Six months at a glance" bar chart + Cash flow button | L376 | ✓ | ✅ |
| Next steps: top 4 unmet readiness items by points, "worth N points", Fix → Registration steps (documents) or Bookkeeping | L362, L377 | ✓ | ✅ |
| Things to watch: all flags, pill "Act now" (bad) / "Check" (warn) | L380 | ✓ | ✅ |
| Messages: latest 4 with Verified / Not verified pill | L381 | ✓ | ✅ |
| "Add to home screen" hint after the second visit | none | ◇ | ✅ |

### 3.2 Registration steps (`vStart` L384)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Notice: Verified (with CIPC no.) or "Who checks your documents?" (adviser at {incubator}, or ProofPocket checker) | L387 | ✓ | ✅ |
| CIPC number form, only when no number saved; error toast "CIPC numbers look like 2026/123456/07"; success "CIPC number saved. Upload the certificate next." | L388, L1011 | ✓ | ✅ |
| Seven steps in order ID, CIPC, bank, address, tax, B-BBEE, CSD with title + how-to copy (`START_STEPS` L41) | L389 | ✓ | ✅ |
| Pills: "Needed to verify" (joining docs), "Needed for funding" (tax), "Needed for tenders" (B-BBEE, CSD) | L390 | ✓ | ✅ |
| Status pill: Verified / Being checked / Missing / Expired | `DOC_STATE` L40 | ✓ | ✅ |
| Upload when missing, Replace when expired; none while pending or verified | L391 | ✓ | ✅ |
| Fingerprint line "{file} · fingerprint {hash}" | L390 | ⚠ prototype shows 16 hex chars; the real hash is the full SHA-256, shown shortened | ✅ |
| "Other documents funders ask for": business plan, signed management accounts, each with a hint | L392 | ✓ | ✅ |
| Upload: 5 MB limit ("Files must be 5 MB or smaller"), status → pending, activity, route to checker; toast "Uploaded. {Incubator} will check it." / "Uploaded. Checking now." | L947–953 | ✓ signed URL + SHA-256 on the server | ✅ |

### 3.3 Bookkeeping (`vBooks` L394)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| "From your bank feed" list: description (mono), date, ± amount, category select, **Add**, **Personal** (money out only) | L398, `inboxok`/`inboxpersonal` L869 | ⚠ becomes **Statement import** (CSV/PDF upload) ◇; see 12.5 | ✅ |
| Sorting a line: method guessed from text (PAYSHAP → PayShap, POS → Card machine, else Bank EFT); Personal uses "Other expense"; receipt counted as kept | L870 | ✓ | ✅ |
| `syncbank` handler (random transactions) | L872 | ✚ never reachable, no button; dropped | n/a |
| Add an entry: Money in / Money out toggle; amount, paid by (5 methods), category (in or out list), date (max today), "What was it for?" (placeholder changes with type), stock item + quantity (stock businesses with items), personal checkbox (out only), receipt photo | L399–409 | ✓ offline outbox ◇ | ✅ |
| Error "Enter an amount greater than zero." | L969 | ✓ | ✅ |
| Duplicate warning (copy at L972), press Save again to confirm; form values kept | L971–972, `keepEntry` L1046 | ✓ | ✅ |
| Stock link: money in subtracts quantity, money out adds it | L973–974 | ✓ | ✅ |
| Toast "Saved to your books"; activity "Recorded income/an expense of R…" | L976 | ✓ offline: "Saved on this phone, will sync" ◇ | ✅ |
| Tiles: money in, money out, profit (this month) | L412 | ✓ | ✅ |
| This month table: date, details (+ Personal pill), category, paid by, receipt (Kept/None), ± amount, **Paid back** on personal rows | L413–415 | ✓ | ✅ |
| "N entries · last entry N days ago / never" | L413 | ✓ | ✅ |
| Paid back: clears personal, appends "(paid back)" to the note, activity; toast "Marked as paid back" | `repaid` L868 | ✓ | ✅ |
| Owner salary guidance notice | L416 | ✓ | ✅ |
| Entries from earlier months (list, edit, delete) | none | ⚠ prototype shows this month only and has no edit or delete; see 12.13 | ✅ |

### 3.4 Stock (`vStock` L418)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Off message for non-stock types | L419 | ✓ | ✅ |
| Tiles: items, stock value at cost (Σ qty × cost), running low (red when > 0) | L422 | ✓ | ✅ |
| Table: item, in stock + unit, reorder at, cost each, Reorder/OK pill, **Use 1**, **Restock** | L423–425 | ✓ | ✅ |
| Use 1: qty − 1 (min 0); toast "{item}: N {unit} left" | L890 | ✓ offline | ✅ |
| Restock: adds max(1, reorder × 2 − qty); records money out add × cost, Bank EFT, "Stock and materials", "Restock {item} (N {unit})"; toast "Restocked {item}; R… added to your books" | L891 | ✓ offline | ✅ |
| Add item: name, unit (default "units"), in stock, reorder at, cost each; error "Name the item"; toast "Item added" | L427–433, L1000 | ✓ | ✅ |
| Edit or remove an item | none | ✚ not in prototype; suggest adding (12.13) | ✅ |

### 3.5 Payments (`vPayments` L447)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| "ProofPocket never holds your money…" notice (drop "Prototype: no money moves.") | L454 | ✓ | ☐ |
| Proof of payment to check: "{client} says they paid R…", for · reference · method on date · from payer, file + fingerprint, "N things to check" / "Details match", five checks, banking-app warning, **The money is in my account**, **Not received** | L455–459 | ✓ | ☐ |
| Ask a client to pay: client, amount, for, methods (PayShap, Bank EFT, Cash checked; Card machine unchecked); errors "Add the client's name and an amount", "Choose at least one way to pay"; toast "Request PP-NNNN created. Send the link on WhatsApp or show the QR code." | L461–464, L977 | ⚠ reference format, see 12.3 | ☐ |
| Your payment details: bank, account name, account number, ShapID; personal-account warning (account name contains "personal"); "Payment details saved" | L465–469, L984 | ⚠ one-time PIN + adviser alert ◇; warning heuristic 12.15 | ☐ |
| Payment requests list: client · for · amount, link + methods, "not received" note, **Send on WhatsApp** (prefilled text L451), **Show QR** (toggle), status pill (Paid · in books / Not received / Waiting for client), **Paid me cash** (if Cash allowed) | L449–452 | ✓ | ☐ |
| **Simulate client scanning** | `scan` L876 | ✓ replaced by real `/pay/:ref` | n/a |
| Pay a supplier: supplier select ("· ON HOLD"), amount, for; blocked toast copy L991; records money out Bank EFT "Stock and materials"; toast "Paid {supplier}. Recorded in your books." | L473–475, L988 | ⚠ rename to "Record a supplier payment"; the founder pays in their own banking app first | ☐ |
| Add a supplier (name, "Bank and last 4 digits"); error "Add the supplier's name and bank"; "Supplier saved" | L476, L885 | ✓ | ☐ |
| Record a cash payment out: paid to, amount, for, "Payee has no phone, give a slip number" (default on); category Collector payments (recycling) or Other expense; toast "Recorded. Give {name} slip number S…" | L477–478, L994 | ✓ offline | ☐ |
| Request expiry (7 days), overdue, cancel | none | ◇ see 12.4 | ☐ |

### 3.6 Cash flow (`vCashflow` L509)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Tiles: cash on hand now ("Start of month R… plus this month's profit"), usual month (avg in − out, "R… in, R… out"), expected in 30 days (red if < 0), cash lasts N.N months | L515–520 | ⚠ how opening balance carries forward, 12.9 | ✅ |
| Money in and out chart | L521 | ✓ | ✅ |
| Paying yourself: owner salary this month, personal purchases (red if > 0), guidance line | L523–526 | ✓ | ✅ |
| Coming up: each Waiting request "{client} owes you +R…"; each low item "Restock {item} −R…"; "Nothing scheduled." | L527–530 | ✓ | ✅ |

### 3.7 Profile & marketing (`vMarkets` L533)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Starter lock notice + Get verified | L536 | ✓ | ☐ |
| Profile form: one line (max 90), services and prices (one per line), WhatsApp, Instagram, hours; profile URL `proofpocket.co.za/b/{slug}`; "Profile saved" | L538–542, L1003 | ✓ public `/b/:slug` page implied ◇ (12.11) | ☐ |
| Verified QR code (profile link) + Verified/Starter pill + **Copy profile link** ("Profile link copied") | L543–544, L901 | ✓ | ☐ |
| Create a post (max 400): **Save post**; **Save and request a feature** (Verified only); "Write something first"; toasts L1010 | L546–548, L1006 | ✓ admin review ◇ | ☐ |
| Your posts: text, date, "shared to …", **WhatsApp / Facebook / X** share links (record the network on click), pills "Featured this week" / "Feature requested" | L549–550, `shared` L900 | ✓ | ☐ |
| Buyers looking for suppliers: name, "Good fit" (sector match) or buyer kind, wants, "Your adviser arranges the introduction", **Request introduction** (Verified only; primary when good fit), "Requested", "Verified only"; toast "Your adviser will arrange the introduction" | L551–552, L899 | ⚠ who arranges for founders without an incubator, 12.7 | ☐ |

### 3.8 Funding readiness (`vFunding` L554)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Starter lock "Funders can't see you yet" | L558 | ✓ | ☐ |
| Score ring + label + "Funders see the same score." | L560 | ✓ | ☐ |
| Breakdown: Documents and Bookkeeping checklists with hints and points | L561, `readiness` L223 | ✓ | ☐ |
| Programmes table sorted by fewest gaps: programme, funder · kind · Verified funder, amount range, funds left, gap chips / "Nothing, you qualify", Apply (amount input default max) or "Applied" | L563–568 | ✓ | ☐ |
| Apply: amount within range ("Enter an amount between R… and R…"); creates Submitted application with the first offer "Requested amount"; toast "Application sent to {funder}" | L893–896 | ✓ | ☐ |
| My applications: programme, funder, applied date, status pill, requested, current offer, offer history ("No reason given" in red), status reason, **Ask the funder for a reason** → "Reason requested"; toast "Request sent to the funder" | L569–573, L897 | ✓ | ☐ |
| Withdraw an application | none | ◇ brief has a `withdrawn` status, 12.8 | ☐ |

### 3.9 Procurement (`vProcurement` L575)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Tiles: track record N of 6 months (bar), account Verified/Starter, tender documents N of 3 (Tax, CSD, B-BBEE) | L578–580 | ✓ | ☐ |
| Tenders table: title, buyer, "Your sector", value, closes, requirement chips ✓/×, "N months' record" chip; action: Interest sent / Verify first / "Add N documents" → Registration steps / "N more months" / **Express interest** | L581–585 | ✓ | ☐ |
| Express interest → toast "Interest sent with your checked documents and track record" | L898 | ⚠ nobody receives it, 12.7 | ☐ |
| Closed tenders | none | ✚ prototype never hides past closing dates; hide them | ☐ |

### 3.10 Fraud protection (`vProtection` L588)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Messages about money: sender, Verified/Not verified pill, address · date, quoted text, risk-flag pills; **Report and block** / **It's genuine** (unverified + open only); "Reported and blocked" / "Marked genuine" | L590–591, `msg` L902 | ⚠ where outside messages come from, 12.2 | ☐ |
| Report toast "Reported. Other founders will be warned about this sender." | L902 | ✚ implies a shared sender blocklist, 12.2 | ☐ |
| Supplier bank details: name · bank, pending text (copy L592), **I've confirmed by phone**, **Reject change**, "Unchanged"; toasts "New details confirmed" / "Change rejected. Old details kept." | L592, L887–888 | ✓ | ☐ |
| **Simulate a change request** | `simchange` L886 | ✓ replaced: founder edits a supplier's bank details → pending hold | ☐ |
| Document fingerprints list | L594 | ✓ | ☐ |
| Rules that keep you safe (4 lines) | L595–599 | ✓ | ☐ |

### 3.11 Privacy & sharing (`vPrivacy` L602)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Funder visibility radio cards: Nothing / Summary / Full books (copy L606–608); toast "Sharing updated"; activity | L603–608, L946 | ✓ | ☐ |
| Always private list | L609 | ✓ | ☐ |
| Your incubator: name + adviser, or "You haven't chosen an incubator." | L610 | ⚠ no way to choose or leave an incubator after joining, 12.12 | ☐ |

## 4. Public payment page (`payPageHTML` L481), brief 7.3

| Item | Prototype | Brief | Build |
|---|---|---|---|
| "You're paying" {business}, "Verified on ProofPocket" / "Starter: not yet verified", amount, for, reference, requested date | L493–494 | ✓ | ☐ |
| How to pay, per allowed method: PayShap (ShapID + reference, copy buttons), EFT (bank, account name, number, reference), Cash ("quote reference … They will mark it paid"), Card (tap on their machine) | L485–488 | ✓ | ☐ |
| "Only pay to the details on this page…" warning | L499 | ✓ | ☐ |
| Not-received banner: "{business} hasn't received this payment yet. Check your bank, then upload your proof again." | L497 | ✓ | ☐ |
| Proof form only when PayShap or EFT allowed: your name (prefilled client), amount (prefilled), date (max today), paid by (digital methods), "I used reference …" (default on), file; errors L1037–1039 | L500–505, `submitPop` L1034 | ✓ | ☐ |
| Hint "ProofPocket reads the amount, date and reference from your proof in the full system." | L505 | ⚠ implies OCR, which the brief doesn't include; drop the hint | ☐ |
| States: Proof of payment sent (Checking), "Paid. Thank you." | L495–496 | ✓ | ☐ |
| "You'll get a message when it's confirmed." | L496 | ⚠ the client has no account; see 12.14 | ☐ |
| Report this request → toast "Thanks. ProofPocket will review this business within two working days." | L506, L915 | ✓ saved to admin | ☐ |
| Expired / flagged / cancelled states | none | ◇ copy needed | ☐ |

## 5. Funder and investor portal, brief 7.4

| Item | Prototype | Brief | Build |
|---|---|---|---|
| **Set-up gate** (blocks everything until done): programme name, type (Grant/Loan/Equity/Blended), smallest (5 000), largest (30 000), budget (500 000), months (3, max 36), min score (40), required docs (all except ID and address; CIPC, bank, tax ticked); error copy L1021; "Save and open pipeline"; toast "Requirements saved. Founders can see them now." | `funderSetup` L614, L1019 | ✓ | ☐ |
| Pipeline tiles: verified and sharing (+ "N Starter or private"), meet your requirements, funding ready 70+, applications to you + Open | L637–642 | ✓ | ☐ |
| Filters: search (name/town/sector, live), sector, area, minimum readiness slider (step 5) | L643–648, L938, L956 | ✓ | ☐ |
| Table sorted by score: company (sector · stage), area, readiness bar, "Qualifies for N" / "Not yet", 5-month sparkline, books (Up to date ≤7 / N days ≤14 / bad), sharing | L649–651 | ✓ | ☐ |
| Applications table: company + date, programme, requested, current offer (+ "No reason given", "Founder asked why"), status, readiness, Open | `funderApplications` L653 | ✓ | ☐ |
| Programmes: per programme name, kind · range · months · score, "N verified companies qualify", budget / committed / left + bar, required-doc chips toggle ("Requirements updated; founders see the change"); **Add a programme** (reuses set-up with Cancel) | `funderProgrammes` L660, L903–905 | ⚠ "committed" never changes in the prototype, 12.8 | ☐ |
| Edit a programme's amounts, months, score; close a programme | none | ✚ prototype only toggles documents | ☐ |

### 5.1 Company drawer (funder view; `drawerHTML` L771, `funderDrawerPart` L796)
| Item | Prototype | Brief | Build |
|---|---|---|---|
| Head: sector · town, name, level pill, CIPC no., area, "N months on record" | L778–779 | ✓ | ☐ |
| Readiness ring + label + "N of 9 documents checked" | L782 | ✓ | ☐ |
| Key figures: income 5 months, avg monthly profit, cash on hand, people | L783 | ✓ | ☐ |
| Flags, chart | L785–786 | ✓ | ☐ |
| Latest 8 entries only with full sharing, otherwise "This founder shares a summary only…" | L787 | ✓ | ☐ |
| Documents (status only), bookkeeping health | L788 | ✓ | ☐ |
| Applications to this funder: offer history, founder-asked-why notice, **Change offer** (reason required; status → Offer made; clears "asked"), **Approve current offer** (default reason "Approved at the current offer."), **Decline** (reason required), error copy L907, L1016 | L798–803, L906, L1014 | ✓ audit log ◇ | ☐ |
| Invite to apply: programmes not yet applied to, "still needs N things" / "qualifies now"; sends a verified-funder message; toast "Invite sent" | L804, L910 | ✓ | ☐ |
| Incubator support: stage steps, adviser, support log | L790–792 | ✓ | ☐ |
| Activity timeline (8 latest) | L793 | ✓ | ☐ |

## 6. Incubator and NGO portal, brief 7.5

| Item | Prototype | Brief | Build |
|---|---|---|---|
| Cohort board tiles: companies (+ N Starter), average readiness, documents to check + Open, support sessions logged | `ngoCohort` L672 | ✓ | ☐ |
| Five stage columns with count; cards: name, level pill, sector · town, score bar, adviser, up to 2 flags + "+N" (Starter flag hidden) | L681–683 | ✓ | ☐ |
| Document checks: company · document · level, file + fingerprint, CIPC number given (for CIPC), reason input, **Approve**, **Send back** | `ngoVerify` L685 | ✓ | ✅ |
| Approve: doc verified, activity "… approved by {adviser or incubator}", support-log entry "Document check", toast "Approved" or "{company} is now Verified" | L912 | ✓ | ✅ |
| Send back: reason required ("Add a reason so the founder knows what to fix"); doc → missing, file and fingerprint removed, message from the incubator "Please upload your … again: {reason}"; toast "Sent back to the founder" | L913–914 | ✓ | ✅ |
| Needs attention: all cohort flags, bad first, Open | `ngoAttention` L692 | ✓ | ☐ |
| Support log form: company, type (8 types), note; "Add a note about the support"; "Support logged"; activity "{incubator}: {type}." | `ngoSupport` L697, L1024 | ✓ | ☐ |
| Introduction requests: "{company} asked to meet {buyer}", "To arrange" | L707 | ⚠ no action to mark arranged, 12.7 | ☐ |
| History timeline | L708 | ✓ | ☐ |
| Drawer: as funder plus full books always, adviser select (assigning at stage 0 moves to stage 1; "Adviser assigned"/"Adviser removed"), **Move to {next}**, **Back a stage**, "In monitoring" | L791, L911, L944 | ✓ | ☐ |

## 7. Admin portal, brief 7.6 (◇ not in the prototype)

| Item | Implied by | Build |
|---|---|---|
| Checker queue for companies without an incubator (same approve / send back as advisers; acts as "ProofPocket checker") | `routeCheck` L846 | ✅ |
| Verify funder, incubator and buyer organisations | `verified` on funders, "Verified funder" pills | ☐ |
| Reports from the directory and payment pages | `reports` L915 | ☐ |
| Feature-request review for posts (approve → featured, reject with note) | L1010 "reviews feature requests weekly" | ☐ |
| Flagged payment requests | brief 8 | ☐ |
| Organisation and user onboarding (invite funder, incubator, adviser, buyer users) | nowhere; see 12.6 | ☐ |
| Tenders and buyers management | seed only; see 12.7 | ☐ |

## 8. Public directory, brief 7.7

| Item | Prototype | Build |
|---|---|---|
| Header copy ("Every business here has shown ProofPocket…") | `vDirectory` L716 | ☐ |
| Featured this week: Verified companies' featured posts | L715–717 | ☐ |
| Search (name, town, sector, tagline; live) and sector filter | L718, L939, L960 | ☐ |
| Verified business cards: name, Verified, tagline or sector, sector · town, province | L719 | ☐ |
| Profile drawer: tagline, services list, contact (WhatsApp, Instagram, hours), **Message on WhatsApp** (`wa.me/27…`), "What ProofPocket checked" (4 joining docs + "checks documents, not the quality of work"), **Report this business** | `profileHTML` L721 | ☐ |

## 9. Activity and messages generated by actions

Every action below writes an activity line (`addActivity` L206) on the company timeline. Port the wording.

Join, doc upload, doc approved/sent back, verified ("Verified on ProofPocket. Listed in the public directory."), CIPC number added, entry recorded, paid back, payment request created, cash payment received, proof uploaded/confirmed/rejected, supplier change received/confirmed/rejected, supplier paid, cash payout, applied, asked for a reason, offer changed, approved/declined, invited, tender interest, intro request, sharing changed, adviser assigned/removed, support stage moved, support logged, payment details updated.

System messages to the founder: "You're verified…" (L853), send-back request (L914), funder invite (L910), second-rejection fake-proof warning (L882).

## 10. Seed data (`seed` L71), brief 12

| Item | Build |
|---|---|
| 6 companies: c1 Nala Nails & Lashes (Starter, Soweto, personal account, pending supplier change, scam message, Naledi proof, Lerato request, post), c2 ReKasi Plastics (CSD pending, full sharing, R50k→R40k→R28k offers, Lesedi message, statement lines, featured post), c3 Mabele AgriLink, c4 Green Route Waste Services, c5 Mama Tau Catering (tax expired, summary sharing, books 21 days old), c6 Khanya Solar Installs (business plan pending, supplier, featured post) | ☐ |
| Per company: docs, 5 earlier months, ledger (offset days), stock, suppliers, profile, incubator + stage + adviser + log, activity, payment details | ☐ |
| 4 funders (f4 Bophelo Community Fund needs set-up), 4 programmes | ☐ |
| 2 incubators with 2 advisers each | ☐ |
| 5 applications (ap1–ap5) with offers and status reasons | ☐ |
| 5 tenders, 4 buyers, all marked "(example)" | ☐ |
| Relative dates (`daysAgo`, `inMonth`) kept relative to the seed run date | ☐ |

## 11. Business rules (port exactly; unit tests first in `packages/shared`)

### 11.1 Documents and verification
- Nine document types (`DOCS` L28) with names, short names and points.
- Verified = `cipc`, `id`, `bank`, `addr` all verified (`isVerified` L209). Starter joining = `id`, `addr`.
- Checker: the adviser when the company has an incubator, otherwise the admin checker (L846).
- The approval that completes the four makes the company Verified, adds activity and sends "You're verified. Funders, buyers and customers can now find you." (L850–853).
- Send back needs a reason, sets the doc to missing, removes the file and messages the founder (L913).

### 11.2 Readiness (`readiness` L223)
cipc 15, id 5, bank 10, tax 15, bplan 10, fin 15 (verified only); books updated ≤ 7 days 10; no personal entries 10; any "Owner salary" entry 5; ≥ 6 record months 5. Labels: ≥ 70 Funding ready, ≥ 45 Getting there, else Early (L271–272). Hints per item as at L227–236.

### 11.3 Derived figures
- This month in/out/profit from entries this calendar month (L210).
- Record months = earlier months with any activity + 1 if there are entries this month (L217). ⚠ capped at 6 by the data shape, 12.10.
- Last entry days = days since the latest `entry_date` (L218).
- Cash on hand = opening + this month's profit (L219). ⚠ 12.9.
- Usual month = average of earlier months with activity (L220); runway = cash ÷ avg out; 30-day forecast = cash + avg in − avg out (L510).
- Low stock = qty ≤ reorder (L221).
- Chart = 5 earlier months + this month marked `*` (L216).

### 11.4 Flags (`flags` L239), in this order
Starter (warn) · each expired doc (bad) · N docs waiting (warn) · books > 14 days or no entries (bad) · personal spending (warn) · income fell > 20% between the last two earlier months (warn) · N proofs to check (warn) · N stock items low (warn) · N fraud warnings = unverified open messages + pending supplier changes (bad) · latest offer changed with no reason (warn).

### 11.5 Bookkeeping
- Duplicate: money out with the same amount within 7 days of the entry date asks for a second save (L971).
- Personal: only money out; counts against readiness until Paid back.
- Stock-linked entries move quantity (in −, out +), floor 0.
- Restock quantity = max(1, reorder × 2 − qty); cost recorded as money out.
- Cash payout category depends on business type; slip number `S` + 5 digits.

### 11.6 Journey (`journey` L349)
Start ✓ when Verified · Trade ✓ when last entry ≤ 7 days · Get paid ✓ when any non-cash money in · Manage cash flow ✓ when this month's profit ≥ 0 and no personal entries · Reach formal markets ✓ when ≥ 6 record months and Verified.

### 11.7 Payments
- Payment page shows the founder's saved details for the allowed methods only.
- Proof checks (`popChecks` L436): amount equals the request · reference used · paid on or after the request date · file hash not used before · method in allowed methods.
- Proof → status Checking. Only "The money is in my account" records money in (proof amount, proof date, proof method, category Services, proof attached).
- "Not received" → attempts + 1, proof cleared, client may retry; on the second, a fake-proof warning message (L882). Brief adds: status `flagged`.
- Cash: "Paid me cash" records money in directly (category Services, no receipt).
- ◇ Expiry after 7 days; ◇ one-time PIN for changing details, adviser notified.

### 11.8 Suppliers
Pending bank change blocks recorded payments to that supplier until confirmed (pending replaces current) or rejected (pending dropped).

### 11.9 Funders
- Set-up first. Pipeline = Verified and sharing ≠ none (`funderVisible` L266). Entries only with full sharing (L774).
- Offer change needs a reason; decline needs a reason; approve defaults the reason. Founder can ask for a reason once per offer (disabled after asking; cleared by the next offer).
- Programme gaps (`progCheck` L259): "Verified account" first, then missing required docs (short names), then "N months of records (you have N)", then "score N+ (you have N)". Apply needs no gaps, an amount in range, and no earlier application to the same programme.
- Only verified funders are listed to founders.

### 11.10 Tenders
Verified, every required doc verified, record months ≥ tender months. Sector match is a hint, not a requirement. One interest per tender.

### 11.11 Posts and buyers
Feature request only for Verified. Introductions only for Verified, one per buyer. Share links only (wa.me, Facebook sharer, X intent), no social media APIs.

### 11.12 Formatting
`R` + whole rand, en-ZA grouping, minus sign "−" (L20). Short dates "12 Oct" en-ZA. Amount fields: whole rand in the UI; `numeric(12,2)` in storage.

---

## 12. Gaps and disagreements (all recommendations approved 24 October 2026)

1. **Sign-up is missing from Join.** The wizard never creates an account. *Recommend:* email + password on step 1 (Firebase), with email verification before documents are sent for checking.
2. **Where scam messages come from.** The prototype shows a message from `approvals.fund@quickgrantz-mail.com`. The real system has no inbound email or SMS, so outsiders can't message founders. *Recommend:* (a) in-app messages come only from verified organisations and the system; (b) add **"Check a message"**, where the founder pastes a WhatsApp, SMS or email they received and ProofPocket runs the same risk rules (unverified sender, fee before release, pressure to act today, changed bank details) and saves it under Messages about money. "Report and block" adds the sender to a shared watch list that admin reviews, which is what "Other founders will be warned" implies.
3. **Payment references can be guessed.** `PP-` + 4 digits gives 9 000 possible links, and each one publicly shows a business's bank details. *Recommend:* keep `PP-4821` as the human reference the client types into their bank, and put an unguessable token in the link (`/pay/PP-4821-k7Qm2x…`). Rate-limit `/pay`.
4. **Payment request statuses.** The brief adds `overdue`, `cancelled`, `flagged` and 7-day expiry; the prototype has none of them. *Recommend:* expired after 7 days with no proof (page says "This request has expired, ask {business} for a new link"); founders can cancel a Waiting request; `flagged` after the second rejection blocks further proofs and shows on the admin list. Drop `overdue` unless you want it to mean something different from expired.
5. **Statement import scope.** Bank PDFs differ by bank and change without notice. *Recommend:* phase 3 supports CSV exports from FNB, Capitec, Absa, Standard Bank, Nedbank and TymeBank, plus a column-mapping fallback for any CSV. PDF comes later, best effort, and needs a PDF parsing dependency. **Also:** a payment already confirmed from a proof will show up again on the statement. Lines that match an existing entry (same amount and direction within 3 days, or a `PP-` reference in the description) should be flagged "Already in your books" so income isn't counted twice.
6. **No one onboards organisations.** Neither the prototype nor the brief says how funders, incubators, advisers or buyers get accounts. *Recommend:* admin creates the organisation and invites users by email. Each incubator has a lead adviser who can invite colleagues.
7. **Buyers, tenders and introductions have no owner.** The `buyer` role has no portal. Tenders and buyers exist only as seed data. Express interest and intro requests go nowhere, and founders without an incubator have no adviser to arrange introductions. *Recommend for now:* admin manages tenders and buyers. Interests and intro requests appear in the admin portal and, for cohort companies, on the adviser's support log with **Mark arranged** and **Decline**. A buyer portal comes later. I'd keep the `buyer` role in the schema and leave it unused for now.
8. **Application lifecycle gaps.** Nothing moves an application to Under review, Awaiting co-funding or Withdrawn. Approving doesn't add to the programme's committed amount. *Recommend:* the funder can set Under review and Awaiting co-funding (each with a reason), the founder can withdraw while not decided, and approval adds the current offer to `committed`. If an approval would go over budget, warn before approving.
9. **Opening balance.** The prototype treats `opening` as "start of this month". In a real ledger that figure is out of date after one month. *Recommend:* store the opening balance plus its date. Cash on hand = opening balance + all entries since that date. The founder sets both in a small Business settings screen, together with employees and founded year, which the prototype never lets anyone edit.
10. **Record months and sector.** (a) The prototype can count at most 6 months of records, so the Seed Equity Round (12 months) can never be met. *Recommend:* count every month with activity in `monthly_history` or the ledger. (b) Join sets `sector` to the business-type label ("Beauty & personal care") while the seed, tenders and buyers use "Beauty services", so new companies never match. *Recommend:* a fixed sector list in `packages/shared`, chosen at Join and filtered by business type. (c) Importing earlier months (`monthly_history`) has no screen. *Recommend:* "Add earlier months" in Bookkeeping (month, money in, money out), shown as self-reported and not as checked books.
11. **Public profile page.** The QR code points to `/b/{slug}`, but only the directory drawer exists. *Recommend:* a real `/b/:slug` page. It works for Starters too, with the Starter badge, but Starters aren't listed in the directory, so a scanned QR always shows the honest status.
12. **Changing incubator.** There is no way to choose, change or leave an incubator after joining, and no way for an incubator to decline a company. *Recommend:* founder can request an incubator from Privacy & sharing; the incubator accepts into Assessment; founder can leave at any time.
13. **Editing records.** Entries, stock items and suppliers can't be edited or removed in the prototype, and Bookkeeping shows only this month. *Recommend:* entries can be corrected or voided (never hard-deleted; the change is kept in history because funders rely on it), with a month picker.
14. **Notifying the paying client.** The payment page says "You'll get a message when it's confirmed", but the client has no account. *Recommend:* change the copy to "Open this link again to see when it's confirmed". No SMS or WhatsApp sending.
15. **Personal-account warning.** It triggers on the word "personal" in the account name. *Recommend:* ask "Is this account in the business's name?" (yes/no) and warn on no.
16. **Reused proof check.** The prototype checks reuse within one business only. *Recommend:* check the SHA-256 across all businesses, because fraudsters reuse the same fake screenshot. Show the founder only "used before", never where.
17. **Document expiry.** `expired` exists only in seed data. *Recommend:* the checker can set an expiry date when approving (tax and B-BBEE affidavits expire); a daily job marks documents expired and messages the founder.
18. **"Funders are warned" if a fingerprint stops matching.** *Recommend:* files are write-once (object versioning and retention on the bucket). A weekly job re-hashes them, and any mismatch flags the document in funder and adviser views.
19. **Adviser scope.** In the prototype, everyone signed in to an incubator sees the whole cohort. The brief says "advisers only their cohort". *Recommend:* cohort = the incubator's companies, visible to all its advisers. "Assigned adviser" is used for routing and display only.
20. **Funders see applicants with sharing "Nothing".** The privacy copy says "Applying to a programme still shares your profile with that funder only." The brief's rule (pipeline only when sharing ≠ none) doesn't cover this. *Recommend:* a funder can open companies that applied to them at Summary level, whatever the sharing setting.
21. **Copy that refers to the simulation** and will be changed: "Prototype: no money moves.", "In the full system, changing these needs a one-time PIN…", "ProofPocket reads the amount, date and reference… in the full system", "Example data. Changes stay in this browser", "Client view · opened from QR code", "Close client view", "Pay a supplier" (→ "Record a supplier payment").
22. **Brief says light theme only.** The prototype has a full dark theme. Tokens will be kept so dark mode can come back.
