// Navigation for each portal. Groups, labels and page copy come from v2/app.js (RAIL, fHead and page heads).
import { BUSINESS_TYPES, type BusinessType } from "@proofpocket/shared";

export interface NavPage {
  path: string;
  label: string;
  /** Shorter label for the phone tab bar. */
  short?: string;
  title: string;
  sub: string;
  /** Build phase that delivers the screen (shown on placeholders until then). */
  phase: number;
}
export interface NavGroup { group: string; pages: NavPage[] }

// The founder menu from the dashboard redesign (dashborad): grouped by what founders do day to day.
export const FOUNDER_NAV: NavGroup[] = [
  { group: "", pages: [
    { path: "home", label: "Home", title: "Home", sub: "", phase: 3 },
  ] },
  { group: "Daily operations", pages: [
    { path: "books", label: "Bookkeeping", short: "Books", title: "Bookkeeping", sub: "Record every sale and expense here, including cash. ProofPocket works out your profit and keeps the records funders ask for.", phase: 3 },
    { path: "stock", label: "Stock", title: "Stock", sub: "Know what you have before a client asks. Sales and purchases in Bookkeeping can update these numbers too.", phase: 3 },
    { path: "payments", label: "Payments", short: "Get paid", title: "Payments", sub: "Clients pay you directly with the methods they already use. They upload proof of payment, and you confirm once the money is in your account.", phase: 4 },
    { path: "cashflow", label: "Cash flow", title: "Cash flow", sub: "Where your money is, where it's going, and how long it lasts.", phase: 3 },
  ] },
  { group: "Documents", pages: [
    { path: "start", label: "Registration steps", title: "Registration steps", sub: "Everything a business needs to trade formally, one step at a time. The first four make you a Verified business; the rest open tenders and bigger funding.", phase: 2 },
  ] },
  { group: "Funding & markets", pages: [
    { path: "markets", label: "Profile & marketing", short: "Markets", title: "Profile & marketing", sub: "Your public page, a verified QR code, and posts you share from your own WhatsApp and social media.", phase: 5 },
    { path: "funding", label: "Funding readiness", title: "Funding readiness", sub: "Funders set their own requirements on ProofPocket. See what each one checks, and what you still need, before you apply.", phase: 5 },
    { path: "procurement", label: "Procurement", title: "Procurement", sub: "Tenders and supplier opportunities. Buyers see your checked documents and your track record on ProofPocket, so you don't have to prove it from scratch each time.", phase: 5 },
  ] },
  { group: "Safety", pages: [
    { path: "protection", label: "Fraud protection", title: "Fraud protection", sub: "Scam warnings, holds on changed bank details, and a fingerprint of every document you upload.", phase: 4 },
    { path: "privacy", label: "Privacy & sharing", title: "Privacy & sharing", sub: "You decide who sees what. You can change this at any time.", phase: 4 },
  ] },
  { group: "Account", pages: [
    { path: "settings", label: "Business settings", title: "Business settings", sub: "Opening balance, people and the year you started trading.", phase: 3 },
    { path: "uml", label: "UML diagrams", title: "UML diagrams", sub: "How ProofPocket is built.", phase: 5 },
    { path: "admin-log", label: "Admin decisions", title: "Admin decisions", sub: "Who ProofPocket's admins let in, turned down or suspended.", phase: 5 },
  ] },
];

/** Phone bottom tabs, every role: the first pages here, then More for the rest. */
export const FOUNDER_TABS = ["home", "books", "payments", "markets"];
export const FUNDER_TABS = ["pipeline", "applications", "programmes"];
export const ADVISER_TABS = ["cohort", "checks", "attention", "support"];
export const ADMIN_TABS = ["overview", "approvals", "checks", "activity"];

/** Stock is only for business types that hold stock (v2: TYPES[type].stock). */
export const founderNavFor = (type: BusinessType | undefined): NavGroup[] =>
  FOUNDER_NAV.map((g) => ({ ...g, pages: g.pages.filter((p) => p.path !== "stock" || (type ? BUSINESS_TYPES[type].stock : true)) }));

