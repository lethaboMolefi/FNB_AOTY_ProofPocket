// Example data ported from seed() in v2/app.js. Every row is marked is_example.
// Offsets are days before the seed date, as in the prototype (inMonth / daysAgo).
import type { DocState, DocType, PayMethod, Rail } from "@proofpocket/shared";

export type LedgerRow = [offset: number, direction: "in" | "out", amount: number, method: PayMethod, category: string, note: string, extra?: { personal?: boolean }];

export interface SeedCompany {
  key: string;
  name: string;
  legalName: string | null;
  businessType: "beauty" | "food" | "retail" | "recycling" | "trades" | "services";
  sector: string;
  town: string;
  province: string;
  area: "township" | "urban" | "rural";
  stage: string;
  founded: number;
  founder: { name: string; email: string };
  employees: number;
  cipc: string | null;
  opening: number;
  sharing: "none" | "summary" | "full";
  docs: Partial<Record<DocType, DocState>>;
  /** Money in/out for the five months before this one, oldest first. */
  months: [number, number][];
  ledger: LedgerRow[];
  stock: [name: string, unit: string, qty: number, reorder: number, cost: number][];
  suppliers: { name: string; bank: string; pending?: { bank: string; daysAgo: number } }[];
  profile: { tagline: string; services: string; whatsapp: string; instagram: string; hours: string };
  incubator: { key: string; stage: number; adviser: string | null; log: { daysAgo: number; type: string; note: string }[] };
  activity: { daysAgo: number; text: string }[];
  pay: { bank: string; accountName: string; accountNumber: string; inBusinessName: boolean };
}

const V = "verified" as const;

