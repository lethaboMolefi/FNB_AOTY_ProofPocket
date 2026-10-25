# ProofPocket manual test cases

Hand tests for the whole system (all five feature phases, sign-in with Google Authenticator, and the PWA). Each test gives the steps, what should happen, and a box to tick.

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
| L. Payments and the payment page | TC-L1 – L9 |
| M. Fraud protection | TC-M1 – M5 |
| N. Privacy and incubators | TC-N1 – N4 |
| O. Profile, posts and the directory | TC-O1 – O6 |
| P. Funding readiness | TC-P1 – P4 |
| Q. Procurement | TC-Q1 – Q2 |
| R. Funder portal | TC-R1 – R8 |
| S. Incubator portal | TC-S1 – S6 |
| T. Admin portal | TC-T1 – T7 |
| U. Security checks | TC-U1 – U8 |

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

## L. Payments and the payment page

Use `zanele@proofpocket.example` (Nala) unless stated. Open client links in a **private window** (no account).

### TC-L1 Naledi's proof to check
1. Open **Payments**.

**Expected:** "Proof of payment to check" shows "Naledi says they paid R250", five ✓ checks ("Amount matches (R250)", "Client says they used reference PP-4790", "Paid after the request was sent", "Proof file not used before", "Paid by PayShap"), the banking-app warning, and **The money is in my account** / **Not received**.
☐ Pass ☐ Fail

### TC-L2 Confirm in your own bank
1. Press **The money is in my account**.

**Expected:** "Confirmed and added to your books with the proof attached". PP-4790 shows **Paid · in books**, and Books has a +R250 entry for "PP-4790 · proof of payment attached" with receipt **Kept**.
☐ Pass ☐ Fail

### TC-L3 Ask a client to pay
1. Client `Thabo`, amount `300`, for `Lash fill`; keep PayShap, Bank EFT, Cash; press **Create payment request**.
2. Press **Copy link**, **Show QR**, and **Send on WhatsApp**.

**Expected:** "Request PP-NNNN created…". The link looks like `…/pay/PP-1234-<long code>`. A QR code appears. WhatsApp opens with a message containing the amount, reference and link. Empty client or no ways to pay gives "Add the client's name and an amount" / "Choose at least one way to pay".
☐ Pass ☐ Fail

### TC-L4 The client's payment page
1. Open the link from TC-L3 in a private window.

**Expected:** "You're paying Nala Nails & Lashes", **Starter** badge, **R300**, reference, How to pay with PayShap (ShapID `071 555 0142`), Bank EFT (Capitec, account number), Cash, each with **Copy** buttons, and "**Only pay to the details on this page.**". No card machine (not allowed). No sign-in asked.
☐ Pass ☐ Fail

### TC-L5 A wrong link shows nothing
1. Change the last few characters of the link and open it.

**Expected:** "This payment link isn't valid." Nothing about Nala is shown.
☐ Pass ☐ Fail

### TC-L6 Client sends a wrong proof; founder says not received twice
1. On the client page: amount `250`, untick "I used reference", attach a screenshot, **Send proof of payment** → "Proof of payment sent."
2. As Nala, Payments shows "2 things to check" (amount and reference ✗). Press **Not received**.
3. Client page (reload) shows "hasn't received this payment yet". Send the **same** screenshot again.
4. Founder now also sees "This exact file was used as proof before". Press **Not received**.

**Expected:** after step 4: "Marked not received. Flagged as a possible fake proof of payment." The client page says "This request is closed." Fraud protection has a message from "Thabo (client)" with the flags "Possible fake proof of payment" and "Don't hand over goods until the money shows in your bank".
☐ Pass ☐ Fail

### TC-L7 Paid me cash, and cancel
1. Create a request with Cash allowed and press **Paid me cash**.
2. Create another and press **Cancel**, then open its link.

**Expected:** "Payment added to your books" (a cash entry appears in Books). The cancelled link shows "cancelled this request. Don't pay it."
☐ Pass ☐ Fail

