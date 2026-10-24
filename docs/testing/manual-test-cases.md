# ProofPocket manual test cases

Hand tests for everything that's built (phases 1–3, sign-in with Google Authenticator, and the PWA). Each test gives the steps, what should happen, and a box to tick.

**Where to test**
- **Hosted:** https://proofpocket-aoty.web.app (recommended). Passwords are in `infra/.hosted-credentials.json` on the deploying machine.
- **Local:** `cd system && pnpm dev`, then http://localhost:5173. Passwords are in `system/apps/api/.seed-credentials.json` (printed by `pnpm db:reset`).

**Before you start**
- Install **Google Authenticator** on your phone. You'll need it for the funder, adviser and admin accounts.
- Sample files are in [`docs/testing/files/`](files/).
- Expected figures come from the example data as loaded on 24 October 2026. Money-in and money-out figures depend on the current month, so from November they will differ.
- Tests change the data. Locally, `pnpm db:reset` puts it back. On the hosted site, use a new account (Join) for anything destructive, or note what you changed.

**Recording results:** tick ☐ Pass or ☐ Fail. For a failure, note the test ID, what you saw, the device and browser, and a screenshot.

| Area | Tests |
|---|---|
| A. Opening and installing | TC-A1 – A6 |
| B. Signing in | TC-B1 – B7 |
| C. Google Authenticator | TC-C1 – C8 |
| D. Who sees what | TC-D1 – D4 |
| E. Join | TC-E1 – E8 |
| F. Document checks and Verified | TC-F1 – F6 |
| G. Home | TC-G1 – G3 |
| H. Bookkeeping | TC-H1 – H10 |
| I. Offline | TC-I1 – I3 |
| J. Stock | TC-J1 – J5 |
| K. Cash flow and settings | TC-K1 – K3 |
| L. Not built yet | TC-L1 |

---

## A. Opening and installing

### TC-A1 The site opens
1. Open the site on a computer.

**Expected:** the **Sign in** page loads over HTTPS (padlock in the address bar). There is no list of accounts on the page.
☐ Pass ☐ Fail

### TC-A2 The API is up
1. Open https://proofpocket-api-273544508359.africa-south1.run.app/api/v1/health (locally: http://localhost:8787/api/v1/health).

**Expected:** `{"ok":true}`
☐ Pass ☐ Fail

### TC-A3 Install on Android
1. Open the site in Chrome on an Android phone.
2. ⋮ menu → **Install app** (or accept the install prompt).
3. Open ProofPocket from the home screen.

**Expected:** the purple ProofPocket icon is on the home screen, and the app opens full screen with no browser address bar and a white background.
☐ Pass ☐ Fail

### TC-A4 Install on iPhone
1. Open the site in Safari.
2. **Share → Add to Home Screen → Add**, then open it from the home screen.

**Expected:** as TC-A3.
☐ Pass ☐ Fail

### TC-A5 Install checks in Chrome (computer)
1. Open the site, press **F12** → **Application**.
2. Open **Manifest**, then **Service workers**.

**Expected:** Manifest shows name "ProofPocket", display "standalone" and the icons, with no errors. Service workers shows `sw.js` as **activated and running**.
☐ Pass ☐ Fail

### TC-A6 Phone and desktop layouts
1. Sign in as a founder (e.g. `zanele@proofpocket.example`) on a phone, then on a computer.

**Expected:** on the phone there is a bottom tab bar (**Home, Books, Get paid, Markets, More**) and **More** lists the remaining sections. On the computer there is a left rail grouped **Start, Trade, Get paid, Manage cash flow, Reach formal markets, Stay safe, Account**. The background is white and buttons are easy to tap.
☐ Pass ☐ Fail

---

## B. Signing in

### TC-B1 Founder signs in
1. Sign in as `palesa@proofpocket.example` with its password.

**Expected:** you land on **Home** for **ReKasi Plastics · Alexandra, Gauteng** with a green **Verified** pill.
☐ Pass ☐ Fail

### TC-B2 Wrong password
1. Enter `palesa@proofpocket.example` and a wrong password.