export const COMPANIES: SeedCompany[] = [
  {
    key: "c1", name: "Nala Nails & Lashes", legalName: null, businessType: "beauty", sector: "Beauty services", town: "Soweto", province: "Gauteng", area: "township",
    stage: "Early", founded: 2022, founder: { name: "Zanele M.", email: "zanele@proofpocket.example" }, employees: 1, cipc: null, opening: 1400, sharing: "summary",
    docs: { id: V, addr: V },
    months: [[0, 0], [0, 0], [7600, 5600], [8800, 5900], [7900, 6400]],
    ledger: [[12, "in", 450, "cash", "Services", "Lash lift"], [11, "in", 380, "card_machine", "Services", "Manicure x2"], [11, "out", 1250, "eft", "Stock and materials", "Gel polish restock"], [9, "in", 520, "cash", "Services", "Full set"], [9, "out", 640, "card_machine", "Other expense", "Groceries", { personal: true }], [9, "in", 300, "payshap", "Services", "Manicure"]],
    stock: [["Gel polish", "bottles", 3, 4, 85], ["Lash glue", "tubes", 1, 2, 120], ["Nail tips", "boxes", 5, 2, 60], ["Acetone", "litres", 2, 1, 45]],
    suppliers: [{ name: "Glam Supplies", bank: "Capitec ••3310", pending: { bank: "Unknown bank ••9001", daysAgo: 2 } }],
    profile: { tagline: "Nails and lashes in Soweto, by appointment.", services: "Manicure R150\nGel overlay R250\nLash lift R350", whatsapp: "071 555 0142", instagram: "@nala.nails.soweto", hours: "Tue–Sat, 9:00–18:00" },
    incubator: { key: "n1", stage: 1, adviser: "N. Mokoena", log: [{ daysAgo: 20, type: "Business registration help", note: "Moved three months of notebook records into ProofPocket. Next: CIPC registration." }] },
    activity: [{ daysAgo: 24, text: "Joined ProofPocket as a Starter. ID and address checked." }],
    pay: { bank: "Capitec", accountName: "Z. M. (personal account)", accountNumber: "1452 336 871", inBusinessName: false },
  },
  {
    key: "c2", name: "ReKasi Plastics", legalName: "ReKasi Plastics (Pty) Ltd", businessType: "recycling", sector: "Recycling", town: "Alexandra", province: "Gauteng", area: "township",
    stage: "Early", founded: 2024, founder: { name: "Palesa K.", email: "palesa@proofpocket.example" }, employees: 4, cipc: "2024/102877/07", opening: 6200, sharing: "full",
    docs: { cipc: V, id: V, bank: V, addr: V, tax: V, bplan: V, bbbee: V, csd: "pending" },
    months: [[6400, 7100], [9800, 8300], [11200, 9100], [14500, 10200], [12900, 11800]],
    ledger: [[6, "in", 4200, "eft", "Sales", "300 pencil holders (deposit)"], [5, "out", 780, "cash", "Collector payments", "PET bottles, 156 kg · slip S20431"], [4, "out", 2400, "eft", "Equipment", "Shredder blade service"], [3, "out", 620, "cash", "Collector payments", "HDPE, 98 kg · slip S20457"], [2, "in", 1850, "payshap", "Sales", "Filament spools x5"]],
    stock: [["PET flakes", "kg", 120, 50, 4], ["Filament spools", "spools", 14, 5, 95]],
    suppliers: [],
    profile: { tagline: "Township plastic, remade into 3D-printing filament and products.", services: "Filament spool (1 kg) R370\nPencil holder R14 each (min 100)\nCustom recycled products on quote", whatsapp: "072 555 0177", instagram: "@rekasi.plastics", hours: "Mon–Fri, 8:00–16:00" },
    incubator: { key: "n2", stage: 3, adviser: "S. Pillay", log: [{ daysAgo: 35, type: "Funding application", note: "Helped prepare Youth Micro Grant application." }, { daysAgo: 12, type: "Bookkeeping coaching", note: "Moved from Excel; cash collector payments now recorded with slip numbers." }] },
    activity: [{ daysAgo: 14, text: "Lesedi Youth Fund changed the offer to R28 000 (no reason given)." }, { daysAgo: 40, text: "Applied to Youth Micro Grant for R50 000." }],
    pay: { bank: "FNB", accountName: "ReKasi Plastics (Pty) Ltd", accountNumber: "6281 004 517", inBusinessName: true },
  },
  {
    key: "c3", name: "Mabele AgriLink", legalName: "Mabele AgriLink (Pty) Ltd", businessType: "services", sector: "Agritech software", town: "Polokwane", province: "Limpopo", area: "rural",
    stage: "Growth", founded: 2021, founder: { name: "Tumelo R.", email: "tumelo@proofpocket.example" }, employees: 7, cipc: "2021/554019/07", opening: 52000, sharing: "full",
    docs: { cipc: V, id: V, bank: V, addr: V, tax: V, bplan: V, fin: V, bbbee: V, csd: V },
    months: [[41000, 33500], [38500, 34100], [44200, 35800], [46900, 36200], [48300, 37900]],
    ledger: [[3, "in", 18400, "eft", "Services", "Platform fees, 46 farmers"], [2, "out", 22000, "eft", "Wages", "Staff payroll"], [2, "out", 9000, "eft", "Owner salary", "Director salary"], [1, "in", 12600, "eft", "Services", "Co-op transaction fees"]],
    stock: [],
    suppliers: [],
    profile: { tagline: "Market prices and orders for smallholder farmers, by SMS and app.", services: "Farmer plan: pay per transaction\nCo-op dashboard on quote", whatsapp: "015 555 0190", instagram: "@mabele.agrilink", hours: "Mon–Fri, 8:00–17:00" },
    incubator: { key: "n1", stage: 4, adviser: "L. Dube", log: [{ daysAgo: 60, type: "Market linkage", note: "Introduced to two farmer co-ops." }] },
    activity: [{ daysAgo: 4, text: "Monthly management accounts uploaded by accountant." }],
    pay: { bank: "Standard Bank", accountName: "Mabele AgriLink (Pty) Ltd", accountNumber: "0102 774 553", inBusinessName: true },
  },
  {
    key: "c4", name: "Green Route Waste Services", legalName: "Green Route Waste Services (Pty) Ltd", businessType: "recycling", sector: "Waste management", town: "Randburg", province: "Gauteng", area: "urban",
    stage: "Growth", founded: 2021, founder: { name: "Kabelo S.", email: "kabelo@proofpocket.example" }, employees: 12, cipc: "2021/300145/07", opening: 41000, sharing: "full",
    docs: { cipc: V, id: V, bank: V, addr: V, tax: V, bplan: V, fin: V, bbbee: V, csd: V },
    months: [[62000, 51000], [58500, 49800], [64900, 52300], [67100, 54800], [65400, 55100]],
    ledger: [[5, "in", 24500, "eft", "Services", "Hotel group collections"], [4, "out", 31000, "eft", "Wages", "Bulk payroll"], [4, "out", 1800, "eft", "Airtime and data", "Site data bundles"], [2, "in", 8700, "eft", "Sales", "Baled paper, 2.1 t to recycler"], [1, "out", 12000, "eft", "Owner salary", "Director salary"]],
    stock: [["Baled paper", "tonnes", 1.4, 1, 1200], ["Wheelie bins", "bins", 18, 10, 650]],
    suppliers: [],
    profile: { tagline: "Waste collection, recycling and school awareness programmes.", services: "Commercial collections on contract\nSchool recycling programme\nWaste audits", whatsapp: "011 555 0123", instagram: "@greenroute.waste", hours: "Mon–Sat, 6:00–17:00" },
    incubator: { key: "n2", stage: 4, adviser: "T. Mahlangu", log: [] },
    activity: [{ daysAgo: 2, text: "Weekly bookkeeper review completed." }],
    pay: { bank: "Absa", accountName: "Green Route Waste Services (Pty) Ltd", accountNumber: "4098 112 360", inBusinessName: true },
  },
  {
    key: "c5", name: "Mama Tau Catering", legalName: "Mama Tau Catering (Pty) Ltd", businessType: "food", sector: "Catering", town: "Mamelodi", province: "Gauteng", area: "township",
    stage: "Early", founded: 2023, founder: { name: "Thandi N.", email: "thandi@proofpocket.example" }, employees: 3, cipc: "2023/671290/07", opening: 2300, sharing: "summary",
    docs: { cipc: V, id: V, bank: V, addr: V, tax: "expired", bplan: V },
    months: [[15200, 12900], [9800, 11400], [17600, 13100], [16400, 12800], [11900, 12600]],
    ledger: [[21, "in", 3600, "eft", "Sales", "Funeral catering, 120 plates"], [21, "out", 2100, "cash", "Stock and materials", "Meat and veg"]],
    stock: [["Rice (10 kg bags)", "bags", 2, 3, 165], ["Cooking oil (5 L)", "bottles", 1, 2, 140], ["Takeaway boxes", "packs of 100", 6, 2, 210]],
    suppliers: [],
    profile: { tagline: "Home-style catering for funerals, weddings and offices in Mamelodi.", services: "Plate (pap, meat, 2 salads) R65\nOffice lunch boxes from R55\nEvents on quote", whatsapp: "012 555 0166", instagram: "", hours: "Orders 7 days, 48 hours' notice" },
    incubator: { key: "n2", stage: 0, adviser: null, log: [] },
    activity: [{ daysAgo: 21, text: "Last bookkeeping entry." }],
    pay: { bank: "Capitec", accountName: "Mama Tau Catering (Pty) Ltd", accountNumber: "1530 990 214", inBusinessName: true },
  },
  {
    key: "c6", name: "Khanya Solar Installs", legalName: "Khanya Solar Installs (Pty) Ltd", businessType: "trades", sector: "Solar installation", town: "Mthatha", province: "Eastern Cape", area: "rural",
    stage: "Early", founded: 2023, founder: { name: "Sipho D.", email: "sipho@proofpocket.example" }, employees: 5, cipc: "2023/209914/07", opening: 9800, sharing: "full",
    docs: { cipc: V, id: V, bank: V, addr: V, tax: V, bplan: "pending", csd: V },
    months: [[22000, 19500], [18700, 17900], [26400, 21000], [24800, 20600], [27300, 22400]],
    ledger: [[7, "in", 14500, "eft", "Sales", "Clinic solar geyser install"], [6, "out", 9800, "eft", "Stock and materials", "Panels and inverter"], [5, "out", 900, "cash", "Transport", "Bakkie fuel"]],
    stock: [["Solar panels (450 W)", "panels", 4, 2, 1850], ["Inverters (5 kW)", "units", 1, 1, 9200], ["Mounting kits", "kits", 3, 2, 640]],
    suppliers: [{ name: "SunVolt Wholesale", bank: "FNB ••4821" }],
    profile: { tagline: "Solar geysers and home systems across the OR Tambo district.", services: "Solar geyser install from R14 500\nHome backup systems on quote", whatsapp: "047 555 0158", instagram: "@khanya.solar", hours: "Mon–Sat, 7:00–17:00" },
    incubator: { key: "n1", stage: 2, adviser: "N. Mokoena", log: [{ daysAgo: 9, type: "Business plan", note: "First draft reviewed; projections need supplier quotes." }] },
    activity: [{ daysAgo: 6, text: "Business plan uploaded for checking." }],
    pay: { bank: "FNB", accountName: "Khanya Solar Installs (Pty) Ltd", accountNumber: "6290 551 873", inBusinessName: true },
  },
];