### TC-L8 Payment details need Google Authenticator
1. As a founder **without** Google Authenticator, look at "Your payment details".
2. Set it up (Business settings), come back, press **Change**, fill new details and a wrong code, then the right code.

**Expected:** step 1: a notice to set up Google Authenticator; no Change button. Wrong code: "That code isn't right…". Right code: "Payment details saved"; only the last four digits show (••1234); the founder gets an email, and the incubator's advisers are emailed. The client page for a new request shows the new number. Nala's "personal account" warning shows while her account name says personal.
☐ Pass ☐ Fail

### TC-L9 Suppliers and cash payouts
1. **Record a supplier payment** to "Glam Supplies · ON HOLD".
2. **Add a supplier** (name, bank, account number) → it appears with only the last 4 digits.
3. **Record a cash payment out**: paid to `Thabo (collector)`, `85`, "Payee has no phone" ticked.

**Expected:** step 1: "Payment blocked: Glam Supplies's bank details changed. Confirm by phone under Fraud protection first." Step 2: "Supplier saved". Step 3: "Cash payment recorded…", and Books shows the entry with "slip S#####". Works offline too ("Saved on this phone, will sync").
☐ Pass ☐ Fail

---

## M. Fraud protection

### TC-M1 Messages about money
1. As Nala → **Fraud protection**.

**Expected:** "Funding Approvals Desk · **Not verified**" with three red flags, and **Report and block** / **It's genuine**. "Ikhaya Incubation Hub · Verified on ProofPocket" has no buttons.
☐ Pass ☐ Fail

### TC-M2 Report and block warns other founders
1. Press **Report and block** on the scam.
2. Sign in as another founder (e.g. `thandi@…`) → Fraud protection → **Check a message**: from `approvals.fund@quickgrantz-mail.com`, text "You qualify for a grant. Pay the admin fee today."

**Expected:** step 1: "Reported. Other founders will be warned about this sender." Step 2 lists warning signs including "**Other founders reported this sender**".
☐ Pass ☐ Fail

### TC-M3 Check a harmless message
1. Check from `0715550000`: "Can I book a catering tasting for Saturday?"

**Expected:** "No warning signs found…"
☐ Pass ☐ Fail

### TC-M4 Supplier bank detail changes
1. Glam Supplies shows "New details received… Payments are on hold until you confirm by phone". Press **Reject change**.
2. On another supplier press **Supplier sent new details**, enter a bank and number.

**Expected:** "Change rejected. Old details kept." / "Change received. Payments to this supplier are on hold." and the hold message shows. **I've confirmed by phone** replaces the bank details.
☐ Pass ☐ Fail

### TC-M5 Fingerprints and rules
**Expected:** "Document fingerprints" lists each uploaded document with a 16-character fingerprint; "Rules that keep you safe" shows four rules.
☐ Pass ☐ Fail

---

## N. Privacy and incubators

### TC-N1 Funder sharing
1. As `palesa@…` → **Privacy & sharing** → choose **Nothing**.
2. As funder `kopano@…` (authenticator) → Company pipeline.
3. Back as Palesa, choose **Full books**.

**Expected:** "Sharing updated". ReKasi disappears from Kopano's pipeline while set to Nothing, and returns after.
☐ Pass ☐ Fail

### TC-N2 Summary hides book entries
1. Set sharing to **Summary**; as a funder open the company.

**Expected:** "This founder shares a summary only. Individual book entries are private." Readiness and totals still show.
☐ Pass ☐ Fail

### TC-N3 Leave an incubator
1. As a founder with an incubator, press **Leave {incubator}** and confirm.

**Expected:** "You've left the incubator…", and the adviser no longer sees the company on their cohort board.
☐ Pass ☐ Fail

### TC-N4 Ask to join an incubator
1. Choose an incubator and **Send request**.
2. As that incubator's adviser → Cohort board → "Asking to join" → **Accept**.

**Expected:** the founder sees "You asked to join…"; after acceptance the company is on the board (Assessment) and the founder's Privacy page names the incubator.
☐ Pass ☐ Fail

