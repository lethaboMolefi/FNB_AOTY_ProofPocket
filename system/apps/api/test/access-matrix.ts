// Every HTTP endpoint, the feature it belongs to, and which roles may use it (read from each route's guard).
// access-matrix.test.ts calls every endpoint as every role, and fails if the app serves an endpoint not listed here.
// docs/FEATURE-INVENTORY.md is generated from this file (scripts/inventory.ts).

export const ROLES = ["public", "joining", "founder", "funder", "adviser", "buyer", "admin"] as const;
export type MatrixRole = (typeof ROLES)[number];

const ALL: MatrixRole[] = [...ROLES];
const USERS: MatrixRole[] = ["founder", "funder", "adviser", "buyer", "admin"];
const SIGNED_IN: MatrixRole[] = ["joining", ...USERS];

export interface Endpoint {
  id: string; module: string; feature: string; method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string;
  /** Web page(s) that use it, or "—" for none. */
  ui: string;
  allow: MatrixRole[];
  /** Same answer for every role: access comes from a signed link, a payment-page token or a gateway signature, not a role. */
  token?: true;
  /** Request body used for the check (empty by default; validation then refuses it, which still proves the caller got past access control). */
  body?: object;
  note?: string;
  /** People who already have an account are refused with 409 already_joined (Join only). */
  accountsRefused?: true;
}