export const FUNDER_NAV: NavPage[] = [
  { path: "pipeline", label: "Company pipeline", short: "Pipeline", title: "Company pipeline", sub: "Verified companies that chose to share with funders, ranked by readiness. Scores come from checked documents and live books, not self-reported figures.", phase: 5 },
  { path: "applications", label: "Applications", short: "Applications", title: "Applications", sub: "Every change to an offer needs a reason, and founders see the full history.", phase: 5 },
  { path: "programmes", label: "Programmes & requirements", short: "Programmes", title: "Programmes & requirements", sub: "Founders see these requirements before they apply. Changes reach them straight away.", phase: 5 },
];
export const FUNDER_SETUP: NavPage = {
  path: "setup", label: "Set your requirements", title: "Set your requirements",
  sub: "Before you see companies, tell founders what you need. They see these requirements on their Funding page before they apply, so fewer incomplete applications reach you.", phase: 5,
};

export const ADVISER_NAV: NavPage[] = [
  { path: "cohort", label: "Cohort board", short: "Cohort", title: "Cohort board", sub: "Your companies by support stage. Starter companies are ones you're helping to register.", phase: 5 },
  { path: "checks", label: "Document checks", short: "Checks", title: "Document checks", sub: "Check each upload against the original or the issuer's records, then approve it or send it back with a reason. A company becomes Verified when its four joining documents are approved.", phase: 2 },
  { path: "attention", label: "Needs attention", short: "Attention", title: "Needs attention", sub: "Problems spotted in your companies' books, documents, stock and messages, most urgent first.", phase: 5 },
  { path: "support", label: "Support log", short: "Support", title: "Support log", sub: "Record every intervention so funders and your monitoring and evaluation reports show what support each company received.", phase: 5 },
];

export const ADMIN_NAV: NavPage[] = [
  { path: "overview", label: "Overview", short: "Overview", title: "Overview", sub: "How ProofPocket is doing today: who's joining, what's waiting, and money recorded across all businesses.", phase: 5 },
  { path: "activity", label: "Activity", short: "Activity", title: "Activity", sub: "Everything people and the system did, newest first. The log can't be edited, and its chain is checked.", phase: 5 },
  { path: "people", label: "People & companies", short: "People", title: "People & companies", sub: "Every account and every business, with two-step status and when they were last seen.", phase: 5 },
  { path: "health", label: "Security & health", short: "Health", title: "Security & health", sub: "Lockouts, two-step gaps, rate limits, background jobs, email failures and the system's own checks.", phase: 5 },
  { path: "approvals", label: "User approvals", short: "Approvals", title: "User approvals", sub: "Everyone who isn't a founder: approve, turn down or suspend.", phase: 5 },
  { path: "checks", label: "Checker queue", short: "Checks", title: "Checker queue", sub: "Documents from companies without an incubator. Approve them or send them back with a reason.", phase: 2 },
  { path: "applications", label: "Applications", short: "Applications", title: "Applications", sub: "Funders and support organisations asking for a portal. Approve or turn down with a reason.", phase: 5 },
  { path: "organisations", label: "Organisations", title: "Organisations", sub: "Verify funders, incubators and buyers, and invite their people.", phase: 5 },
  { path: "reports", label: "Reports", title: "Reports", sub: "Businesses, payment requests and senders reported by founders and the public.", phase: 5 },
  { path: "features", label: "Feature requests", title: "Feature requests", sub: "Posts Verified businesses asked to feature in the directory this week.", phase: 5 },
  { path: "flagged", label: "Flagged payments", title: "Flagged payments", sub: "Payment requests where a founder rejected the proof of payment twice.", phase: 5 },
  { path: "tenders", label: "Tenders & buyers", title: "Tenders & buyers", sub: "Opportunities founders can express interest in, and buyers they can ask to meet.", phase: 5 },
  { path: "testing", label: "Testing", title: "Testing", sub: "The demo site, test results and test cases.", phase: 5 },
  { path: "uml", label: "UML diagrams", title: "UML diagrams", sub: "How ProofPocket is built.", phase: 5 },
  { path: "profile", label: "Profile", title: "Profile", sub: "Your own account and password.", phase: 5 },
];