---

## O. Profile, posts and the directory

### TC-O1 Public profile
1. As `tumelo@…` → **Profile & marketing**, change the one-line description and **Save profile**.
2. Press **Open your page**.

**Expected:** "Profile saved". The public page shows the new line, services, WhatsApp button, "What ProofPocket checked" and **Report this business**.
☐ Pass ☐ Fail

### TC-O2 QR code
**Expected:** a QR code that opens the business's public page when scanned with a phone camera; **Copy profile link** says "Profile link copied".
☐ Pass ☐ Fail

### TC-O3 Posts and share links
1. Write a post and **Save post**, then press **WhatsApp**, **Facebook**, **X**.

**Expected:** "Saved. Use the buttons to share it…". Each opens that app/site with the text and profile link (nothing is posted automatically). The post shows "shared to WhatsApp, Facebook, X".
☐ Pass ☐ Fail

### TC-O4 Feature requests
1. As Nala (Starter): there's no "Save and request a feature" button.
2. As Tumelo: **Save and request a feature**.
3. As admin → **Feature requests** → **Feature**.

**Expected:** step 2: "Feature requested" pill. Step 3: "Featured for 7 days", and the post shows under **Featured this week** on `/directory`.
☐ Pass ☐ Fail

### TC-O5 Directory and Starters
1. Open `/directory` signed out; search "catering".
2. Open `/b/nala-nails-lashes`.

**Expected:** only Verified businesses are listed (no Nala). Mama Tau opens with **Verified on ProofPocket**. Nala's page exists but shows **Starter: not verified yet**.
☐ Pass ☐ Fail

### TC-O6 Buyers and introductions
1. As Tumelo, on "Buyers looking for suppliers", press **Request introduction** on Farmer Co-op Network.
2. As Nala, look at the same list.

**Expected:** "Your adviser will arrange the introduction" and **Requested**. Nala sees **Verified only** instead of buttons.
☐ Pass ☐ Fail

---

## P. Funding readiness

### TC-P1 Score and breakdown
1. As Tumelo → **Funding readiness**.

**Expected:** score ring **100**, "Funding ready", Documents and Bookkeeping checklists with points.
☐ Pass ☐ Fail

### TC-P2 Programmes and gaps
**Expected:** each programme shows amount range, funds left, and either "Nothing, you qualify" or chips such as "× 12 months of records (you have 6)". As Nala, every programme starts with "× Verified account".
☐ Pass ☐ Fail

### TC-P3 Apply
1. On a programme you qualify for, enter an amount above the maximum and **Apply**, then a valid amount.

**Expected:** "Enter an amount between R… and R…", then "Application sent to {funder}". The row shows **Applied**, and the application appears under "Your applications" with offer history "Requested amount".
☐ Pass ☐ Fail

### TC-P4 Ask why, and withdraw
1. As `palesa@…`: the Youth Micro Grant application shows R28 000 with "**No reason given**" in red. Press **Ask the funder for a reason**.
2. On a pending application press **Withdraw** and confirm.

**Expected:** "Request sent to the funder" and the button changes to **Reason requested**. "Application withdrawn".
☐ Pass ☐ Fail

---

## Q. Procurement

### TC-Q1 Tenders and requirements
1. As Tumelo → **Procurement**.

**Expected:** track record, account and tender-document tiles; a table of open tenders with ✓/× chips for documents and months; actions such as **Express interest**, "Add N documents" or "N more months". Closed tenders aren't listed. As Nala every tender says **Verify first**.
☐ Pass ☐ Fail

### TC-Q2 Express interest
1. Press **Express interest** on an eligible tender.

**Expected:** "Interest sent with your checked documents and track record" and **Interest sent**. The adviser sees it in **Support log** with **Mark arranged**.
☐ Pass ☐ Fail

---

## R. Funder portal

Sign in as `lesedi@…` (Google Authenticator).