export const MATRIX: Endpoint[] = [
  // ------------------------------------------------------------------ system
  { id: "F-SYS-01", module: "System", feature: "Health check", method: "GET", path: "/health", ui: "—", allow: ALL },
  { id: "F-SYS-02", module: "System", feature: "API description (OpenAPI)", method: "GET", path: "/openapi.json", ui: "—", allow: ALL },

  // ------------------------------------------------------------------ sign-in and two-step
  { id: "F-AUTH-01", module: "Sign-in", feature: "Sign in with email and password (local)", method: "POST", path: "/auth/local/sign-in", ui: "/sign-in", allow: ALL },
  { id: "F-AUTH-02", module: "Sign-in", feature: "Create a sign-in (local, used by Join)", method: "POST", path: "/auth/local/sign-up", ui: "/join, /sign-up", allow: ALL },
  { id: "F-AUTH-10", module: "Sign-in", feature: "Email a code to confirm the sign-in's email", method: "POST", path: "/auth/email-code/send", ui: "/sign-up, /join", allow: SIGNED_IN, note: "Needs a sign-in, not an account; already-confirmed sign-ins get confirmed: true" },
  { id: "F-AUTH-11", module: "Sign-in", feature: "Check the email code (marks the email confirmed)", method: "POST", path: "/auth/email-code/verify", ui: "/sign-up, /join", allow: SIGNED_IN, body: { code: "000000" } },
  { id: "F-AUTH-12", module: "Sign-in", feature: "Set your own password (forced after a temporary one)", method: "POST", path: "/auth/password", ui: "/change-password, /admin/profile", allow: USERS, body: { current: "x", password: "y" }, note: "Needs a fresh sign-in (within 15 minutes)" },
  { id: "F-AUTH-13", module: "Sign-in", feature: "Choose the password later (email-only sign-up, new sign-ins only)", method: "POST", path: "/auth/password/later", ui: "/sign-up, /join", allow: ["joining"], note: "A brand-new sign-in with no account, within 15 minutes of being created; anything else gets 403 not_new" },
  { id: "F-AUTH-14", module: "Sign-in", feature: "Is a password still to be chosen?", method: "GET", path: "/auth/password/later", ui: "/set-password", allow: SIGNED_IN },
  { id: "F-AUTH-15", module: "Sign-in", feature: "Choose your password (once, after Join ProofPocket or the application)", method: "POST", path: "/auth/password/first", ui: "/set-password", allow: SIGNED_IN, body: { password: "x" }, note: "409 when the password is already set" },
  { id: "F-AUTH-03", module: "Sign-in", feature: "Who am I (account, role, company)", method: "GET", path: "/me", ui: "every signed-in page", allow: USERS },
  { id: "F-AUTH-04", module: "Sign-in", feature: "Start Google Authenticator set-up", method: "POST", path: "/auth/totp/setup", ui: "/verify, Business settings", allow: USERS, note: "Staff who already have it get 409; founders may start it any time" },
  { id: "F-AUTH-05", module: "Sign-in", feature: "Activate Google Authenticator", method: "POST", path: "/auth/totp/activate", ui: "/verify, Business settings", allow: USERS, body: { code: "000000" } },
  { id: "F-AUTH-06", module: "Sign-in", feature: "Enter the code at sign-in", method: "POST", path: "/auth/totp/verify", ui: "/verify", allow: USERS, body: { code: "000000" } },
  { id: "F-AUTH-07", module: "Sign-in", feature: "Turn Google Authenticator off (founders and buyers only)", method: "POST", path: "/auth/totp/disable", ui: "Business settings", allow: ["founder", "buyer"], body: { code: "000000" }, note: "Staff get 403: always on" },
  { id: "F-AUTH-08", module: "Admin", feature: "Reset a lost authenticator", method: "POST", path: "/admin/users/:id/reset-authenticator", ui: "/admin/organisations", allow: ["admin"] },
  { id: "F-AUTH-09", module: "Sign-in", feature: "Waiting counts on the menu", method: "GET", path: "/me/counts", ui: "every portal sidebar", allow: USERS },

  // ------------------------------------------------------------------ join and applications
  { id: "F-JOIN-01", module: "Join", feature: "Incubators a founder can choose", method: "GET", path: "/join/options", ui: "/join", allow: ALL },
  { id: "F-JOIN-02", module: "Join", feature: "Save founder and business details", method: "POST", path: "/join", ui: "/join", allow: ["joining", "founder"], accountsRefused: true, note: "A founder who already joined gets 409; other roles get 409 already_joined" },
  { id: "F-JOIN-03", module: "Join", feature: "Consent and send documents for checking", method: "POST", path: "/join/complete", ui: "/join", allow: ["founder"], body: { agree: true } },
  { id: "F-JOIN-04", module: "Applications", feature: "Apply for a funder or support-organisation portal", method: "POST", path: "/join/applications", ui: "/join", allow: ["joining"], accountsRefused: true, note: "Users with an account get 409 already_joined" },
  { id: "F-JOIN-05", module: "Applications", feature: "My application's status", method: "GET", path: "/join/application", ui: "/join", allow: SIGNED_IN, note: "Users with an account get { application: null }" },

  // ------------------------------------------------------------------ documents and files
  { id: "F-DOC-01", module: "Documents", feature: "Start an upload", method: "POST", path: "/founder/uploads", ui: "/join, /app/start, Bookkeeping", allow: ["founder"] },
  { id: "F-DOC-02", module: "Documents", feature: "Finish an upload (type and fingerprint checks)", method: "POST", path: "/founder/uploads/:id/complete", ui: "/join, /app/start", allow: ["founder"] },
  { id: "F-DOC-03", module: "Documents", feature: "Attach a document", method: "POST", path: "/founder/documents", ui: "/join, /app/start", allow: ["founder"] },
  { id: "F-DOC-04", module: "Documents", feature: "My documents and checker", method: "GET", path: "/founder/documents", ui: "/join, /app/start", allow: ["founder"] },
  { id: "F-DOC-05", module: "Documents", feature: "Add a CIPC number", method: "PUT", path: "/founder/cipc", ui: "/app/start", allow: ["founder"] },
  { id: "F-DOC-06", module: "Documents", feature: "Signed download link for a file", method: "GET", path: "/files/:id/download-url", ui: "checker queue, payments, drawer", allow: USERS, note: "Then row-level security: 404 unless the person may see the file" },
  { id: "F-DOC-07", module: "Documents", feature: "Upload bytes to a signed link (local storage)", method: "PUT", path: "/storage/:token", ui: "—", allow: ALL, token: true },
  { id: "F-DOC-08", module: "Documents", feature: "Download from a signed link (local storage)", method: "GET", path: "/storage/:token", ui: "—", allow: ALL, token: true },
  { id: "F-CHK-01", module: "Document checks", feature: "Adviser checking queue", method: "GET", path: "/adviser/checks", ui: "/adviser/checks", allow: ["adviser"] },
  { id: "F-CHK-02", module: "Document checks", feature: "Adviser approves a document", method: "POST", path: "/adviser/checks/:id/approve", ui: "/adviser/checks", allow: ["adviser"] },
  { id: "F-CHK-03", module: "Document checks", feature: "Adviser sends a document back", method: "POST", path: "/adviser/checks/:id/reject", ui: "/adviser/checks", allow: ["adviser"] },
  { id: "F-CHK-04", module: "Document checks", feature: "Admin checker queue", method: "GET", path: "/admin/checks", ui: "/admin/checks", allow: ["admin"] },
  { id: "F-CHK-05", module: "Document checks", feature: "Admin approves a document", method: "POST", path: "/admin/checks/:id/approve", ui: "/admin/checks", allow: ["admin"] },
  { id: "F-CHK-06", module: "Document checks", feature: "Admin sends a document back", method: "POST", path: "/admin/checks/:id/reject", ui: "/admin/checks", allow: ["admin"] },

  // ------------------------------------------------------------------ founder: home, books, stock, cash flow, settings
  { id: "F-HOME-01", module: "Founder Home", feature: "Home: journey, figures, notices, next steps", method: "GET", path: "/founder/home", ui: "/app/home, notification bell", allow: ["founder"] },
  { id: "F-BOOK-01", module: "Bookkeeping", feature: "Books: entries, totals, statement lines", method: "GET", path: "/founder/books", ui: "/app/books", allow: ["founder"] },
  { id: "F-BOOK-02", module: "Bookkeeping", feature: "Add an entry (offline-safe)", method: "POST", path: "/founder/entries", ui: "/app/books", allow: ["founder"] },
  { id: "F-BOOK-03", module: "Bookkeeping", feature: "Mark a personal purchase paid back", method: "POST", path: "/founder/entries/:id/paid-back", ui: "/app/books", allow: ["founder"] },
  { id: "F-BOOK-04", module: "Bookkeeping", feature: "Correct (void) an entry", method: "POST", path: "/founder/entries/:id/void", ui: "/app/books", allow: ["founder"] },
  { id: "F-BOOK-05", module: "Bookkeeping", feature: "Import a bank statement", method: "POST", path: "/founder/statements", ui: "/app/books", allow: ["founder"] },
  { id: "F-BOOK-06", module: "Bookkeeping", feature: "Sort a statement line", method: "POST", path: "/founder/statement-lines/:id", ui: "/app/books", allow: ["founder"] },
  { id: "F-BOOK-07", module: "Bookkeeping", feature: "Earlier months (before ProofPocket)", method: "PUT", path: "/founder/history", ui: "/app/books", allow: ["founder"] },
  { id: "F-STK-01", module: "Stock", feature: "Stock list", method: "GET", path: "/founder/stock", ui: "/app/stock", allow: ["founder"] },
  { id: "F-STK-02", module: "Stock", feature: "Add an item", method: "POST", path: "/founder/stock", ui: "/app/stock", allow: ["founder"] },
  { id: "F-STK-03", module: "Stock", feature: "Edit an item", method: "PATCH", path: "/founder/stock/:id", ui: "/app/stock", allow: ["founder"] },
  { id: "F-STK-04", module: "Stock", feature: "Remove an item", method: "DELETE", path: "/founder/stock/:id", ui: "/app/stock", allow: ["founder"] },
  { id: "F-STK-05", module: "Stock", feature: "Use one", method: "POST", path: "/founder/stock/:id/use", ui: "/app/stock", allow: ["founder"] },
  { id: "F-STK-06", module: "Stock", feature: "Restock (records the cost)", method: "POST", path: "/founder/stock/:id/restock", ui: "/app/stock", allow: ["founder"] },
  { id: "F-CF-01", module: "Cash flow", feature: "Cash flow: cash on hand, usual month, coming up", method: "GET", path: "/founder/cashflow", ui: "/app/cashflow", allow: ["founder"] },
  { id: "F-SET-01", module: "Business settings", feature: "Business settings", method: "GET", path: "/founder/settings", ui: "/app/settings", allow: ["founder"] },
  { id: "F-SET-02", module: "Business settings", feature: "Save business settings", method: "PUT", path: "/founder/settings", ui: "/app/settings", allow: ["founder"] },

  // ------------------------------------------------------------------ founder: payments
  { id: "F-PAY-01", module: "Payments", feature: "Payments: requests, details, suppliers", method: "GET", path: "/founder/payments", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-02", module: "Payments", feature: "Create a payment request", method: "POST", path: "/founder/payment-requests", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-03", module: "Payments", feature: "Cancel a request", method: "POST", path: "/founder/payment-requests/:id/cancel", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-04", module: "Payments", feature: "Paid me cash", method: "POST", path: "/founder/payment-requests/:id/cash", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-05", module: "Payments", feature: "The money is in my account (confirm proof)", method: "POST", path: "/founder/proofs/:id/confirm", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-06", module: "Payments", feature: "Not received (reject proof)", method: "POST", path: "/founder/proofs/:id/reject", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-07", module: "Payments", feature: "Change payment details (needs a code)", method: "PUT", path: "/founder/payment-details", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-08", module: "Payments", feature: "Add a supplier", method: "POST", path: "/founder/suppliers", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-09", module: "Payments", feature: "Supplier sent new bank details (hold)", method: "PUT", path: "/founder/suppliers/:id/bank", ui: "/app/protection", allow: ["founder"] },
  { id: "F-PAY-10", module: "Payments", feature: "Confirm a supplier's new details", method: "POST", path: "/founder/suppliers/:id/confirm", ui: "/app/protection", allow: ["founder"] },
  { id: "F-PAY-11", module: "Payments", feature: "Reject a supplier's new details", method: "POST", path: "/founder/suppliers/:id/reject", ui: "/app/protection", allow: ["founder"] },
  { id: "F-PAY-12", module: "Payments", feature: "Record a supplier payment", method: "POST", path: "/founder/supplier-payments", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PAY-13", module: "Payments", feature: "Record a cash payment out (offline-safe)", method: "POST", path: "/founder/cash-payouts", ui: "/app/payments", allow: ["founder"] },
  { id: "F-PP-01", module: "Payment page (public)", feature: "Client opens a payment link", method: "GET", path: "/pay/:ref", ui: "/pay/:ref", allow: ALL, token: true },
  { id: "F-PP-02", module: "Payment page (public)", feature: "Client starts a proof upload", method: "POST", path: "/pay/:ref/uploads", ui: "/pay/:ref", allow: ALL, token: true },
  { id: "F-PP-03", module: "Payment page (public)", feature: "Client finishes a proof upload", method: "POST", path: "/pay/:ref/uploads/:id/complete", ui: "/pay/:ref", allow: ALL, token: true },
  { id: "F-PP-04", module: "Payment page (public)", feature: "Client sends proof of payment", method: "POST", path: "/pay/:ref/proof", ui: "/pay/:ref", allow: ALL, token: true },
  { id: "F-PP-05", module: "Payment page (public)", feature: "Client reports a payment request", method: "POST", path: "/pay/:ref/report", ui: "/pay/:ref", allow: ALL, token: true },
  { id: "F-PP-06", module: "Payment page (public)", feature: "Start a PayFast payment (off until configured)", method: "POST", path: "/pay/:ref/payfast/initiate", ui: "/pay/:ref", allow: ALL, token: true },
  { id: "F-PP-07", module: "Payment page (public)", feature: "PayFast confirmation webhook (ITN)", method: "POST", path: "/payfast/itn", ui: "—", allow: ALL, token: true, note: "Always answers 200; acts only on a valid PayFast signature" },

  // ------------------------------------------------------------------ founder: protection and privacy
  { id: "F-FR-01", module: "Fraud protection", feature: "Messages, supplier holds, fingerprints", method: "GET", path: "/founder/protection", ui: "/app/protection", allow: ["founder"] },
  { id: "F-FR-02", module: "Fraud protection", feature: "Report and block, or mark genuine", method: "POST", path: "/founder/messages/:id", ui: "/app/protection", allow: ["founder"] },
  { id: "F-FR-03", module: "Fraud protection", feature: "Check a message", method: "POST", path: "/founder/check-message", ui: "/app/protection", allow: ["founder"] },
  { id: "F-PRV-01", module: "Privacy", feature: "Sharing, incubator and requests", method: "GET", path: "/founder/privacy", ui: "/app/privacy", allow: ["founder"] },
  { id: "F-PRV-02", module: "Privacy", feature: "Change what funders see", method: "PUT", path: "/founder/privacy", ui: "/app/privacy", allow: ["founder"] },
  { id: "F-PRV-03", module: "Privacy", feature: "Download my data", method: "GET", path: "/founder/privacy/export", ui: "/app/privacy", allow: ["founder"] },
  { id: "F-PRV-04", module: "Privacy", feature: "Agree to the updated privacy notice", method: "POST", path: "/founder/privacy/consent", ui: "every founder page (prompt)", allow: ["founder"] },
  { id: "F-PRV-05", module: "Privacy", feature: "Ask to correct or delete my data", method: "POST", path: "/founder/privacy/requests", ui: "/app/privacy", allow: ["founder"] },
  { id: "F-PRV-06", module: "Privacy", feature: "Ask to join, move or leave an incubator", method: "POST", path: "/founder/incubator", ui: "/app/privacy", allow: ["founder"] },

  // ------------------------------------------------------------------ founder: markets, funding, procurement
  { id: "F-MKT-01", module: "Profile & marketing", feature: "Profile, posts and buyers", method: "GET", path: "/founder/markets", ui: "/app/markets", allow: ["founder"] },
  { id: "F-MKT-02", module: "Profile & marketing", feature: "Save public profile", method: "PUT", path: "/founder/profile", ui: "/app/markets", allow: ["founder"] },
  { id: "F-MKT-03", module: "Profile & marketing", feature: "Save a post (and ask for a feature)", method: "POST", path: "/founder/posts", ui: "/app/markets", allow: ["founder"] },
  { id: "F-MKT-04", module: "Profile & marketing", feature: "Record a share (WhatsApp, Facebook, X)", method: "POST", path: "/founder/posts/:id/shared", ui: "/app/markets", allow: ["founder"] },
  { id: "F-MKT-05", module: "Profile & marketing", feature: "Ask to meet a buyer", method: "POST", path: "/founder/intros/:id", ui: "/app/markets", allow: ["founder"] },
  { id: "F-FUND-01", module: "Funding readiness", feature: "Score, programmes and gaps, applications", method: "GET", path: "/founder/funding", ui: "/app/funding", allow: ["founder"] },
  { id: "F-FUND-02", module: "Funding readiness", feature: "Apply to a programme", method: "POST", path: "/founder/applications", ui: "/app/funding", allow: ["founder"] },
  { id: "F-FUND-03", module: "Funding readiness", feature: "Ask the funder for a reason", method: "POST", path: "/founder/applications/:id/ask-reason", ui: "/app/funding", allow: ["founder"] },
  { id: "F-FUND-04", module: "Funding readiness", feature: "Withdraw an application", method: "POST", path: "/founder/applications/:id/withdraw", ui: "/app/funding", allow: ["founder"] },
  { id: "F-PROC-01", module: "Procurement", feature: "Tenders and what's missing", method: "GET", path: "/founder/procurement", ui: "/app/procurement", allow: ["founder"] },
  { id: "F-PROC-02", module: "Procurement", feature: "Express interest in a tender", method: "POST", path: "/founder/tenders/:id/interest", ui: "/app/procurement", allow: ["founder"] },

  // ------------------------------------------------------------------ public directory
  { id: "F-DIR-01", module: "Directory (public)", feature: "Directory of Verified businesses", method: "GET", path: "/public/directory", ui: "/directory", allow: ALL },
  { id: "F-DIR-02", module: "Directory (public)", feature: "A business's public page", method: "GET", path: "/public/b/:slug", ui: "/b/:slug", allow: ALL },
  { id: "F-DIR-03", module: "Directory (public)", feature: "Report a business", method: "POST", path: "/public/b/:slug/report", ui: "/b/:slug", allow: ALL },

  // ------------------------------------------------------------------ funder portal
  { id: "F-FUN-01", module: "Funder portal", feature: "Company pipeline", method: "GET", path: "/funder/pipeline", ui: "/funder/pipeline", allow: ["funder"] },
  { id: "F-FUN-02", module: "Funder portal", feature: "Applications to this funder", method: "GET", path: "/funder/applications", ui: "/funder/applications", allow: ["funder"] },
  { id: "F-FUN-03", module: "Funder portal", feature: "Programmes & requirements", method: "GET", path: "/funder/programmes", ui: "/funder/programmes", allow: ["funder"] },
  { id: "F-FUN-04", module: "Funder portal", feature: "Add a programme (also first set-up)", method: "POST", path: "/funder/programmes", ui: "/funder/setup, /funder/programmes", allow: ["funder"] },
  { id: "F-FUN-05", module: "Funder portal", feature: "Change a programme's required documents", method: "POST", path: "/funder/programmes/:id/requirements", ui: "/funder/programmes", allow: ["funder"] },
  { id: "F-FUN-06", module: "Funder portal", feature: "Close or reopen a programme", method: "POST", path: "/funder/programmes/:id/status", ui: "/funder/programmes", allow: ["funder"] },
  { id: "F-FUN-07", module: "Funder portal", feature: "Company drawer", method: "GET", path: "/funder/companies/:id", ui: "pipeline, applications", allow: ["funder"] },
  { id: "F-FUN-08", module: "Funder portal", feature: "Invite a company to apply", method: "POST", path: "/funder/companies/:id/invite", ui: "drawer", allow: ["funder"] },
  { id: "F-FUN-09", module: "Funder portal", feature: "Change an offer (reason required)", method: "POST", path: "/funder/applications/:id/offer", ui: "drawer", allow: ["funder"] },
  { id: "F-FUN-10", module: "Funder portal", feature: "Approve the current offer", method: "POST", path: "/funder/applications/:id/approve", ui: "drawer", allow: ["funder"] },
  { id: "F-FUN-11", module: "Funder portal", feature: "Decline (reason required)", method: "POST", path: "/funder/applications/:id/decline", ui: "drawer", allow: ["funder"] },
  { id: "F-FUN-12", module: "Funder portal", feature: "Under review / awaiting co-funding", method: "POST", path: "/funder/applications/:id/status", ui: "drawer", allow: ["funder"] },

  // ------------------------------------------------------------------ adviser portal
  { id: "F-ADV-01", module: "Adviser portal", feature: "Cohort board and requests to join", method: "GET", path: "/adviser/cohort", ui: "/adviser/cohort", allow: ["adviser"] },
  { id: "F-ADV-02", module: "Adviser portal", feature: "Needs attention", method: "GET", path: "/adviser/attention", ui: "/adviser/attention", allow: ["adviser"] },
  { id: "F-ADV-03", module: "Adviser portal", feature: "Support log, introductions and tender interest", method: "GET", path: "/adviser/support", ui: "/adviser/support", allow: ["adviser"] },
  { id: "F-ADV-04", module: "Adviser portal", feature: "Log support", method: "POST", path: "/adviser/support", ui: "/adviser/support", allow: ["adviser"] },
  { id: "F-ADV-05", module: "Adviser portal", feature: "Company drawer (full books)", method: "GET", path: "/adviser/companies/:id", ui: "cohort, attention", allow: ["adviser"] },
  { id: "F-ADV-06", module: "Adviser portal", feature: "Assign an adviser", method: "POST", path: "/adviser/companies/:id/adviser", ui: "drawer", allow: ["adviser"] },
  { id: "F-ADV-07", module: "Adviser portal", feature: "Move a support stage", method: "POST", path: "/adviser/companies/:id/stage", ui: "drawer", allow: ["adviser"] },
  { id: "F-ADV-08", module: "Adviser portal", feature: "Accept or decline a request to join", method: "POST", path: "/adviser/memberships/:id", ui: "/adviser/cohort", allow: ["adviser"] },
  { id: "F-ADV-09", module: "Adviser portal", feature: "Arrange or decline an introduction", method: "POST", path: "/adviser/intros/:id", ui: "/adviser/support", allow: ["adviser"] },
  { id: "F-ADV-10", module: "Adviser portal", feature: "Arrange or decline tender interest", method: "POST", path: "/adviser/tenders/:id", ui: "/adviser/support", allow: ["adviser"] },

  // ------------------------------------------------------------------ admin portal
  { id: "F-ADM-01", module: "Admin portal", feature: "Organisations and their people", method: "GET", path: "/admin/organisations", ui: "/admin/organisations", allow: ["admin"] },
  { id: "F-ADM-02", module: "Admin portal", feature: "Add an organisation", method: "POST", path: "/admin/organisations", ui: "/admin/organisations", allow: ["admin"] },
  { id: "F-ADM-03", module: "Admin portal", feature: "Verify or unverify an organisation", method: "POST", path: "/admin/organisations/:id/verified", ui: "/admin/organisations", allow: ["admin"], body: { verified: true } },
  { id: "F-ADM-04", module: "Admin portal", feature: "Invite a person (sends a sign-in)", method: "POST", path: "/admin/users", ui: "/admin/organisations", allow: ["admin"] },
  { id: "F-ADM-05", module: "Applications", feature: "Portal applications queue", method: "GET", path: "/admin/applications", ui: "/admin/applications", allow: ["admin"] },
  { id: "F-ADM-06", module: "Applications", feature: "Approve or turn down an application", method: "POST", path: "/admin/applications/:id", ui: "/admin/applications", allow: ["admin"] },
  { id: "F-ADM-07", module: "Admin portal", feature: "Reports and data requests", method: "GET", path: "/admin/reports", ui: "/admin/reports", allow: ["admin"] },
  { id: "F-ADM-08", module: "Admin portal", feature: "Resolve or dismiss a report", method: "POST", path: "/admin/reports/:id", ui: "/admin/reports", allow: ["admin"] },
  { id: "F-ADM-09", module: "Admin portal", feature: "Feature requests", method: "GET", path: "/admin/features", ui: "/admin/features", allow: ["admin"] },
  { id: "F-ADM-10", module: "Admin portal", feature: "Feature or reject a post", method: "POST", path: "/admin/features/:id", ui: "/admin/features", allow: ["admin"] },
  { id: "F-ADM-11", module: "Admin portal", feature: "Flagged payments and reported senders", method: "GET", path: "/admin/flagged", ui: "/admin/flagged", allow: ["admin"] },
  { id: "F-ADM-12", module: "Admin portal", feature: "Confirm or clear a reported sender", method: "POST", path: "/admin/watchlist/:id", ui: "/admin/flagged", allow: ["admin"] },
  { id: "F-ADM-13", module: "Admin portal", feature: "Tenders and requests", method: "GET", path: "/admin/tenders", ui: "/admin/tenders", allow: ["admin"] },
  { id: "F-ADM-14", module: "Admin portal", feature: "Publish a tender", method: "POST", path: "/admin/tenders", ui: "/admin/tenders", allow: ["admin"] },
  { id: "F-ADM-15", module: "Admin portal", feature: "Arrange or decline an introduction (no incubator)", method: "POST", path: "/admin/intros/:id", ui: "/admin/tenders", allow: ["admin"] },
  { id: "F-ADM-16", module: "Admin portal", feature: "Arrange or decline tender interest (no incubator)", method: "POST", path: "/admin/tenders/:id", ui: "/admin/tenders", allow: ["admin"] },
  { id: "F-ADM-17", module: "Admin portal", feature: "Monitoring overview (platform totals)", method: "GET", path: "/admin/overview", ui: "/admin/overview", allow: ["admin"] },
  { id: "F-ADM-18", module: "Admin portal", feature: "Activity: audit log with filters and chain check", method: "GET", path: "/admin/activity", ui: "/admin/activity", allow: ["admin"] },
  { id: "F-ADM-19", module: "Admin portal", feature: "People: every account with two-step status and last seen", method: "GET", path: "/admin/people", ui: "/admin/people", allow: ["admin"] },
  { id: "F-ADM-20", module: "Admin portal", feature: "Businesses: every company with level and score", method: "GET", path: "/admin/companies", ui: "/admin/people", allow: ["admin"] },
  { id: "F-ADM-21", module: "Admin portal", feature: "Open one business (audited)", method: "GET", path: "/admin/companies/:id", ui: "/admin/people", allow: ["admin"] },
  { id: "F-ADM-22", module: "Admin portal", feature: "Security and system health", method: "GET", path: "/admin/health", ui: "/admin/health", allow: ["admin"] },
  { id: "F-ADM-23", module: "Admin portal", feature: "User approvals: everyone who isn't a founder", method: "GET", path: "/admin/approvals", ui: "/admin/approvals", allow: ["admin"] },
  { id: "F-ADM-24", module: "Admin portal", feature: "Open an application or account (founders refused)", method: "GET", path: "/admin/approvals/:type/:id", ui: "/admin/approvals", allow: ["admin"] },
  { id: "F-ADM-25", module: "Admin portal", feature: "Approve or reject an application (reason required)", method: "POST", path: "/admin/approvals/application/:id", ui: "/admin/approvals", allow: ["admin"] },
  { id: "F-ADM-26", module: "Admin portal", feature: "Suspend an account (reason required; not founders, admins or yourself)", method: "POST", path: "/admin/approvals/user/:id/suspend", ui: "/admin/approvals", allow: ["admin"] },
  { id: "F-ADM-27", module: "Admin portal", feature: "Reinstate a suspended account", method: "POST", path: "/admin/approvals/user/:id/reinstate", ui: "/admin/approvals", allow: ["admin"] },
  { id: "F-UML-01", module: "UML diagrams", feature: "List and view UML diagrams", method: "GET", path: "/uml", ui: "/admin/uml, /app/uml", allow: ["founder", "admin"] },
  { id: "F-UML-02", module: "UML diagrams", feature: "View or download a diagram (SVG, PNG, PDF or Mermaid source)", method: "GET", path: "/uml/:id/:format", ui: "/admin/uml, /app/uml", allow: ["founder", "admin"] },
  { id: "F-UML-03", module: "UML diagrams", feature: "Admin decisions log (summary for founders)", method: "GET", path: "/admin-log", ui: "/app/admin-log", allow: ["founder", "admin"] },
  { id: "F-TST-01", module: "Testing", feature: "Testing page: demo site and accounts, latest results", method: "GET", path: "/testing", ui: "/admin/testing", allow: ["admin"] },
  { id: "F-TST-02", module: "Testing", feature: "Test cases (from TEST-CASES.md)", method: "GET", path: "/testing/cases", ui: "/admin/testing", allow: ["admin"] },
  { id: "F-TST-03", module: "Testing", feature: "Download a test document", method: "GET", path: "/testing/documents/:id", ui: "/admin/testing", allow: ["admin"] },
];

/** Features with no HTTP endpoint of their own (jobs, emails, web-only), listed in the inventory too. */
export const NON_HTTP = [
  { id: "F-JOB-01", module: "Background jobs", feature: "Daily: expire payment requests after 7 days, expire documents past their date, audit-chain check and export, retention purge, abandoned uploads", where: "apps/api/src/jobs.ts (Cloud Run Job)", roles: "system" },
  { id: "F-JOB-02", module: "Background jobs", feature: "Weekly: re-check every stored document against its SHA-256 fingerprint", where: "apps/api/src/jobs.ts", roles: "system" },
  { id: "F-MAIL-01", module: "Emails", feature: "Invitation with sign-in instructions", where: "POST /admin/users", roles: "invited funder, adviser or buyer" },
  { id: "F-MAIL-02", module: "Emails", feature: "Application approved / not approved", where: "POST /admin/applications/:id", roles: "applicant" },
  { id: "F-MAIL-03", module: "Emails", feature: "You're verified / Please upload again", where: "document checks", roles: "founder" },
  { id: "F-MAIL-04", module: "Emails", feature: "Payment details changed (founder and advisers)", where: "PUT /founder/payment-details", roles: "founder, adviser" },
  { id: "F-MAIL-05", module: "Emails", feature: "Two-step sign-in on / off / reset", where: "auth routes", roles: "any user" },
  { id: "F-WEB-01", module: "Web app", feature: "Notification bell (founder)", where: "FounderShell, data from /founder/home", roles: "founder" },
  { id: "F-WEB-02", module: "Web app", feature: "Offline entries saved on the phone and sent once", where: "lib/outbox.ts, sw.ts", roles: "founder" },
  { id: "F-WEB-03", module: "Web app", feature: "Install as an app (PWA), app shell offline", where: "manifest, sw.ts", roles: "everyone" },
  { id: "F-WEB-04", module: "Web app", feature: "Continue with Google (Firebase only)", where: "/sign-in", roles: "everyone (production)" },
  { id: "F-WEB-05", module: "Web app", feature: "Privacy notice page", where: "/privacy-notice", roles: "everyone" },
] as const;
