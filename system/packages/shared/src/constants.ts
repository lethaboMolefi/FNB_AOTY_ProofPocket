// Reference data ported from v2/app.js (DOCS, START_STEPS, STAGES, TYPES, categories, methods).

export const DOCS = {
  cipc: { name: "CIPC registration certificate", short: "CIPC", join: true, pts: 15 },
  id: { name: "Owner ID copy", short: "ID", join: true, pts: 5 },
  bank: { name: "Business bank account confirmation", short: "Bank", join: true, pts: 10 },
  addr: { name: "Proof of business address", short: "Address", join: true, pts: 0 },
  tax: { name: "SARS tax registration", short: "Tax", join: false, pts: 15 },
  bplan: { name: "Business plan", short: "Plan", join: false, pts: 10 },
  fin: { name: "Management accounts signed by an accountant", short: "Accounts", join: false, pts: 15 },
  bbbee: { name: "B-BBEE affidavit", short: "B-BBEE", join: false, pts: 0 },
  csd: { name: "Central Supplier Database registration", short: "CSD", join: false, pts: 0 },
} as const;
export type DocType = keyof typeof DOCS;
export const DOC_TYPES = Object.keys(DOCS) as DocType[];

/** The four documents that make a company Verified. */
export const JOIN_DOCS: DocType[] = ["cipc", "id", "bank", "addr"];
/** What a Starter (not CIPC-registered) shows when joining. */
export const STARTER_DOCS: DocType[] = ["id", "addr"];
/** Documents counted in the readiness score, in display order. */
export const READINESS_DOCS: DocType[] = ["cipc", "id", "bank", "tax", "bplan", "fin"];
/** Documents a tender may require that the procurement page counts. */
export const TENDER_DOCS: DocType[] = ["tax", "csd", "bbbee"];
/** Documents a funder can require (ID and address are always checked for everyone). */
export const FUNDER_REQUIRABLE_DOCS: DocType[] = DOC_TYPES.filter((k) => k !== "id" && k !== "addr");

export type DocState = "missing" | "pending" | "verified" | "expired";
export const DOC_STATE_LABEL: Record<DocState, { tone: Tone; label: string }> = {
  verified: { tone: "good", label: "Verified" },
  pending: { tone: "warn", label: "Being checked" },
  missing: { tone: "bad", label: "Missing" },
  expired: { tone: "bad", label: "Expired" },
};

export type Tone = "good" | "warn" | "bad" | "info" | "plain";

export const START_STEPS: { key: DocType; title: string; how: string }[] = [
  { key: "id", title: "Confirm who you are", how: "Upload a copy of your ID. Only your adviser and the ProofPocket checker see it." },
  { key: "cipc", title: "Register your company with CIPC", how: "Reserve a name and register a private company online on CIPC's BizPortal. Upload the registration certificate you receive." },
  { key: "bank", title: "Open a business bank account", how: "Open an account in the company's name and upload the bank's confirmation letter. Keep personal money out of it from day one." },
  { key: "addr", title: "Show where you trade", how: "Upload a utility bill, a lease, or a letter from your landlord or ward councillor." },
  { key: "tax", title: "Register for tax with SARS", how: "Register the company for income tax on SARS eFiling and upload the registration notice." },
  { key: "bbbee", title: "Get a B-BBEE affidavit", how: "Small businesses can use a sworn affidavit instead of a full B-BBEE certificate. Buyers ask for it." },
  { key: "csd", title: "Register on the Central Supplier Database", how: "Government and many corporates can only pay suppliers registered on the CSD." },
];

export const STAGES = ["Assessment", "Adviser assigned", "Service agreement", "Intervention", "Monitoring & evaluation"] as const;

export const SUPPORT_TYPES = [
  "Business registration help", "Bookkeeping coaching", "Document check", "Tax compliance",
  "Business plan", "Funding application", "Market linkage", "Procurement readiness",
] as const;