### TC-R1 Pipeline
**Expected:** tiles (Verified and sharing, "N Starter or private", meet requirements, funding ready, applications), filters (search, sector, area, minimum readiness slider) and a table sorted by readiness with sparklines. **No Starter companies** (no Nala).
☐ Pass ☐ Fail

### TC-R2 Company drawer
1. Click ReKasi Plastics.

**Expected:** a drawer (full screen on phones) with readiness, key figures, flags, chart, latest entries, documents (status only), bookkeeping health, the application with offer history (R50 000 → R40 000 → R28 000 "No reason given"), incubator support and activity. **Esc** or **Close** closes it.
☐ Pass ☐ Fail

### TC-R3 Offer changes need a reason
1. Change the offer without a reason, then with "Branch cap raised".

**Expected:** "Add a reason. Founders see every change to their offer." then "Offer updated and shared with the founder". The founder's Funding page shows the new offer with the reason.
☐ Pass ☐ Fail

### TC-R4 Decline needs a reason; approve commits budget
1. On an open application press **Decline** with no reason.
2. On another, press **Approve current offer**. Check **Programmes & requirements**.

**Expected:** "Add a reason before declining. The founder will see it." Approval shows "Application approved", and the programme's Committed rises by the offer. If it would exceed the budget, you're asked to confirm.
☐ Pass ☐ Fail

### TC-R5 Invite to apply
1. In a drawer, choose a programme under **Invite to apply** and **Send invite**.

**Expected:** "Invite sent". The founder's Home → Messages shows "You're invited to apply to …" from a **Verified** funder.
☐ Pass ☐ Fail

### TC-R6 Programmes and requirements
1. Click a document chip, then **Close to applications**, then **Reopen**.

**Expected:** "Requirements updated; founders see the change"; the founder's gaps change. Closed programmes disappear from founders' Funding page.
☐ Pass ☐ Fail

### TC-R7 New funder set-up gate
1. Sign in as `bophelo@…`.

**Expected:** after Google Authenticator, only **Set your requirements** opens (other pages redirect). Saving opens the pipeline with "Requirements saved. Founders can see them now."
☐ Pass ☐ Fail

### TC-R8 Applications list
**Expected:** every application to you, with requested, current offer ("No reason given" / "Founder asked why" notes), status and readiness; **Open** opens the drawer.
☐ Pass ☐ Fail

---

## S. Incubator portal

Sign in as `n.mokoena@…` (Ikhaya).

### TC-S1 Cohort board
**Expected:** tiles and five columns (Assessment … Monitoring & evaluation) with cards for Nala, Khanya and Mabele only (no ReKasi). Cards show score, adviser and up to 2 flags.
☐ Pass ☐ Fail

### TC-S2 Drawer: full books, adviser and stage
1. Open Khanya; choose an adviser; press **Move to …**, then **Back a stage**.

**Expected:** latest entries are visible (advisers always see books). "Adviser assigned", "Moved to …". The card moves column.
☐ Pass ☐ Fail

### TC-S3 Needs attention
**Expected:** every flag across the cohort, **Act now** items first, each with **Open**.
☐ Pass ☐ Fail

### TC-S4 Support log
1. Log support for Nala ("Bookkeeping coaching", note), with an empty note first.

**Expected:** "Add a note about the support", then "Support logged"; it heads History and appears in the company's drawer and timeline.
☐ Pass ☐ Fail

### TC-S5 Introductions and tender interest
**Expected:** requests from TC-O6/TC-Q2 appear with **Mark arranged** / **Decline**; the founder's page then shows "Being arranged" / "Passed to buyer".
☐ Pass ☐ Fail