export const INCUBATORS = [
  { key: "n1", name: "Ikhaya Incubation Hub", advisers: [{ name: "N. Mokoena", email: "n.mokoena@proofpocket.example" }, { name: "L. Dube", email: "l.dube@proofpocket.example" }] },
  { key: "n2", name: "Township Futures Trust", advisers: [{ name: "S. Pillay", email: "s.pillay@proofpocket.example" }, { name: "T. Mahlangu", email: "t.mahlangu@proofpocket.example" }] },
];

export interface SeedProgramme { key: string; name: string; min: number; max: number; budget: number; used: number; req: DocType[]; minMonths: number; minScore: number }

export const FUNDERS: { key: string; name: string; kind: string; setup: boolean; user: { name: string; email: string }; programmes: SeedProgramme[] }[] = [
  { key: "f1", name: "Lesedi Youth Fund", kind: "Grant", setup: true, user: { name: "Lesedi Youth Fund team", email: "lesedi@proofpocket.example" }, programmes: [
    { key: "p1", name: "Youth Micro Grant", min: 10000, max: 50000, budget: 1200000, used: 860000, req: ["cipc", "tax", "bank", "bplan"], minMonths: 3, minScore: 40 },
    { key: "p2", name: "Safety & Compliance Grant", min: 5000, max: 20000, budget: 300000, used: 145000, req: ["cipc", "tax", "bank"], minMonths: 0, minScore: 0 }] },
  { key: "f2", name: "Umnotho Seed Partners", kind: "Equity", setup: true, user: { name: "Umnotho Seed Partners team", email: "umnotho@proofpocket.example" }, programmes: [
    { key: "p3", name: "Seed Equity Round", min: 250000, max: 1500000, budget: 6000000, used: 2500000, req: ["cipc", "tax", "bank", "bplan", "fin", "bbbee"], minMonths: 12, minScore: 70 }] },
  { key: "f3", name: "Kopano Enterprise Finance", kind: "Loan", setup: true, user: { name: "Kopano Enterprise Finance team", email: "kopano@proofpocket.example" }, programmes: [
    { key: "p4", name: "Working Capital Loan", min: 20000, max: 150000, budget: 2500000, used: 1100000, req: ["cipc", "tax", "bank", "fin"], minMonths: 6, minScore: 55 }] },
  // Needs first-time set-up.
  { key: "f4", name: "Bophelo Community Fund", kind: "Grant", setup: false, user: { name: "Bophelo Community Fund team", email: "bophelo@proofpocket.example" }, programmes: [] },
];