**Expected:** "That email and password don't match. Check them and try again." You stay on Sign in.
☐ Pass ☐ Fail

### TC-B3 Unknown email gives the same message
1. Enter `nobody@proofpocket.example` and any password.

**Expected:** exactly the same message as TC-B2, so the page doesn't reveal whether the email exists.
☐ Pass ☐ Fail

### TC-B4 Too many wrong passwords
1. Enter a wrong password for one account (e.g. `kabelo@proofpocket.example`) six times in a row.

**Expected:**
- *Local:* after five wrong tries, "Too many wrong passwords. For your safety this account is locked for 15 minutes." Even the right password is refused until then.
- *Hosted:* after several tries, "Too many tries. For your safety, wait a few minutes and try again." (Firebase's protection).

☐ Pass ☐ Fail

### TC-B5 Show and hide password
1. Type a password and press **Show**, then **Hide**.

**Expected:** the password becomes readable, then hidden again.
☐ Pass ☐ Fail

### TC-B6 Sign out
1. Signed in, press **Sign out**.
2. Press the browser's Back button.

**Expected:** you're on Sign in. Going back doesn't show the previous person's screens.
☐ Pass ☐ Fail

### TC-B7 Signed-out visitors can't open portals
1. Signed out, open `/app/home`, then `/funder`, then `/admin`.

**Expected:** each sends you to **Sign in**.
☐ Pass ☐ Fail

---

## C. Two-step sign-in with Google Authenticator

> Staff accounts set it up once. After that, the account is tied to your phone's Google Authenticator. Use the accounts you're happy to keep that way.

### TC-C1 Funder must set it up at first sign-in
1. Sign in as `umnotho@proofpocket.example`.

**Expected:** before any portal opens, **Set up two-step sign-in** shows a QR code and a setup key. Opening `/funder/pipeline` brings you back to this page.
☐ Pass ☐ Fail

### TC-C2 Wrong first code
1. On the set-up page, enter `000000` and press **Turn on two-step sign-in**.

**Expected:** "That code isn't right. Open Google Authenticator and enter the code shown for ProofPocket now."
☐ Pass ☐ Fail

### TC-C3 Set it up
1. In Google Authenticator: **+ → Scan a QR code** and scan the code.
2. Enter the 6-digit code shown for **ProofPocket**.

**Expected:** you enter the funder portal. The account name in the app reads `ProofPocket: umnotho@proofpocket.example`.
☐ Pass ☐ Fail

### TC-C4 Code asked on every sign-in, and used only once
1. Sign out and sign in again as the same funder.
2. Enter the current code → you get in. Sign out.
3. Sign in again straight away and enter the **same** code before it changes.

**Expected:** step 1 shows **Enter your code**. Step 3 shows "That code has already been used. Wait for the next one in Google Authenticator." The next code works.
☐ Pass ☐ Fail

### TC-C5 Lockout after five wrong codes
1. On **Enter your code**, enter a wrong code five times.

**Expected:** after the fifth, "Too many wrong codes. For your safety, wait 15 minutes and try again." The right code is also refused until then.
☐ Pass ☐ Fail

### TC-C6 Founders: optional, with a reminder
1. Sign in as `thandi@proofpocket.example` (no code is asked).
2. Look at the top of **Home**.

**Expected:** a yellow notice reads "Protect your account with Google Authenticator." with a **Set up** button.
☐ Pass ☐ Fail

### TC-C7 Founder turns it on, then off
1. Press **Set up** (or **More → Business settings**) → **Set up Google Authenticator**, then scan and enter the code.
2. Sign out and in: a code is now asked.
3. In **Business settings**, press **Turn off two-step sign-in**, enter a fresh code, then **Turn off**.

**Expected:** the pill shows **On · Google Authenticator** after step 1 and **Off** after step 3. The Home reminder disappears while it's on. Turning it off without a valid code is refused.
☐ Pass ☐ Fail

### TC-C8 Staff can't turn it off
1. Signed in as a funder, adviser or admin, look for a way to turn two-step sign-in off.

**Expected:** there isn't one ("Always on for funder, adviser and admin accounts").
☐ Pass ☐ Fail

---

## D. Who sees what

### TC-D1 A founder sees only their own portal
1. Sign in as `palesa@proofpocket.example`.
2. Open `/funder/pipeline`, `/adviser/checks` and `/admin/checks` in the address bar.

**Expected:** each sends you back to `/app/home`.
☐ Pass ☐ Fail

### TC-D2 Stock only for businesses that hold stock
1. Sign in as `tumelo@proofpocket.example` (Mabele AgriLink, a services business).

**Expected:** there is no **Stock** in the rail or under More. Opening `/app/stock` says "Stock tracking is off for Services & tech businesses."
☐ Pass ☐ Fail

### TC-D3 Advisers see only their own incubator's companies
1. Sign in as `n.mokoena@proofpocket.example` (Ikhaya), set up the authenticator, and open **Document checks**.
2. Sign in as `s.pillay@proofpocket.example` (Township Futures) and open **Document checks**.

**Expected:** Mokoena sees **Khanya Solar Installs · Business plan** but not ReKasi. Pillay sees **ReKasi Plastics · Central Supplier Database registration** but not Khanya.
☐ Pass ☐ Fail

### TC-D4 Admin sees only companies without an incubator
1. Sign in as the admin (`pegphina@gmail.com`) → **Checker queue**.

**Expected:** no example companies are listed (all of them have an incubator), until someone joins without one (TC-E6).
☐ Pass ☐ Fail

---

## E. Join

Use a new email you control for each run, e.g. `yourname+join1@gmail.com`.

### TC-E1 Account rules
1. Open **Join ProofPocket** from Sign in.
2. Try the password `password123`, then a password containing your email name, then two passwords that don't match.

**Expected:** in turn: "That password is too common…" (or "Use at least 10 characters…"), "Don't use your email name in your password.", "The two passwords don't match."
☐ Pass ☐ Fail

### TC-E2 Required details
1. Leave **Your name**, **Business name** and **Town** empty, then press **Continue**.

**Expected:** a message under each empty field. You stay on step 1.
☐ Pass ☐ Fail

### TC-E3 CIPC number format
1. Choose **Yes** for "registered with CIPC" and enter `2025-12345`, then press **Continue**.

**Expected:** "The CIPC number should look like 2024/123456/07." With `2025/123456/07` it continues.
☐ Pass ☐ Fail

### TC-E4 Sector follows the type of business
1. Change **Type of business** between Beauty, Food and Services.

**Expected:** the **Sector** list changes to match (e.g. Food → Catering…).
☐ Pass ☐ Fail

### TC-E5 Documents step
1. Continue to Documents.
2. Registered: four uploads (CIPC, ID, bank, address). Not registered: two (ID, address).
3. Upload `docs/testing/files/not-really-a.pdf` to one row.
4. Upload `docs/testing/files/sample-document.pdf` (or a phone photo) to each row.
5. Press **Continue** with one row empty, then with all filled.

**Expected:**
- Step 3: "That file isn't a PDF or photo we can open…". The type is checked from the file's contents, not its name.
- Step 4: each row shows the file name and **Fingerprint** followed by 16 letters and digits.
- Step 5: "Attach: …" names the missing document; with all filled, you move to **Join**.

☐ Pass ☐ Fail

### TC-E6 Consent and joining
1. On **Check and join**, press **Join ProofPocket** without ticking the box.
2. Tick the box and press it again.

**Expected:** step 1 shows "Tick the box to confirm before joining." Step 2 opens **Registration steps** with the toast "Welcome! A ProofPocket checker is reviewing your documents." (or "Welcome! {incubator} will check your documents." if you chose one). The joining documents show **Being checked**.
☐ Pass ☐ Fail

### TC-E7 Starter path
1. Join again with a new email, choosing **Not yet** for CIPC.

**Expected:** only ID and proof of address are asked for. After joining, Home shows "You're on a Starter account." and the page head shows **Starter**.
☐ Pass ☐ Fail

### TC-E8 Coming back before finishing
1. Start Join, finish step 1, then close the tab. Sign in again with that email.

**Expected:** you're taken back to Join at the **Documents** step, not into the app.
☐ Pass ☐ Fail

---

## F. Document checks and Verified

### TC-F1 Admin approves; the fourth approval verifies
*Needs a registered company from TC-E6 that joined without an incubator.*
1. Sign in as the admin → **Checker queue**. Your new company has four rows.
2. Press **Open file** on one row, then **Approve** each row.

**Expected:** the file downloads or opens. The first three approvals show "Approved". The fourth shows "**{company} is now Verified**". The founder's **Registration steps** then shows "**Verified.** Funders, buyers and the public directory can now see your business", the page head pill turns green, and Home → Messages shows "You're verified. Funders, buyers and customers can now find you."
☐ Pass ☐ Fail

### TC-F2 Send back needs a reason
1. In a queue, press **Send back** with the reason box empty.

**Expected:** "Add a reason so the founder knows what to fix". Nothing is sent.
☐ Pass ☐ Fail

### TC-F3 Send back reaches the founder
1. Type a reason (e.g. "Letter older than 3 months") and press **Send back**.
2. Sign in as that founder → **Registration steps**.

**Expected:** that step shows **Missing**, "Sent back: Letter older than 3 months" and an **Upload** button. Home → Messages shows "Please upload your … again: Letter older than 3 months". The upload works and the step returns to **Being checked**.
☐ Pass ☐ Fail

### TC-F4 Adviser approves with an expiry date
1. As `s.pillay@proofpocket.example` → **Document checks** → ReKasi's **Central Supplier Database registration**.
2. Set **Valid until** to a date next year and press **Approve**.

**Expected:** "Approved", and the row disappears. As `palesa@…`, **Registration steps** shows that step **Verified** with "Valid until {date}".
☐ Pass ☐ Fail

### TC-F5 A checked document can't be replaced
1. As a founder, look at a step that is **Verified** or **Being checked**.

**Expected:** there is no Upload or Replace button (it appears only for Missing or Expired).
☐ Pass ☐ Fail

### TC-F6 CIPC number from Registration steps
1. As a Starter founder (TC-E7) → **Registration steps**, enter `2026/123` and **Save number**, then `2026/123456/07`.

**Expected:** first "CIPC numbers look like 2026/123456/07", then "CIPC number saved. Upload the certificate next." and the box disappears.
☐ Pass ☐ Fail

---

## G. Home

### TC-G1 Starter Home (Nala)
1. Sign in as `zanele@proofpocket.example`.

**Expected:**
- Notices: "You're on a Starter account.", "1 client says they have paid." and "2 possible scams need your attention."
- Five journey steps: Start "2 of 4 joining steps done", Trade, **Get paid ✓**, Manage cash flow "R1 160 on hand", Reach formal markets "4 of 6 months of track record".
- Tiles: Money in R1 650, Money out R1 890, Cash on hand R1 160, Funding readiness 5 / 100 **Early**.
- *Things to watch* lists Starter, personal spending, 1 proof of payment, 2 stock items low, and "2 fraud warnings open" (**Act now**).
- *Messages* shows "Funding Approvals Desk · **Not verified**".

☐ Pass ☐ Fail

### TC-G2 Verified Home (ReKasi)
1. Sign in as `palesa@proofpocket.example`.

**Expected:** no Starter notice. Readiness **80 Funding ready** (green). Cash on hand R8 450. Things to watch includes "Funding offer changed with no reason given".
☐ Pass ☐ Fail

### TC-G3 Journey and Next steps links
1. On Nala's Home, click each journey step, and **Fix** on a Next step.

**Expected:** each opens the matching screen (Start → Registration steps, Trade → Bookkeeping, Manage cash flow → Cash flow…). Document fixes open Registration steps; bookkeeping fixes open Bookkeeping.
☐ Pass ☐ Fail

---

## H. Bookkeeping (Books)

Use `sipho@proofpocket.example` (Khanya) unless stated.

### TC-H1 Add money in
1. **Money in**, amount `450`, Paid by **Cash**, category **Sales**, note "Geyser part", then **Save entry**.

**Expected:** "Saved to your books". The row appears at the top of **This month** with **+R450**, and the Money in tile goes up by R450.
☐ Pass ☐ Fail

### TC-H2 Amount must be above zero
1. **Save entry** with the amount empty or `0`.

**Expected:** "Enter an amount greater than zero."
☐ Pass ☐ Fail

### TC-H3 Duplicate payment warning
1. **Money out**, `1234`, note "Panel deposit", then **Save entry**.
2. Enter **Money out** `1234` again with note "Panel deposit again", then **Save entry**.
3. Press **Save again**.

**Expected:** step 2 shows "Possible duplicate: you paid R1 234 for "Panel deposit" on {date}. Paying the same invoice twice is a common fraud. Press Save again if this is a new payment." Step 3 saves it.
☐ Pass ☐ Fail

### TC-H4 Personal purchase lowers readiness until paid back
1. Note the readiness score on Home.
2. **Money out**, `80`, category **Other expense**, tick "This was a personal purchase", then **Save entry**.
3. Check Home, then go back to Books → **Paid back** on that row.

**Expected:** after step 2 the row has a **Personal** pill and readiness drops by **10**. After **Paid back**: "Marked as paid back", the note ends in "(paid back)", and the score returns.
☐ Pass ☐ Fail

### TC-H5 Correct an entry (never deleted)
1. On the R450 row from TC-H1, press **Correct** and give the reason "Typed wrong amount".

**Expected:** the row is struck through with "Removed: Typed wrong amount" and Money in drops by R450. The row stays in the list.
☐ Pass ☐ Fail

### TC-H6 Stock linked to a sale
1. **Money in**, `2000`, **Stock used** "Mounting kits", **Quantity** `1`, then **Save entry**.
2. Open **Stock**.

**Expected:** Mounting kits went down by 1.
☐ Pass ☐ Fail

### TC-H7 Import a bank statement
1. **Money in** `4321`, category **Services**, note "Co-op fees", date **yesterday**, then **Save entry**.
2. Open `docs/testing/files/statement-with-headings.csv` in a text editor and replace every `YYYY/MM/DD` with **yesterday's** date (e.g. `2026/10/23`). Save it.
3. **Import a statement (CSV)** and choose the file.

**Expected:** a toast says "3 new lines to sort, 1 already in your books". **CO-OP FEES EFT** says "Already in your books: "Co-op fees"… Adding it again would count it twice" and offers **Add anyway**. The closing-balance line is ignored.
☐ Pass ☐ Fail

### TC-H8 Sort statement lines
1. On **AIRTIME VODACOM**, choose category **Airtime and data** → **Add**.
2. On **PAYSHAP CR KHUMALO T** → **Add**.
3. On **CO-OP FEES EFT** → **Skip**.

**Expected:** "Added to your books" twice and "Left out of your books". The added lines appear in This month (the PayShap one as **PayShap**) and leave the statement list.
☐ Pass ☐ Fail

### TC-H9 The same statement twice, and files without headings
1. Import the same CSV again.
2. Edit `statement-no-headings.csv` the same way and import it. When asked "Which columns are which?", choose Date = Column 1, Description = Column 2, Amount = Column 3, then **Import with these columns**.

**Expected:** step 1: "0 new lines to sort, 3 imported before". Step 2 shows a preview, then imports 2 lines.
☐ Pass ☐ Fail

### TC-H10 Other months and earlier months
1. Press **‹** to see last month.
2. Open **Earlier months, before you used ProofPocket**, enter a month a year ago with Money in `30000` and Money out `25000`, then **Save month**.

**Expected:** step 1 shows the heading "{Month} {year}" and its entries (or "No entries in this month"). Step 2 shows "{month} saved" and the month appears in the list.
☐ Pass ☐ Fail

---

## I. Offline

Use a phone with the app installed (or Chrome DevTools → Network → **Offline**).

### TC-I1 The app opens offline
1. Open the app signed in and wait for Home. Close it.
2. Turn on flight mode and open the app again.

**Expected:** Home opens with your last figures, and an **Offline** badge shows in the top bar.
☐ Pass ☐ Fail

### TC-I2 Entries saved offline sync once
1. Still offline, go to Books and add **Money in** `333`, note "Offline test", then **Save entry**.
2. Turn flight mode off and wait a few seconds (or reopen the app).
3. Reload Books.

**Expected:** step 1: "Saved on this phone, will sync", and the row shows **Waiting to sync**. After step 2 the label goes away. After step 3 the entry appears **exactly once**.
☐ Pass ☐ Fail

### TC-I3 Stock changes offline
1. Offline, on **Stock**, press **Use 1** on an item.
2. Go back online.

**Expected:** "Saved on this phone, will sync", and the quantity drops at once with **Waiting to sync**. Online it syncs; the quantity drops once, not twice.
☐ Pass ☐ Fail

---

## J. Stock

Use `zanele@proofpocket.example` (Nala).

### TC-J1 Stock summary
**Expected:** 4 items, with **Gel polish** (3, reorder at 4) and **Lash glue** (1, reorder at 2) showing **Reorder**. The "Running low" tile shows 2 in red.
☐ Pass ☐ Fail

### TC-J2 Use 1
1. **Use 1** on Nail tips.

**Expected:** "Nail tips: 4 boxes left".
☐ Pass ☐ Fail

### TC-J3 Restock records an expense
1. **Restock** on Gel polish.

**Expected:** "Restocked Gel polish; R425 added to your books". The quantity becomes 8 (twice the reorder level). In Books, a money-out row reads "Restock Gel polish (5 bottles)", category Stock and materials.
☐ Pass ☐ Fail

### TC-J4 Add an item
1. Press **Add item** with no name, then with item "Cuticle oil", unit "bottles", in stock 2, reorder at 3, cost 40.

**Expected:** first "Name the item", then "Item added" with the new row showing **Reorder**.
☐ Pass ☐ Fail

### TC-J5 Remove an item
1. Press **×** on Cuticle oil and confirm.

**Expected:** it leaves the list.
☐ Pass ☐ Fail

---

## K. Cash flow and Business settings

### TC-K1 Cash flow (Nala)
1. Open **Cash flow**.

**Expected:** Cash on hand now R1 160. Usual month and "Cash lasts … months" are filled in. Paying yourself shows personal purchases **R640** in red. Coming up lists "Lerato owes you +R350" and restock costs for Gel polish and Lash glue.
☐ Pass ☐ Fail

### TC-K2 Opening balance changes cash on hand
1. **More → Business settings**. Add R1 000 to **Opening balance** and **Save**.
2. Open **Cash flow**.

**Expected:** "Settings saved". Cash on hand is R1 000 higher.
☐ Pass ☐ Fail

### TC-K3 Settings validation
1. Set **On this date** to a future date and **Save**.

**Expected:** "The opening balance date can't be in the future."
☐ Pass ☐ Fail

---

## L. Not built yet

### TC-L1 Placeholders for phases 4–5
1. Open **Payments, Profile & marketing, Funding readiness, Procurement, Fraud protection, Privacy & sharing**, the funder **Pipeline**, the adviser **Cohort board** and **Support log**, the admin **Reports**, `/directory` and `/pay/PP-4821`.

**Expected:** each shows a "**Being built.** … arrives in phase 4" (or 5) notice. Nothing crashes. *These aren't failures; they show what's left to build.*
☐ Pass ☐ Fail

---

## Automated tests (for developers)

The same areas are covered automatically. Run these in `system/`:

```bash
pnpm test        # 108 unit and API tests (rules, sign-in, RLS, join, documents, books, statements)
pnpm test:e2e    # 24 browser tests, phone + desktop (join → Verified, offline sync once, duplicates…)
cd apps/web && pnpm exec playwright test -c playwright.live.config.ts   # against the hosted site
```