export const BUSINESS_TYPES = {
  beauty: { label: "Beauty & personal care", stock: true },
  food: { label: "Food & catering", stock: true },
  retail: { label: "Retail & spaza", stock: true },
  recycling: { label: "Recycling & waste", stock: true },
  trades: { label: "Trades & installation", stock: true },
  services: { label: "Services & tech", stock: false },
} as const;
export type BusinessType = keyof typeof BUSINESS_TYPES;
export const BUSINESS_TYPE_KEYS = Object.keys(BUSINESS_TYPES) as BusinessType[];

/**
 * Fixed sector list (inventory 12.10b). Tenders and buyers match on these labels,
 * so Join picks one instead of copying the business-type label.
 */
export const SECTORS: Record<BusinessType, readonly string[]> = {
  beauty: ["Beauty services", "Hair and barbering"],
  food: ["Catering", "Food production", "Baking"],
  retail: ["Spaza and general retail", "Clothing and textiles"],
  recycling: ["Recycling", "Waste management"],
  trades: ["Solar installation", "Building and construction", "Plumbing and electrical", "Auto repairs"],
  services: ["Agritech software", "Software and IT", "Cleaning services", "Transport and logistics", "Professional services"],
};
export const ALL_SECTORS = Object.values(SECTORS).flat();

export const IN_CATS = ["Sales", "Services", "Grant received", "Other income"] as const;
export const OUT_CATS = [
  "Stock and materials", "Wages", "Owner salary", "Transport", "Rent",
  "Airtime and data", "Equipment", "Collector payments", "Other expense",
] as const;
export const OWNER_SALARY = "Owner salary";

export const PAY_METHODS = {
  cash: "Cash",
  card_machine: "Card machine",
  eft: "Bank EFT",
  payshap: "PayShap",
  wallet: "Mobile wallet",
} as const;
export type PayMethod = keyof typeof PAY_METHODS;
export const PAY_METHOD_KEYS = Object.keys(PAY_METHODS) as PayMethod[];

/** Ways a client can pay a payment request. */
export const RAILS = { payshap: "PayShap", eft: "Bank EFT", cash: "Cash", card_machine: "Card machine" } as const;
export type Rail = keyof typeof RAILS;
export const RAIL_KEYS = Object.keys(RAILS) as Rail[];
export const DIGITAL_RAILS: Rail[] = ["payshap", "eft"];

export const PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo",
  "Mpumalanga", "North West", "Northern Cape", "Western Cape",
] as const;

export const AREAS = { township: "Township", urban: "Urban", rural: "Rural" } as const;
export type Area = keyof typeof AREAS;

export const FUNDER_KINDS = ["Grant", "Loan", "Equity", "Blended"] as const;

export type FunderSharing = "none" | "summary" | "full";

export const APPLICATION_STATUS = {
  submitted: { label: "Submitted", tone: "plain" },
  under_review: { label: "Under review", tone: "info" },
  offer_made: { label: "Offer made", tone: "info" },
  awaiting_cofunding: { label: "Awaiting co-funding", tone: "warn" },
  approved: { label: "Approved", tone: "good" },
  declined: { label: "Declined", tone: "bad" },
  withdrawn: { label: "Withdrawn", tone: "plain" },
} as const satisfies Record<string, { label: string; tone: Tone }>;
export type ApplicationStatus = keyof typeof APPLICATION_STATUS;

export type PaymentStatus = "waiting" | "checking" | "paid" | "not_received" | "flagged" | "expired" | "cancelled";

export type Role = "founder" | "funder" | "adviser" | "buyer" | "admin";
/** Roles that sign in with an email one-time PIN as well as a password. */
export const OTP_ROLES: Role[] = ["funder", "adviser", "admin"];

export const PAYMENT_REQUEST_DAYS = 7;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const CIPC_PATTERN = /^\d{4}\/\d{6}\/\d{2}$/;