export const APPLICATIONS = [
  { company: "c2", funder: "f1", programme: "p1", requested: 50000, daysAgo: 40, status: "awaiting_cofunding" as const, statusReason: "",
    offers: [{ amount: 50000, daysAgo: 40, reason: "Published programme amount" }, { amount: 40000, daysAgo: 25, reason: "Application moved to local branch; branch cap is R40 000." }, { amount: 28000, daysAgo: 14, reason: "" }] },
  { company: "c4", funder: "f1", programme: "p2", requested: 15000, daysAgo: 90, status: "approved" as const, statusReason: "Safety file funded; paid to the supplier directly.", offers: [{ amount: 15000, daysAgo: 90, reason: "Requested amount" }] },
  { company: "c4", funder: "f1", programme: "p1", requested: 50000, daysAgo: 60, status: "declined" as const, statusReason: "Programme budget reduced this quarter.", offers: [{ amount: 50000, daysAgo: 60, reason: "Requested amount" }] },
  { company: "c3", funder: "f2", programme: "p3", requested: 900000, daysAgo: 18, status: "under_review" as const, statusReason: "", offers: [{ amount: 900000, daysAgo: 18, reason: "Requested amount" }] },
  { company: "c6", funder: "f3", programme: "p4", requested: 60000, daysAgo: 8, status: "submitted" as const, statusReason: "", offers: [{ amount: 60000, daysAgo: 8, reason: "Requested amount" }] },
];