### TC-S6 Navigation counts
**Expected:** red numbers on **Document checks** and **Needs attention** (and on a founder's Registration steps, Stock, Payments, Fraud protection) match what's waiting.
☐ Pass ☐ Fail

---

## T. Admin portal

Sign in as the admin (`pegphina@gmail.com`).

### TC-T1 Add and verify an organisation
1. **Organisations** → add a Funder "Test Fund". Press **Verify**.

**Expected:** "Test Fund added" (Not verified), then "…is verified and shows the badge".
☐ Pass ☐ Fail

### TC-T2 Invite a person
1. Under Test Fund, invite a name and an email you can read.

**Expected:** "Invitation sent to …". The email has a link to set a password (hosted) or a temporary password (local). Signing in asks for Google Authenticator, then **Set your requirements**.
☐ Pass ☐ Fail

### TC-T3 Reset a lost authenticator
1. **Reset authenticator** next to a person, confirm.

**Expected:** "Authenticator reset for …"; they get an email, and their next sign-in starts set-up again.
☐ Pass ☐ Fail

### TC-T4 Reports
1. Report a business from `/b/<slug>` and a payment request from a payment page.
2. **Reports** → **Resolve** (with a note) / **Dismiss**.

**Expected:** both reports listed with company and reason; statuses change.
☐ Pass ☐ Fail

### TC-T5 Feature requests
**Expected:** as TC-O4; **Reject** asks for a reason the founder sees.
☐ Pass ☐ Fail

### TC-T6 Flagged payments and reported senders
**Expected:** TC-L6's request appears under "Possible fake proofs of payment"; TC-M2's sender under "Reported senders" with **Confirm scam** / **Clear**.
☐ Pass ☐ Fail

### TC-T7 Tenders
1. Publish a tender (title, buyer, value, future closing date, sectors, documents).

**Expected:** "Tender published"; founders in those sectors see it under Procurement.
☐ Pass ☐ Fail

---

## U. Security checks (seed data only)

### TC-U1 Cross-company access
1. Signed in as Nala, open DevTools → Network, copy a request such as `/api/v1/founder/books`, and repeat it with an entry or document id from another company.

**Expected:** 403 or 404; never another company's data.
☐ Pass ☐ Fail

### TC-U2 Unconsented funder access
**Expected:** as TC-N1/N2: a funder never sees a company with sharing Nothing (unless it applied to them), and never sees entries without Full books.
☐ Pass ☐ Fail

### TC-U3 Role tampering
1. As a founder, open `/funder/pipeline`, `/adviser/cohort`, `/admin/organisations`.
2. Call `/api/v1/admin/organisations` with the founder's token.

**Expected:** redirected home; the API returns 403.
☐ Pass ☐ Fail

### TC-U4 XSS payloads
1. Put `<img src=x onerror=alert(1)>` in a business name (Join), a book entry note, a post and a profile tagline.

**Expected:** the text shows literally; no alert ever appears (React escaping and a strict Content Security Policy).
☐ Pass ☐ Fail

### TC-U5 Malicious uploads
1. Upload `docs/testing/files/not-really-a.pdf`, an `.html` or `.svg` file renamed to `.pdf`, and a file over 5 MB.

**Expected:** each is refused ("That file isn't a PDF or photo we can open…" / "Files must be 5 MB or smaller").
☐ Pass ☐ Fail

### TC-U6 Link expiry
1. As an adviser, press **Open file** on a document, copy the download address, wait 6 minutes, open it again.

**Expected:** the second time it's refused (links last 5 minutes).
☐ Pass ☐ Fail

### TC-U7 Sign-in rate limits
**Expected:** as TC-B4 and TC-C5: wrong passwords and wrong codes lock the account temporarily.
☐ Pass ☐ Fail

### TC-U8 Audit log immutability
1. (Developers) `docker compose exec db psql -U proofpocket_app -d proofpocket -c "delete from audit_log"`.

**Expected:** `permission denied`. Offer history can't be edited either (`offer history is append-only`).
☐ Pass ☐ Fail

---

## Automated tests (for developers)

The same areas are covered automatically. Run these in `system/`:

```bash
pnpm test        # 149 unit and API tests (rules, sign-in, RLS, join, documents, books, payments, portals, jobs)
pnpm test:e2e    # 40 browser tests, phone + desktop (join → Verified, offline sync, payment flow, funder, incubator, admin…)
cd apps/web && pnpm exec playwright test -c playwright.live.config.ts   # against the hosted site
```