export const TENDERS: { title: string; buyer: string; value: number; closesIn: number; req: DocType[]; months: number; sectors: string[] }[] = [
  { title: "Waste removal and recycling for 12 schools", buyer: "District education office (example)", value: 480000, closesIn: 18, req: ["tax", "csd", "bbbee"], months: 6, sectors: ["Waste management", "Recycling"] },
  { title: "Staff canteen catering, 6 months", buyer: "Mining company supplier programme (example)", value: 210000, closesIn: 9, req: ["tax", "csd"], months: 6, sectors: ["Catering"] },
  { title: "Solar geysers for a community centre", buyer: "Local municipality (example)", value: 360000, closesIn: 25, req: ["tax", "csd", "bbbee"], months: 6, sectors: ["Solar installation"] },
  { title: "Branded desk organisers, 1 000 units", buyer: "Corporate gifting buyer (example)", value: 65000, closesIn: 12, req: ["tax", "csd"], months: 3, sectors: ["Recycling"] },
  { title: "Nail and lash services for a hotel spa, 3 months", buyer: "Hospitality group (example)", value: 54000, closesIn: 15, req: ["tax"], months: 3, sectors: ["Beauty services"] },
];

export const BUYERS = [
  { name: "Mzansi Fresh Retail Group (example)", kind: "Retail", wants: "Local suppliers for packaging, catering and in-store services.", sectors: ["Catering", "Recycling", "Beauty services"] },
  { name: "Hospitality Collective Joburg (example)", kind: "Hotels and venues", wants: "Waste collection, spa services and event catering.", sectors: ["Waste management", "Beauty services", "Catering"] },
  { name: "Farmer Co-op Network (example)", kind: "Co-operatives", wants: "Digital tools, solar pumps and input supply.", sectors: ["Agritech software", "Solar installation"] },
  { name: "Township Market Days (example)", kind: "Markets and pop-ups", wants: "Stalls for local makers and service providers, monthly.", sectors: ["Beauty services", "Catering", "Recycling"] },
];

export const MESSAGES = [
  { company: "c1", kind: "checked_by_founder" as const, sender: "Funding Approvals Desk", address: "approvals.fund@quickgrantz-mail.com", verified: false, daysAgo: 1,
    body: "Congratulations! Your salon qualifies for R250 000. Pay a R1 500 processing fee today to release the funds.",
    flags: ["Sender is not a verified funder", "Asks for a fee before money is released", "Pressure to act today"] },
  { company: "c1", kind: "organisation" as const, sender: "Ikhaya Incubation Hub", address: "Verified incubator", verified: true, daysAgo: 3, org: "n1",
    body: "Bring your CIPC questions to Thursday's registration session. We'll do the BizPortal steps together.", flags: [] },
  { company: "c2", kind: "organisation" as const, sender: "Lesedi Youth Fund", address: "Verified funder", verified: true, daysAgo: 14, org: "f1",
    body: "We can only process R28 000. Please pay the remaining amount on your supplier quote before we release funds.", flags: [] },
];

export const PAYMENT_REQUESTS: { company: string; ref: string; client: string; amount: number; what: string; rails: Rail[]; daysAgo: number; proof?: { payer: string; amount: number; daysAgo: number; method: Rail; usedRef: boolean; file: string } }[] = [
  { company: "c1", ref: "PP-4790", client: "Naledi", amount: 250, what: "Gel overlay", rails: ["payshap", "eft", "cash"], daysAgo: 2,
    proof: { payer: "Naledi M.", amount: 250, daysAgo: 1, method: "payshap", usedRef: true, file: "payshap-receipt-naledi.jpg" } },
  { company: "c1", ref: "PP-4821", client: "Lerato", amount: 350, what: "Lash fill", rails: ["payshap", "eft", "cash"], daysAgo: 1 },
];

export const POSTS = [
  { company: "c1", text: "Gel overlays this Saturday, R250. Book on WhatsApp.", daysAgo: 5, shared: ["WhatsApp"], feature: "none" as const },
  { company: "c2", text: "New: desk organisers made from 40 recycled bottles each. Corporate orders welcome.", daysAgo: 8, shared: ["WhatsApp", "Facebook"], feature: "featured" as const },
  { company: "c6", text: "Installed a solar geyser at a rural clinic this week. Hot water, even during load-shedding.", daysAgo: 6, shared: ["Facebook"], feature: "featured" as const },
];

/** The prototype's "bank feed" lines for ReKasi, now an imported statement waiting to be sorted. */
export const STATEMENT_LINES = [
  { company: "c2", daysAgo: 1, description: "PAYSHAP CR KHUMALO T", amount: 740, direction: "in" as const },
  { company: "c2", daysAgo: 1, description: "POS PURCHASE BUILDERS ALEX", amount: 315, direction: "out" as const },
];
