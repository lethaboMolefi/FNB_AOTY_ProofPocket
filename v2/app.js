/* ProofPocket prototype v2
   One shared record for founders, funders & investors, incubators & NGOs, and the public.
   Founders move from a Starter account to a Verified account. ProofPocket never holds money:
   payments run on existing rails (bank EFT, PayShap, card machines, cash) and are recorded here.
   All data is example data and stays in this browser. */
(() => {
  "use strict";

  // ================================================================ basics
  const STORE_KEY = "proofpocket-prototype-v2b";
  const DAY = 86400000;
  const TODAY = new Date(); TODAY.setHours(12, 0, 0, 0);
  const iso = (d) => { const z = new Date(d); return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`; };
  const inMonth = (n) => iso(new Date(TODAY.getFullYear(), TODAY.getMonth(), Math.max(1, TODAY.getDate() - n)));
  const daysAgo = (n) => iso(new Date(TODAY.getTime() - n * DAY));
  const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / DAY);
  const MONTHS = Array.from({ length: 6 }, (_, i) => new Date(TODAY.getFullYear(), TODAY.getMonth() - 5 + i, 1).toLocaleString("en-ZA", { month: "short" }));
  const isThisMonth = (d) => { const x = new Date(d + "T12:00:00"); return x.getMonth() === TODAY.getMonth() && x.getFullYear() === TODAY.getFullYear(); };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const R = (n) => (n < 0 ? "−" : "") + "R" + Math.round(Math.abs(n)).toLocaleString("en-ZA");
  const shortDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
  const uid = (p) => p + Math.random().toString(36).slice(2, 8);
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const FP = () => Array.from({ length: 16 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ================================================================ reference data
  const DOCS = {
    cipc:  { name: "CIPC registration certificate", short: "CIPC", join: true, pts: 15 },
    id:    { name: "Owner ID copy", short: "ID", join: true, pts: 5 },
    bank:  { name: "Business bank account confirmation", short: "Bank", join: true, pts: 10 },
    addr:  { name: "Proof of business address", short: "Address", join: true, pts: 0 },
    tax:   { name: "SARS tax registration", short: "Tax", pts: 15 },
    bplan: { name: "Business plan", short: "Plan", pts: 10 },
    fin:   { name: "Management accounts signed by an accountant", short: "Accounts", pts: 15 },
    bbbee: { name: "B-BBEE affidavit", short: "B-BBEE", pts: 0 },
    csd:   { name: "Central Supplier Database registration", short: "CSD", pts: 0 },
  };
  const JOIN_DOCS = ["cipc", "id", "bank", "addr"];
  const DOC_STATE = { verified: ["good", "Verified"], pending: ["warn", "Being checked"], missing: ["bad", "Missing"], expired: ["bad", "Expired"] };
  const START_STEPS = [
    { key: "id", title: "Confirm who you are", how: "Upload a copy of your ID. Only your adviser and the ProofPocket checker see it." },
    { key: "cipc", title: "Register your company with CIPC", how: "Reserve a name and register a private company online on CIPC's BizPortal. Upload the registration certificate you receive." },
    { key: "bank", title: "Open a business bank account", how: "Open an account in the company's name and upload the bank's confirmation letter. Keep personal money out of it from day one." },
    { key: "addr", title: "Show where you trade", how: "Upload a utility bill, a lease, or a letter from your landlord or ward councillor." },
    { key: "tax", title: "Register for tax with SARS", how: "Register the company for income tax on SARS eFiling and upload the registration notice." },
    { key: "bbbee", title: "Get a B-BBEE affidavit", how: "Small businesses can use a sworn affidavit instead of a full B-BBEE certificate. Buyers ask for it." },
    { key: "csd", title: "Register on the Central Supplier Database", how: "Government and many corporates can only pay suppliers registered on the CSD." },
  ];
  const STAGES = ["Assessment", "Adviser assigned", "Service agreement", "Intervention", "Monitoring & evaluation"];
  const SUPPORT_TYPES = ["Business registration help", "Bookkeeping coaching", "Document check", "Tax compliance", "Business plan", "Funding application", "Market linkage", "Procurement readiness"];
  const TYPES = {
    beauty:   { label: "Beauty & personal care", stock: true },
    food:     { label: "Food & catering", stock: true },
    retail:   { label: "Retail & spaza", stock: true },
    recycling:{ label: "Recycling & waste", stock: true },
    trades:   { label: "Trades & installation", stock: true },
    services: { label: "Services & tech", stock: false },
  };
  const IN_CATS = ["Sales", "Services", "Grant received", "Other income"];
  const OUT_CATS = ["Stock and materials", "Wages", "Owner salary", "Transport", "Rent", "Airtime and data", "Equipment", "Collector payments", "Other expense"];
  const METHODS = ["Cash", "Card machine", "Bank EFT", "PayShap", "Mobile wallet"];
  const RAILS = ["PayShap", "Bank EFT", "Cash", "Card machine"];
  const PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"];

  // ================================================================ seed
  const ledgerSeed = (rows) => rows.map(([off, type, amount, method, cat, note, extra]) => ({ id: uid("e"), date: inMonth(off), type, amount, method, cat, note, personal: false, receipt: method !== "Cash", ...(extra || {}) }));
  const docs = (map) => { const d = {}; Object.keys(DOCS).forEach((k) => { d[k] = map[k] || "missing"; }); return d; };
  const stock = (rows) => rows.map(([name, unit, qty, reorder, cost]) => ({ id: uid("s"), name, unit, qty, reorder, cost }));

  function seed() {
    const V = "verified";
    const base = { messages: [], alerts: [], requests: [], inbox: [], interest: [], intros: [], posts: [], suppliers: [], stock: [], consent: { funders: "summary" } };
    const companies = [
      { ...clone(base), id: "c1", name: "Nala Nails & Lashes", type: "beauty", sector: "Beauty services", town: "Soweto", province: "Gauteng", setting: "Township", stage: "Early", founded: 2022, founder: "Zanele M.", employees: 1, reg: "",
        opening: 1400, docs: docs({ id: V, addr: V }),
        months: [[0, 0], [0, 0], [7600, 5600], [8800, 5900], [7900, 6400]],
        ledger: ledgerSeed([[12, "in", 450, "Cash", "Services", "Lash lift"], [11, "in", 380, "Card machine", "Services", "Manicure x2"], [11, "out", 1250, "Bank EFT", "Stock and materials", "Gel polish restock"], [9, "in", 520, "Cash", "Services", "Full set"], [9, "out", 640, "Card machine", "Other expense", "Groceries", { personal: true }], [9, "in", 300, "PayShap", "Services", "Manicure"]]),
        stock: stock([["Gel polish", "bottles", 3, 4, 85], ["Lash glue", "tubes", 1, 2, 120], ["Nail tips", "boxes", 5, 2, 60], ["Acetone", "litres", 2, 1, 45]]),
        suppliers: [{ id: "s1", name: "Glam Supplies", bank: "Capitec ••3310", pending: { bank: "Unknown bank ••9001", date: daysAgo(2) } }],
        profile: { tagline: "Nails and lashes in Soweto, by appointment.", services: "Manicure R150\nGel overlay R250\nLash lift R350", whatsapp: "071 555 0142", instagram: "@nala.nails.soweto", hours: "Tue–Sat, 9:00–18:00" },
        ngo: { id: "n1", stage: 1, adviser: "N. Mokoena", log: [{ date: daysAgo(20), type: "Business registration help", note: "Moved three months of notebook records into ProofPocket. Next: CIPC registration." }] },
        activity: [{ date: daysAgo(24), text: "Joined ProofPocket as a Starter. ID and address checked." }] },
      { ...clone(base), id: "c2", name: "ReKasi Plastics", type: "recycling", sector: "Recycling", town: "Alexandra", province: "Gauteng", setting: "Township", stage: "Early", founded: 2024, founder: "Palesa K.", employees: 4, reg: "2024/102877/07",
        opening: 6200, consent: { funders: "full" },
        docs: docs({ cipc: V, id: V, bank: V, addr: V, tax: V, bplan: V, bbbee: V, csd: "pending" }),
        months: [[6400, 7100], [9800, 8300], [11200, 9100], [14500, 10200], [12900, 11800]],
        ledger: ledgerSeed([[6, "in", 4200, "Bank EFT", "Sales", "300 pencil holders (deposit)"], [5, "out", 780, "Cash", "Collector payments", "PET bottles, 156 kg · slip S20431"], [4, "out", 2400, "Bank EFT", "Equipment", "Shredder blade service"], [3, "out", 620, "Cash", "Collector payments", "HDPE, 98 kg · slip S20457"], [2, "in", 1850, "PayShap", "Sales", "Filament spools x5"]]),
        stock: stock([["PET flakes", "kg", 120, 50, 4], ["Filament spools", "spools", 14, 5, 95]]),
        profile: { tagline: "Township plastic, remade into 3D-printing filament and products.", services: "Filament spool (1 kg) R370\nPencil holder R14 each (min 100)\nCustom recycled products on quote", whatsapp: "072 555 0177", instagram: "@rekasi.plastics", hours: "Mon–Fri, 8:00–16:00" },
        ngo: { id: "n2", stage: 3, adviser: "S. Pillay", log: [{ date: daysAgo(35), type: "Funding application", note: "Helped prepare Youth Micro Grant application." }, { date: daysAgo(12), type: "Bookkeeping coaching", note: "Moved from Excel; cash collector payments now recorded with slip numbers." }] },
        activity: [{ date: daysAgo(14), text: "Lesedi Youth Fund changed the offer to R28 000 (no reason given)." }, { date: daysAgo(40), text: "Applied to Youth Micro Grant for R50 000." }] },
      { ...clone(base), id: "c3", name: "Mabele AgriLink", type: "services", sector: "Agritech software", town: "Polokwane", province: "Limpopo", setting: "Rural", stage: "Growth", founded: 2021, founder: "Tumelo R.", employees: 7, reg: "2021/554019/07",
        opening: 52000, consent: { funders: "full" },
        docs: docs({ cipc: V, id: V, bank: V, addr: V, tax: V, bplan: V, fin: V, bbbee: V, csd: V }),
        months: [[41000, 33500], [38500, 34100], [44200, 35800], [46900, 36200], [48300, 37900]],
        ledger: ledgerSeed([[3, "in", 18400, "Bank EFT", "Services", "Platform fees, 46 farmers"], [2, "out", 22000, "Bank EFT", "Wages", "Staff payroll"], [2, "out", 9000, "Bank EFT", "Owner salary", "Director salary"], [1, "in", 12600, "Bank EFT", "Services", "Co-op transaction fees"]]),
        profile: { tagline: "Market prices and orders for smallholder farmers, by SMS and app.", services: "Farmer plan: pay per transaction\nCo-op dashboard on quote", whatsapp: "015 555 0190", instagram: "@mabele.agrilink", hours: "Mon–Fri, 8:00–17:00" },
        ngo: { id: "n1", stage: 4, adviser: "L. Dube", log: [{ date: daysAgo(60), type: "Market linkage", note: "Introduced to two farmer co-ops." }] },
        activity: [{ date: daysAgo(4), text: "Monthly management accounts uploaded by accountant." }] },
      { ...clone(base), id: "c4", name: "Green Route Waste Services", type: "recycling", sector: "Waste management", town: "Randburg", province: "Gauteng", setting: "Urban", stage: "Growth", founded: 2021, founder: "Kabelo S.", employees: 12, reg: "2021/300145/07",
        opening: 41000, consent: { funders: "full" },
        docs: docs({ cipc: V, id: V, bank: V, addr: V, tax: V, bplan: V, fin: V, bbbee: V, csd: V }),
        months: [[62000, 51000], [58500, 49800], [64900, 52300], [67100, 54800], [65400, 55100]],
        ledger: ledgerSeed([[5, "in", 24500, "Bank EFT", "Services", "Hotel group collections"], [4, "out", 31000, "Bank EFT", "Wages", "Bulk payroll"], [4, "out", 1800, "Bank EFT", "Airtime and data", "Site data bundles"], [2, "in", 8700, "Bank EFT", "Sales", "Baled paper, 2.1 t to recycler"], [1, "out", 12000, "Bank EFT", "Owner salary", "Director salary"]]),
        stock: stock([["Baled paper", "tonnes", 1.4, 1, 1200], ["Wheelie bins", "bins", 18, 10, 650]]),
        profile: { tagline: "Waste collection, recycling and school awareness programmes.", services: "Commercial collections on contract\nSchool recycling programme\nWaste audits", whatsapp: "011 555 0123", instagram: "@greenroute.waste", hours: "Mon–Sat, 6:00–17:00" },
        ngo: { id: "n2", stage: 4, adviser: "T. Mahlangu", log: [] },
        activity: [{ date: daysAgo(2), text: "Weekly bookkeeper review completed." }] },
      { ...clone(base), id: "c5", name: "Mama Tau Catering", type: "food", sector: "Catering", town: "Mamelodi", province: "Gauteng", setting: "Township", stage: "Early", founded: 2023, founder: "Thandi N.", employees: 3, reg: "2023/671290/07",
        opening: 2300, consent: { funders: "summary" },
        docs: docs({ cipc: V, id: V, bank: V, addr: V, tax: "expired", bplan: V }),
        months: [[15200, 12900], [9800, 11400], [17600, 13100], [16400, 12800], [11900, 12600]],
        ledger: ledgerSeed([[21, "in", 3600, "Bank EFT", "Sales", "Funeral catering, 120 plates"], [21, "out", 2100, "Cash", "Stock and materials", "Meat and veg"]]),
        stock: stock([["Rice (10 kg bags)", "bags", 2, 3, 165], ["Cooking oil (5 L)", "bottles", 1, 2, 140], ["Takeaway boxes", "packs of 100", 6, 2, 210]]),
        profile: { tagline: "Home-style catering for funerals, weddings and offices in Mamelodi.", services: "Plate (pap, meat, 2 salads) R65\nOffice lunch boxes from R55\nEvents on quote", whatsapp: "012 555 0166", instagram: "", hours: "Orders 7 days, 48 hours' notice" },
        ngo: { id: "n2", stage: 0, adviser: "", log: [] },
        activity: [{ date: daysAgo(21), text: "Last bookkeeping entry." }] },
      { ...clone(base), id: "c6", name: "Khanya Solar Installs", type: "trades", sector: "Solar installation", town: "Mthatha", province: "Eastern Cape", setting: "Rural", stage: "Early", founded: 2023, founder: "Sipho D.", employees: 5, reg: "2023/209914/07",
        opening: 9800, consent: { funders: "full" },
        docs: docs({ cipc: V, id: V, bank: V, addr: V, tax: V, bplan: "pending", csd: V }),
        months: [[22000, 19500], [18700, 17900], [26400, 21000], [24800, 20600], [27300, 22400]],
        ledger: ledgerSeed([[7, "in", 14500, "Bank EFT", "Sales", "Clinic solar geyser install"], [6, "out", 9800, "Bank EFT", "Stock and materials", "Panels and inverter"], [5, "out", 900, "Cash", "Transport", "Bakkie fuel"]]),
        stock: stock([["Solar panels (450 W)", "panels", 4, 2, 1850], ["Inverters (5 kW)", "units", 1, 1, 9200], ["Mounting kits", "kits", 3, 2, 640]]),
        suppliers: [{ id: "s2", name: "SunVolt Wholesale", bank: "FNB ••4821", pending: null }],
        profile: { tagline: "Solar geysers and home systems across the OR Tambo district.", services: "Solar geyser install from R14 500\nHome backup systems on quote", whatsapp: "047 555 0158", instagram: "@khanya.solar", hours: "Mon–Sat, 7:00–17:00" },
        ngo: { id: "n1", stage: 2, adviser: "N. Mokoena", log: [{ date: daysAgo(9), type: "Business plan", note: "First draft reviewed; projections need supplier quotes." }] },
        activity: [{ date: daysAgo(6), text: "Business plan uploaded for checking." }] },
    ];
    const BANKS = { c1: ["Capitec", "Z. M. (personal account)", "1452 336 871"], c2: ["FNB", "ReKasi Plastics (Pty) Ltd", "6281 004 517"], c3: ["Standard Bank", "Mabele AgriLink (Pty) Ltd", "0102 774 553"], c4: ["Absa", "Green Route Waste Services (Pty) Ltd", "4098 112 360"], c5: ["Capitec", "Mama Tau Catering (Pty) Ltd", "1530 990 214"], c6: ["FNB", "Khanya Solar Installs (Pty) Ltd", "6290 551 873"] };
    companies.forEach((c) => { c.fp = {}; c.files = {}; Object.keys(c.docs).forEach((k) => { if (c.docs[k] !== "missing") c.fp[k] = FP(); }); const b = BANKS[c.id]; c.pay = { bank: b[0], accName: b[1], accNo: b[2], shapId: c.profile.whatsapp }; });
    const by = Object.fromEntries(companies.map((c) => [c.id, c]));
    by.c1.messages.push(
      { id: "m1", from: "Funding Approvals Desk", address: "approvals.fund@quickgrantz-mail.com", verified: false, date: daysAgo(1), text: "Congratulations! Your salon qualifies for R250 000. Pay a R1 500 processing fee today to release the funds.", flags: ["Sender is not a verified funder", "Asks for a fee before money is released", "Pressure to act today"], status: "open" },
      { id: "m2", from: "Ikhaya Incubation Hub", address: "Verified incubator", verified: true, date: daysAgo(3), text: "Bring your CIPC questions to Thursday's registration session. We'll do the BizPortal steps together.", flags: [], status: "open" });
    by.c1.requests.push(
      { ref: "PP-4790", client: "Naledi", amount: 250, what: "Gel overlay", rails: ["PayShap", "Bank EFT", "Cash"], date: daysAgo(2), status: "Checking", attempts: 0,
        pop: { payer: "Naledi M.", amount: 250, date: daysAgo(1), method: "PayShap", usedRef: true, file: "payshap-receipt-naledi.jpg", fp: FP(), at: daysAgo(1) } },
      { ref: "PP-4821", client: "Lerato", amount: 350, what: "Lash fill", rails: ["PayShap", "Bank EFT", "Cash"], date: daysAgo(1), status: "Waiting", attempts: 0 });
    by.c1.posts.push({ id: "po1", text: "Gel overlays this Saturday, R250. Book on WhatsApp.", date: daysAgo(5), shared: ["WhatsApp"], feature: "none" });
    by.c2.messages.push({ id: "m3", from: "Lesedi Youth Fund", address: "Verified funder", verified: true, date: daysAgo(14), text: "We can only process R28 000. Please pay the remaining amount on your supplier quote before we release funds.", flags: [], status: "open" });
    by.c2.posts.push({ id: "po2", text: "New: desk organisers made from 40 recycled bottles each. Corporate orders welcome.", date: daysAgo(8), shared: ["WhatsApp", "Facebook"], feature: "featured" });
    by.c6.posts.push({ id: "po3", text: "Installed a solar geyser at a rural clinic this week. Hot water, even during load-shedding.", date: daysAgo(6), shared: ["Facebook"], feature: "featured" });
    by.c2.inbox.push({ id: "i1", date: daysAgo(1), desc: "PAYSHAP CR KHUMALO T", amount: 740, type: "in" }, { id: "i2", date: daysAgo(1), desc: "POS PURCHASE BUILDERS ALEX", amount: 315, type: "out" });

    const funders = [
      { id: "f1", name: "Lesedi Youth Fund", kind: "Grant", verified: true, setup: true, programmes: [
        { id: "p1", name: "Youth Micro Grant", min: 10000, max: 50000, budget: 1200000, used: 860000, req: ["cipc", "tax", "bank", "bplan"], minMonths: 3, minScore: 40 },
        { id: "p2", name: "Safety & Compliance Grant", min: 5000, max: 20000, budget: 300000, used: 145000, req: ["cipc", "tax", "bank"], minMonths: 0, minScore: 0 } ] },
      { id: "f2", name: "Umnotho Seed Partners", kind: "Equity", verified: true, setup: true, programmes: [
        { id: "p3", name: "Seed Equity Round", min: 250000, max: 1500000, budget: 6000000, used: 2500000, req: ["cipc", "tax", "bank", "bplan", "fin", "bbbee"], minMonths: 12, minScore: 70 } ] },
      { id: "f3", name: "Kopano Enterprise Finance", kind: "Loan", verified: true, setup: true, programmes: [
        { id: "p4", name: "Working Capital Loan", min: 20000, max: 150000, budget: 2500000, used: 1100000, req: ["cipc", "tax", "bank", "fin"], minMonths: 6, minScore: 55 } ] },
      { id: "f4", name: "Bophelo Community Fund (new)", kind: "Grant", verified: true, setup: false, programmes: [] },
    ];
    const ngos = [
      { id: "n1", name: "Ikhaya Incubation Hub", advisers: ["N. Mokoena", "L. Dube"] },
      { id: "n2", name: "Township Futures Trust", advisers: ["S. Pillay", "T. Mahlangu"] },
    ];
    const apps = [
      { id: "ap1", companyId: "c2", funderId: "f1", programmeId: "p1", requested: 50000, date: daysAgo(40), status: "Awaiting co-funding", statusReason: "",
        offers: [{ amount: 50000, date: daysAgo(40), reason: "Published programme amount" }, { amount: 40000, date: daysAgo(25), reason: "Application moved to local branch; branch cap is R40 000." }, { amount: 28000, date: daysAgo(14), reason: "" }] },
      { id: "ap2", companyId: "c4", funderId: "f1", programmeId: "p2", requested: 15000, date: daysAgo(90), status: "Approved", statusReason: "Safety file funded; paid to the supplier directly.", offers: [{ amount: 15000, date: daysAgo(90), reason: "Requested amount" }] },
      { id: "ap3", companyId: "c4", funderId: "f1", programmeId: "p1", requested: 50000, date: daysAgo(60), status: "Declined", statusReason: "Programme budget reduced this quarter.", offers: [{ amount: 50000, date: daysAgo(60), reason: "Requested amount" }] },
      { id: "ap4", companyId: "c3", funderId: "f2", programmeId: "p3", requested: 900000, date: daysAgo(18), status: "Under review", statusReason: "", offers: [{ amount: 900000, date: daysAgo(18), reason: "Requested amount" }] },
      { id: "ap5", companyId: "c6", funderId: "f3", programmeId: "p4", requested: 60000, date: daysAgo(8), status: "Submitted", statusReason: "", offers: [{ amount: 60000, date: daysAgo(8), reason: "Requested amount" }] },
    ];
    const tenders = [
      { id: "t1", title: "Waste removal and recycling for 12 schools", buyer: "District education office (example)", value: 480000, closes: daysAgo(-18), req: ["tax", "csd", "bbbee"], months: 6, sectors: ["Waste management", "Recycling"] },
      { id: "t2", title: "Staff canteen catering, 6 months", buyer: "Mining company supplier programme (example)", value: 210000, closes: daysAgo(-9), req: ["tax", "csd"], months: 6, sectors: ["Catering"] },
      { id: "t3", title: "Solar geysers for a community centre", buyer: "Local municipality (example)", value: 360000, closes: daysAgo(-25), req: ["tax", "csd", "bbbee"], months: 6, sectors: ["Solar installation"] },
      { id: "t4", title: "Branded desk organisers, 1 000 units", buyer: "Corporate gifting buyer (example)", value: 65000, closes: daysAgo(-12), req: ["tax", "csd"], months: 3, sectors: ["Recycling"] },
      { id: "t5", title: "Nail and lash services for a hotel spa, 3 months", buyer: "Hospitality group (example)", value: 54000, closes: daysAgo(-15), req: ["tax"], months: 3, sectors: ["Beauty services"] },
    ];
    const buyers = [
      { id: "b1", name: "Mzansi Fresh Retail Group (example)", kind: "Retail", wants: "Local suppliers for packaging, catering and in-store services.", sectors: ["Catering", "Recycling", "Beauty services"] },
      { id: "b2", name: "Hospitality Collective Joburg (example)", kind: "Hotels and venues", wants: "Waste collection, spa services and event catering.", sectors: ["Waste management", "Beauty services", "Catering"] },
      { id: "b3", name: "Farmer Co-op Network (example)", kind: "Co-operatives", wants: "Digital tools, solar pumps and input supply.", sectors: ["Agritech software", "Solar installation"] },
      { id: "b4", name: "Township Market Days (example)", kind: "Markets and pop-ups", wants: "Stalls for local makers and service providers, monthly.", sectors: ["Beauty services", "Catering", "Recycling"] },
    ];
    return { companies, funders, ngos, apps, tenders, buyers, reports: [] };
  }

  // ================================================================ state
  let data;
  const freshJoin = () => ({ step: 1, err: "", agree: false, d: { founder: "", name: "", type: "beauty", town: "", province: "Gauteng", setting: "Township", ngo: "", registered: "no", legal: "", reg: "" }, files: {} });
  const ui = {
    role: "founder",
    view: { founder: "home", funder: "pipeline", ngo: "cohort", directory: "browse", join: "start" },
    me: { founder: "c1", funder: "f1", ngo: "n1" },
    drawer: null, pay: null, entryType: "in", entryWarn: "",
    filter: { q: "", sector: "", setting: "", min: 0 },
    dir: { q: "", sector: "" },
    join: freshJoin(),
  };
  function load() {
    try { const raw = localStorage.getItem(STORE_KEY); if (raw) { const s = JSON.parse(raw); if (s && s.data && s.data.companies) { data = s.data; Object.assign(ui.me, s.me || {}); return; } } } catch (e) { /* storage unavailable */ }
    data = seed();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify({ data, me: ui.me })); } catch (e) { /* ignore */ } }

  const company = (id) => data.companies.find((c) => c.id === id);
  const funder = (id) => data.funders.find((f) => f.id === id);
  const ngo = (id) => data.ngos.find((n) => n.id === id);
  const programme = (pid) => { for (const f of data.funders) { const p = f.programmes.find((x) => x.id === pid); if (p) return { f, p }; } return null; };
  const addActivity = (c, text) => { c.activity.unshift({ date: iso(TODAY), text }); };

  // ================================================================ derived
  const isVerified = (c) => JOIN_DOCS.every((k) => c.docs[k] === "verified");
  const monthTotals = (c) => {
    const cur = c.ledger.filter((e) => isThisMonth(e.date));
    const inc = cur.filter((e) => e.type === "in").reduce((s, e) => s + e.amount, 0);
    const exp = cur.filter((e) => e.type === "out").reduce((s, e) => s + e.amount, 0);
    return { inc, exp, profit: inc - exp };
  };
  const series = (c) => { const t = monthTotals(c); return c.months.map(([inc, exp], i) => ({ label: MONTHS[i], inc, exp })).concat([{ label: MONTHS[5] + "*", inc: t.inc, exp: t.exp }]); };
  const recordMonths = (c) => c.months.filter(([inc, exp]) => inc + exp > 0).length + (c.ledger.some((e) => isThisMonth(e.date)) ? 1 : 0);
  const lastEntryDays = (c) => { if (!c.ledger.length) return Infinity; const last = c.ledger.map((e) => e.date).sort().pop(); return Math.max(0, daysBetween(last, iso(TODAY))); };
  const cashNow = (c) => c.opening + monthTotals(c).profit;
  const avg = (c) => { const m = c.months.filter(([i, e]) => i + e > 0); if (!m.length) return { inc: 0, exp: 0 }; return { inc: m.reduce((s, x) => s + x[0], 0) / m.length, exp: m.reduce((s, x) => s + x[1], 0) / m.length }; };
  const lowStock = (c) => c.stock.filter((s) => s.qty <= s.reorder);

  function readiness(c) {
    const items = [];
    ["cipc", "id", "bank", "tax", "bplan", "fin"].forEach((k) => {
      const st = c.docs[k];
      items.push({ group: "Documents", key: k, label: DOCS[k].name, pts: DOCS[k].pts, ok: st === "verified", state: st, hint: st === "pending" ? "Uploaded, being checked" : st === "expired" ? "Expired, upload a current one" : st === "missing" ? "Not uploaded yet" : "Verified" });
    });
    const last = lastEntryDays(c);
    items.push({ group: "Bookkeeping", label: "Books updated in the last 7 days", pts: 10, ok: last <= 7, hint: last === Infinity ? "No entries yet" : `Last entry ${last} day${last === 1 ? "" : "s"} ago` });
    const personal = c.ledger.filter((e) => e.personal).length;
    items.push({ group: "Bookkeeping", label: "Personal and business money kept separate", pts: 10, ok: personal === 0, hint: personal ? `${personal} personal purchase${personal > 1 ? "s" : ""} paid from the business` : "No personal spending found" });
    const paysSelf = c.ledger.some((e) => e.cat === "Owner salary");
    items.push({ group: "Bookkeeping", label: "Owner pays themselves a set salary", pts: 5, ok: paysSelf, hint: paysSelf ? "Owner salary recorded" : "Funders read a set owner salary as a sign of professionalism" });
    const rm = recordMonths(c);
    items.push({ group: "Bookkeeping", label: "Six months of records", pts: 5, ok: rm >= 6, hint: `${rm} month${rm === 1 ? "" : "s"} on record` });
    return { score: items.reduce((s, i) => s + (i.ok ? i.pts : 0), 0), items };
  }
  function flags(c) {
    const f = [];
    if (!isVerified(c)) f.push({ level: "warn", text: "Starter account, not yet verified" });
    Object.keys(c.docs).filter((k) => c.docs[k] === "expired").forEach((k) => f.push({ level: "bad", text: `${DOCS[k].name} expired` }));
    const pend = Object.keys(c.docs).filter((k) => c.docs[k] === "pending").length;
    if (pend) f.push({ level: "warn", text: `${pend} document${pend > 1 ? "s" : ""} waiting for a check` });
    const last = lastEntryDays(c);
    if (last > 14) f.push({ level: "bad", text: last === Infinity ? "No bookkeeping entries" : `Books not updated for ${last} days` });
    if (c.ledger.some((e) => e.personal)) f.push({ level: "warn", text: "Personal spending from business money" });
    const [a, b] = [c.months[3][0], c.months[4][0]];
    if (a > 0 && (a - b) / a > 0.2) f.push({ level: "warn", text: `Income fell ${Math.round(((a - b) / a) * 100)}% last month` });
    const pc = c.requests.filter((r) => r.status === "Checking").length; if (pc) f.push({ level: "warn", text: `${pc} proof${pc > 1 ? "s" : ""} of payment to check` });
    const ls = lowStock(c).length; if (ls) f.push({ level: "warn", text: `${ls} stock item${ls > 1 ? "s" : ""} running low` });
    const scam = c.messages.filter((m) => !m.verified && m.status === "open").length + c.suppliers.filter((s) => s.pending).length;
    if (scam) f.push({ level: "bad", text: `${scam} fraud warning${scam > 1 ? "s" : ""} open` });
    if (data.apps.some((x) => x.companyId === c.id && x.offers.length > 1 && !x.offers[x.offers.length - 1].reason)) f.push({ level: "warn", text: "Funding offer changed with no reason given" });
    return f;
  }
  const verifiedCount = (c) => Object.values(c.docs).filter((s) => s === "verified").length;
  const missingFor = (c, req) => req.filter((k) => c.docs[k] !== "verified");
  function progCheck(c, p) {
    const gaps = missingFor(c, p.req).map((k) => DOCS[k].short), rm = recordMonths(c), sc = readiness(c).score;
    if (rm < (p.minMonths || 0)) gaps.push(`${p.minMonths} months of records (you have ${rm})`);
    if (sc < (p.minScore || 0)) gaps.push(`score ${p.minScore}+ (you have ${sc})`);
    if (!isVerified(c)) gaps.unshift("Verified account");
    return gaps;
  }
  const funderVisible = (c) => isVerified(c) && c.consent.funders !== "none";

  // ================================================================ small render helpers
  const pill = (cls, text) => `<span class="pill ${cls}">${esc(text)}</span>`;
  const docPill = (st) => pill(DOC_STATE[st][0], DOC_STATE[st][1]);
  const scoreClass = (s) => (s >= 70 ? "good" : s >= 45 ? "warn" : "bad");
  const scoreLabel = (s) => (s >= 70 ? "Funding ready" : s >= 45 ? "Getting there" : "Early");
  const levelPill = (c) => isVerified(c) ? pill("good", "Verified") : pill("warn", "Starter");
  function ring(score, small) {
    const size = small ? 44 : 108, sw = small ? 5 : 9, r = (size - sw) / 2, cc = 2 * Math.PI * r;
    return `<div class="ring${small ? " sm" : ""}" role="img" aria-label="Readiness ${score} out of 100"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}"/><circle class="val" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${cc}" stroke-dashoffset="${cc * (1 - score / 100)}"/></svg><div class="txt"><div><b>${score}</b>${small ? "" : '<span class="small muted">of 100</span>'}</div></div></div>`;
  }
  const scoreCell = (s) => `<div class="score-cell"><span class="num">${s}</span><div class="bar"><i style="width:${s}%"></i></div></div>`;
  function niceMax(v) { if (v <= 0) return 1000; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; }
  function barChart(s) {
    const W = 600, H = 220, L = 52, B = 26, T = 10, Rr = 8;
    const max = niceMax(Math.max(...s.map((m) => Math.max(m.inc, m.exp))));
    const ih = H - B - T, iw = W - L - Rr, gw = iw / s.length, bw = Math.min(26, gw / 3), y = (v) => T + ih - (v / max) * ih;
    let g = "";
    for (let i = 0; i <= 4; i++) { const v = (max / 4) * i; g += `<line class="grid-l" x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 8}" y="${y(v) + 3}" text-anchor="end">${v >= 1000 ? +(v / 1000).toFixed(1) + "k" : v}</text>`; }
    s.forEach((m, i) => {
      const cx = L + gw * i + gw / 2;
      g += `<rect class="b-in" x="${cx - bw - 1}" y="${y(m.inc)}" width="${bw}" height="${Math.max(0, T + ih - y(m.inc))}" rx="2"><title>${m.label} money in ${R(m.inc)}</title></rect><rect class="b-out" x="${cx + 1}" y="${y(m.exp)}" width="${bw}" height="${Math.max(0, T + ih - y(m.exp))}" rx="2"><title>${m.label} money out ${R(m.exp)}</title></rect><text class="axis" x="${cx}" y="${H - 8}" text-anchor="middle">${esc(m.label)}</text>`;
    });
    return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Money in and out, last six months">${g}</svg></div><div class="row between"><div class="legend"><span><i style="background:var(--bar-in)"></i>Money in</span><span><i style="background:var(--bar-out)"></i>Money out</span></div><span class="small muted">* this month so far · Rand</span></div>`;
  }
  function spark(c) {
    const s = series(c).slice(0, 5).map((m) => m.inc), max = Math.max(...s), min = Math.min(...s), W = 84, H = 24;
    const pts = s.map((v, i) => [2 + (i * (W - 4)) / (s.length - 1), H - 3 - ((v - min) / (max - min || 1)) * (H - 6)]), last = pts[pts.length - 1];
    return `<svg class="spark" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts.map((p) => p.join(",")).join(" ")}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.5"/></svg>`;
  }
  function checklist(items) {
    return `<div class="checklist">${items.map((i) => { const cls = i.ok ? "ok" : i.state === "pending" ? "wait" : "no"; const sym = i.ok ? "✓" : i.state === "pending" ? "…" : "×";
      return `<div class="ck"><span class="mark ${cls}" aria-hidden="true">${sym}</span><div><div>${esc(i.label)}</div><div class="hint">${esc(i.hint)}</div></div><span class="pts">${i.ok ? "+" + i.pts : "0"}/${i.pts}</span></div>`; }).join("")}</div>`;
  }
  const timeline = (list) => list.length ? `<div class="timeline">${list.slice(0, 8).map((a) => `<div class="tl"><span class="when">${shortDate(a.date)}</span><span>${esc(a.text)}</span></div>`).join("")}</div>` : `<p class="muted small">No activity yet.</p>`;
  const steps = (stage) => `<div class="steps">${STAGES.map((s, i) => `<span class="step ${i < stage ? "done" : i === stage ? "now" : ""}">${esc(s)}</span>`).join("")}</div>`;
  const offerHistory = (ap) => `<div class="timeline">${ap.offers.map((o, i) => `<div class="tl"><span class="when">${shortDate(o.date)}</span><span><b class="num">${R(o.amount)}</b>${i ? " · " : " "}${o.reason ? esc(o.reason) : '<span style="color:var(--bad);font-weight:600">No reason given</span>'}</span></div>`).join("")}</div>`;
  const statusPill = (st) => pill({ Approved: "good", Declined: "bad", "Awaiting co-funding": "warn", "Offer made": "info", "Under review": "info", Submitted: "plain" }[st] || "plain", st);
  const lock = (title, why, action) => `<div class="notice warn"><span class="ico">!</span><div><b>${esc(title)}</b><div class="small">${why}</div></div>${action || ""}</div>`;
  const profileUrl = (c) => `proofpocket.co.za/b/${slug(c.name)}`;
  const shareText = (c, text) => `${text}\n\n${c.name} · ${isVerified(c) ? "Verified on ProofPocket" : "On ProofPocket"}: https://${profileUrl(c)}`;
  function uploadBtn(k, label, kind) {
    return `<label class="btn sm${label === "Upload" ? " primary" : ""}" style="position:relative;display:inline-flex">${label}<input type="file" data-change="${kind || "docfile"}" data-doc="${k}" accept=".pdf,image/*" aria-label="${esc(label)} ${esc(DOCS[k].name)}" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%"></label>`;
  }

  // ================================================================ top bar + rail
  const RAIL = {
    founder: [["", [["home", "Home"]]], ["Start", [["start", "Registration steps"]]], ["Trade", [["books", "Bookkeeping"], ["stock", "Stock"]]], ["Get paid", [["payments", "Payments"]]], ["Manage cash flow", [["cashflow", "Cash flow"]]], ["Reach formal markets", [["markets", "Profile & marketing"], ["funding", "Funding readiness"], ["procurement", "Procurement"]]], ["Stay safe", [["protection", "Fraud protection"], ["privacy", "Privacy & sharing"]]]],
    funder: [["", [["pipeline", "Company pipeline"], ["applications", "Applications"], ["programmes", "Programmes & requirements"]]]],
    ngo: [["", [["cohort", "Cohort board"], ["verify", "Document checks"], ["attention", "Needs attention"], ["support", "Support log"]]]],
    directory: [["", [["browse", "Verified businesses"]]]],
    join: [["", [["start", "Join ProofPocket"]]]],
  };
  function renderTop() {
    document.querySelectorAll(".roles button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.role === ui.role)));
    const who = document.getElementById("who");
    const opt = (list, cur, lab) => list.map((x) => `<option value="${x.id}"${x.id === cur ? " selected" : ""}>${esc(lab ? lab(x) : x.name)}</option>`).join("");
    if (ui.role === "founder") who.innerHTML = `<label class="muted" for="who-sel">Viewing as</label><select id="who-sel" data-change="who" data-kind="founder">${opt(data.companies, ui.me.founder, (c) => `${c.name} (${isVerified(c) ? "Verified" : "Starter"})`)}</select>`;
    else if (ui.role === "funder") who.innerHTML = `<label class="muted" for="who-sel">Signed in as</label><select id="who-sel" data-change="who" data-kind="funder">${opt(data.funders, ui.me.funder)}</select>`;
    else if (ui.role === "ngo") who.innerHTML = `<label class="muted" for="who-sel">Signed in as</label><select id="who-sel" data-change="who" data-kind="ngo">${opt(data.ngos, ui.me.ngo)}</select>`;
    else who.innerHTML = ui.role === "directory" ? `<span class="muted small">Public page. Anyone can open it.</span>` : "";
  }
  function renderRail() {
    const cur = ui.view[ui.role], counts = {};
    if (ui.role === "founder") {
      const c = company(ui.me.founder);
      counts.protection = c.messages.filter((m) => !m.verified && m.status === "open").length + c.suppliers.filter((s) => s.pending).length;
      counts.start = isVerified(c) ? 0 : JOIN_DOCS.filter((k) => c.docs[k] !== "verified").length;
      counts.stock = lowStock(c).length;
      counts.payments = c.requests.filter((r) => r.status === "Checking").length;
    }
    if (ui.role === "ngo") { counts.verify = verifyQueue().length; counts.attention = cohort().reduce((s, c) => s + flags(c).filter((f) => f.level === "bad").length, 0); }
    if (ui.role === "funder") counts.applications = data.apps.filter((a) => a.funderId === ui.me.funder && ["Submitted", "Under review"].includes(a.status)).length;
    const hideStock = ui.role === "founder" && !TYPES[company(ui.me.founder).type].stock;
    const titles = { founder: "Your business", funder: "Funder portal", ngo: "Support portal", directory: "Public directory", join: "Join" };
    document.getElementById("rail").innerHTML = `<div class="rail-title label">${titles[ui.role]}</div>` +
      RAIL[ui.role].map(([g, items]) => (g ? `<div class="rail-group">${esc(g)}</div>` : "") + items.filter(([k]) => !(k === "stock" && hideStock)).map(([k, t]) => `<button type="button" data-action="nav" data-view="${k}"${k === cur ? ' aria-current="page"' : ""}><span>${t}</span>${counts[k] ? `<span class="count">${counts[k]}</span>` : ""}</button>`).join("")).join("") +
      `<div class="rail-foot"><span class="hint">Example data. Changes stay in this browser. ProofPocket never holds money.</span><button type="button" class="btn sm" data-action="reset">Reset example data</button></div>`;
  }

  // ================================================================ founder views
  const fHead = (c, title, sub) => `<div class="page-head"><div><div class="label">${esc(c.name)} · ${esc(c.town)}, ${esc(c.province)}</div><h1>${esc(title)}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div><div>${levelPill(c)}</div></div>`;
  function journey(c) {
    const t = monthTotals(c), rm = recordMonths(c);
    const st = [
      ["Start", isVerified(c) ? "Verified business" : `${JOIN_DOCS.filter((k) => c.docs[k] === "verified").length} of 4 joining steps done`, isVerified(c), "start"],
      ["Trade", `${c.ledger.filter((e) => isThisMonth(e.date)).length} entries this month`, lastEntryDays(c) <= 7, "books"],
      ["Get paid", `${c.requests.filter((r) => r.status === "Waiting").length} payment requests open`, c.ledger.some((e) => e.method !== "Cash" && e.type === "in"), "payments"],
      ["Manage cash flow", `${R(cashNow(c))} on hand`, t.profit >= 0 && !c.ledger.some((e) => e.personal), "cashflow"],
      ["Reach formal markets", rm >= 6 ? "6-month track record" : `${rm} of 6 months of track record`, rm >= 6 && isVerified(c), "markets"],
    ];
    return `<div class="journey">${st.map(([h, d, ok, v], i) => `<button type="button" class="jstep ${ok ? "ok" : ""}" data-action="nav" data-view="${v}"><span class="jn">${ok ? "✓" : i + 1}</span><span class="jt"><b>${h}</b><span class="hint">${esc(d)}</span></span></button>`).join("")}</div>`;
  }
  function vHome(c) {
    const t = monthTotals(c), r = readiness(c), fl = flags(c);
    const todo = r.items.filter((i) => !i.ok).sort((a, b) => b.pts - a.pts).slice(0, 4);
    const fraudOpen = c.messages.filter((m) => !m.verified && m.status === "open").length + c.suppliers.filter((s) => s.pending).length;
    return `${fHead(c, "Home", `${esc(TYPES[c.type].label)} · ${esc(c.setting)} · ${c.employees} ${c.employees === 1 ? "person" : "people"} · trading since ${c.founded}`)}
      ${!isVerified(c) ? `<div class="notice info"><span class="ico">i</span><div><b>You're on a Starter account.</b> <span class="small">You can keep books, take payments and build your profile now. Finish the registration steps to get verified, so funders and buyers can find you.</span></div><button class="btn sm primary" data-action="nav" data-view="start" style="margin-left:auto">Continue</button></div>` : ""}
      ${c.requests.some((r) => r.status === "Checking") ? `<div class="notice warn"><span class="ico">R</span><div><b>${c.requests.filter((r) => r.status === "Checking").length} client${c.requests.filter((r) => r.status === "Checking").length > 1 ? "s say they have" : " says they have"} paid.</b> <span class="small">Check your banking app, then confirm so it goes into your books.</span></div><button class="btn sm" data-action="nav" data-view="payments" style="margin-left:auto">Check</button></div>` : ""}
      ${fraudOpen ? `<div class="notice bad"><span class="ico">!</span><div><b>${fraudOpen} possible scam${fraudOpen > 1 ? "s" : ""} need your attention.</b> <span class="small">Check before you pay anyone.</span></div><button class="btn sm" data-action="nav" data-view="protection" style="margin-left:auto">Review</button></div>` : ""}
      ${journey(c)}
      <div class="grid g4">
        <div class="panel stat"><span class="label">Money in this month</span><span class="v in">${R(t.inc)}</span></div>
        <div class="panel stat"><span class="label">Money out this month</span><span class="v">${R(t.exp)}</span></div>
        <div class="panel stat"><span class="label">Cash on hand</span><span class="v">${R(cashNow(c))}</span><span class="d muted small">Bank and cash together</span></div>
        <div class="panel stat"><span class="label">Funding readiness</span><span class="v">${r.score}<span class="small muted"> / 100</span></span><span class="d">${pill(scoreClass(r.score), scoreLabel(r.score))}</span></div>
      </div>
      <div class="grid g3">
        <div class="panel span2"><div class="panel-head"><h2>Six months at a glance</h2><button class="btn sm" data-action="nav" data-view="cashflow">Cash flow</button></div>${barChart(series(c))}</div>
        <div class="panel"><h2>Next steps</h2>${todo.length ? `<div class="list">${todo.map((i) => `<div class="li"><div class="li-main"><span>${esc(i.label)}</span><span class="hint">${esc(i.hint)} · worth ${i.pts} points</span></div><div class="li-side"><button class="btn sm" data-action="nav" data-view="${i.group === "Documents" ? "start" : "books"}">Fix</button></div></div>`).join("")}</div>` : `<p class="muted">Everything funders check is in place.</p>`}</div>
      </div>
      <div class="grid g2">
        <div class="panel"><h2>Things to watch</h2>${fl.length ? `<div class="list">${fl.map((f) => `<div class="li"><span>${esc(f.text)}</span>${pill(f.level, f.level === "bad" ? "Act now" : "Check")}</div>`).join("")}</div>` : `<p class="muted">Nothing needs attention.</p>`}</div>
        <div class="panel"><h2>Messages</h2>${c.messages.length ? `<div class="list">${c.messages.slice(0, 4).map((m) => `<div class="li"><div class="li-main"><span><b>${esc(m.from)}</b> ${m.verified ? pill("good", "Verified") : pill("bad", "Not verified")}</span><span class="small">${esc(m.text)}</span></div></div>`).join("")}</div>` : `<p class="muted">No messages.</p>`}</div>
      </div>`;
  }
  function vStart(c) {
    const n = ngo(c.ngo.id), ver = isVerified(c);
    return `${fHead(c, "Registration steps", "Everything a business needs to trade formally, one step at a time. The first four make you a Verified business; the rest open tenders and bigger funding.")}
      <div class="notice ${ver ? "good" : "info"}"><span class="ico">${ver ? "✓" : "i"}</span><div class="small">${ver ? `<b>Verified.</b> Funders, buyers and the public directory can now see your business${c.reg ? ` (CIPC ${esc(c.reg)})` : ""}.` : `<b>Who checks your documents?</b> ${n ? `Your adviser at ${esc(n.name)} checks each upload, usually within two working days.` : "A ProofPocket checker reviews each upload."} Each file gets a fingerprint so it can't be swapped later.`}</div></div>
      ${!c.reg ? `<form class="panel row" data-form="cipcno" novalidate style="align-items:end"><label class="field" style="flex:1;min-width:200px"><span>Registered with CIPC already? Enter your number</span><input id="cipc-no" name="reg" type="text" class="mono" placeholder="2026/123456/07"></label><button class="btn" type="submit">Save number</button></form>` : ""}
      <div class="stack">${START_STEPS.map((s, i) => { const st = c.docs[s.key], join = JOIN_DOCS.includes(s.key);
        return `<div class="panel startstep ${st === "verified" ? "done" : ""}"><span class="sn">${st === "verified" ? "✓" : i + 1}</span><div class="li-main"><div class="row" style="gap:8px"><h3>${esc(s.title)}</h3>${join ? pill("info", "Needed to verify") : pill("plain", s.key === "tax" ? "Needed for funding" : "Needed for tenders")}</div><p class="small muted">${esc(s.how)}</p>${c.fp[s.key] ? `<span class="fp">${c.files[s.key] ? esc(c.files[s.key]) + " · " : ""}fingerprint ${esc(c.fp[s.key])}</span>` : ""}</div>
          <div class="li-side">${docPill(st)}${st === "verified" || st === "pending" ? "" : uploadBtn(s.key, st === "missing" ? "Upload" : "Replace")}</div></div>`; }).join("")}</div>
      <div class="panel"><h2>Other documents funders ask for</h2><div class="list">${["bplan", "fin"].map((k) => `<div class="li"><div class="li-main"><span>${esc(DOCS[k].name)}</span><span class="hint">${k === "fin" ? "Your ProofPocket books can be handed to an accountant to prepare and sign these." : "Your adviser can help you write one."}</span></div><div class="li-side">${docPill(c.docs[k])}${c.docs[k] !== "verified" && c.docs[k] !== "pending" ? uploadBtn(k, "Upload") : ""}</div></div>`).join("")}</div></div>`;
  }
  function vBooks(c) {
    const cur = c.ledger.filter((e) => isThisMonth(e.date)).sort((a, b) => (a.date < b.date ? 1 : -1));
    const t = monthTotals(c), cats = ui.entryType === "in" ? IN_CATS : OUT_CATS, useStock = TYPES[c.type].stock && c.stock.length;
    return `${fHead(c, "Bookkeeping", "Record every sale and expense here, including cash. ProofPocket works out your profit and keeps the records funders ask for.")}
      ${c.inbox.length ? `<div class="panel"><div class="panel-head"><h2>From your bank feed</h2><span class="hint">Sort these into your books</span></div><div class="list">${c.inbox.map((x) => `<div class="li"><div class="li-main"><span class="mono small">${esc(x.desc)}</span><span class="hint">${shortDate(x.date)}</span></div><div class="li-side"><span class="num ${x.type === "in" ? "in" : ""}">${x.type === "in" ? "+" : "−"}${R(x.amount)}</span><div class="row" style="gap:6px"><select id="inbox-cat-${x.id}" aria-label="Category">${(x.type === "in" ? IN_CATS : OUT_CATS).map((o) => `<option>${o}</option>`).join("")}</select><button class="btn sm primary" data-action="inboxok" data-id="${x.id}">Add</button>${x.type === "out" ? `<button class="btn sm" data-action="inboxpersonal" data-id="${x.id}">Personal</button>` : ""}</div></div></div>`).join("")}</div></div>` : ""}
      <form class="panel stack" data-form="entry" novalidate>
        <div class="panel-head"><h2>Add an entry</h2><div class="seg" role="group" aria-label="Entry type"><button type="button" data-action="etype" data-val="in" aria-pressed="${ui.entryType === "in"}">Money in</button><button type="button" data-action="etype" data-val="out" aria-pressed="${ui.entryType === "out"}">Money out</button></div></div>
        <div class="form-grid">
          <label class="field"><span>Amount (R)</span><input id="e-amount" name="amount" type="number" min="1" step="1" inputmode="decimal" placeholder="0"></label>
          <label class="field"><span>Paid by</span><select id="e-method" name="method">${METHODS.map((m) => `<option>${m}</option>`).join("")}</select></label>
          <label class="field"><span>Category</span><select id="e-cat" name="cat">${cats.map((m) => `<option>${m}</option>`).join("")}</select></label>
          <label class="field"><span>Date</span><input id="e-date" name="date" type="date" value="${iso(TODAY)}" max="${iso(TODAY)}"></label>
          <label class="field" style="grid-column:1/-1"><span>What was it for?</span><input id="e-note" name="note" type="text" placeholder="${ui.entryType === "in" ? "e.g. Lash lift, client paid cash" : "e.g. Gel polish restock"}"></label>
          ${useStock ? `<label class="field"><span>${ui.entryType === "in" ? "Stock used (optional)" : "Stock bought (optional)"}</span><select id="e-stock" name="stock"><option value="">None</option>${c.stock.map((s) => `<option value="${s.id}">${esc(s.name)} (${s.qty} ${esc(s.unit)})</option>`).join("")}</select></label><label class="field"><span>Quantity</span><input id="e-qty" name="qty" type="number" min="0" step="0.1" value="1"></label>` : ""}
        </div>
        <div class="row between"><div class="row">${ui.entryType === "out" ? `<label class="check"><input id="e-personal" name="personal" type="checkbox">This was a personal purchase</label>` : ""}<label class="check"><span class="small muted">Receipt photo</span><input id="e-receipt" name="receipt" type="file" accept="image/*,.pdf" style="max-width:190px"></label></div><button class="btn primary" type="submit">Save entry</button></div>
        ${ui.entryWarn ? `<div class="notice warn"><span class="ico">!</span><div class="small">${esc(ui.entryWarn)}</div></div>` : ""}
      </form>
      <div class="grid g3"><div class="panel stat"><span class="label">Money in</span><span class="v in">${R(t.inc)}</span></div><div class="panel stat"><span class="label">Money out</span><span class="v">${R(t.exp)}</span></div><div class="panel stat"><span class="label">Profit</span><span class="v">${R(t.profit)}</span></div></div>
      <div class="panel" style="padding:0"><div class="panel-head" style="padding:16px 18px 0"><h2>This month</h2><span class="small muted">${cur.length} entries · last entry ${lastEntryDays(c) === Infinity ? "never" : lastEntryDays(c) + " days ago"}</span></div>
        <div class="table-wrap flush"><table><thead><tr><th>Date</th><th>Details</th><th>Category</th><th>Paid by</th><th>Receipt</th><th class="r">Amount</th><th></th></tr></thead>
        <tbody>${cur.map((e) => `<tr><td class="num">${shortDate(e.date)}</td><td>${esc(e.note || "—")}${e.personal ? ` ${pill("warn", "Personal")}` : ""}</td><td>${esc(e.cat)}</td><td>${esc(e.method)}</td><td>${e.receipt ? pill("good", "Kept") : pill("plain", "None")}</td><td class="r num ${e.type === "in" ? "in" : ""}">${e.type === "in" ? "+" : "−"}${R(e.amount)}</td><td class="r">${e.personal ? `<button class="btn sm" data-action="repaid" data-id="${e.id}">Paid back</button>` : ""}</td></tr>`).join("") || `<tr><td colspan="7" class="muted">No entries this month yet.</td></tr>`}</tbody></table></div></div>
      <div class="notice info"><span class="ico">i</span><div class="small">Funders check that personal spending stays out of the business and that owners pay themselves a set salary. Record your pay under <b>Owner salary</b>, and mark personal purchases so you can pay them back.</div></div>`;
  }
  function vStock(c) {
    if (!TYPES[c.type].stock) return `${fHead(c, "Stock", "")}<p class="muted">Stock tracking is off for ${esc(TYPES[c.type].label)} businesses.</p>`;
    const low = lowStock(c), value = c.stock.reduce((s, x) => s + x.qty * x.cost, 0);
    return `${fHead(c, "Stock", "Know what you have before a client asks. Sales and purchases in Bookkeeping can update these numbers too.")}
      <div class="grid g3"><div class="panel stat"><span class="label">Items</span><span class="v">${c.stock.length}</span></div><div class="panel stat"><span class="label">Stock value (at cost)</span><span class="v">${R(value)}</span></div><div class="panel stat"><span class="label">Running low</span><span class="v" style="color:${low.length ? "var(--bad)" : "var(--ink)"}">${low.length}</span></div></div>
      <div class="table-wrap"><table><thead><tr><th>Item</th><th class="r">In stock</th><th class="r">Reorder at</th><th class="r">Cost each</th><th>Status</th><th>Update</th></tr></thead><tbody>
        ${c.stock.map((s) => `<tr><td><b>${esc(s.name)}</b></td><td class="r num">${s.qty} ${esc(s.unit)}</td><td class="r num">${s.reorder}</td><td class="r num">${R(s.cost)}</td><td>${s.qty <= s.reorder ? pill("bad", "Reorder") : pill("good", "OK")}</td>
          <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-action="stockuse" data-id="${s.id}" aria-label="Use one ${esc(s.name)}">Use 1</button><button class="btn sm" data-action="stockbuy" data-id="${s.id}">Restock</button></div></td></tr>`).join("") || `<tr><td colspan="6" class="muted">No items yet.</td></tr>`}
      </tbody></table></div>
      <form class="panel stack" data-form="stockadd" novalidate><h2>Add an item</h2><div class="form-grid">
        <label class="field"><span>Item</span><input id="st-name" name="name" type="text" placeholder="e.g. Lash glue"></label>
        <label class="field"><span>Unit</span><input id="st-unit" name="unit" type="text" placeholder="e.g. tubes"></label>
        <label class="field"><span>In stock</span><input id="st-qty" name="qty" type="number" min="0" step="0.1"></label>
        <label class="field"><span>Reorder at</span><input id="st-re" name="reorder" type="number" min="0" step="0.1"></label>
        <label class="field"><span>Cost each (R)</span><input id="st-cost" name="cost" type="number" min="0"></label>
      </div><div class="row between"><span class="hint">Restock records the cost as an expense in your books.</span><button class="btn primary" type="submit">Add item</button></div></form>`;
  }
  const payLink = (ref) => `https://proofpocket.co.za/pay/${ref}`;
  function popChecks(c, q) {
    const p = q.pop; if (!p) return [];
    const used = c.requests.some((r) => r !== q && r.pop && r.pop.fp === p.fp) || c.ledger.some((e) => e.popFp === p.fp);
    return [
      { ok: Number(p.amount) === Number(q.amount), text: Number(p.amount) === Number(q.amount) ? `Amount matches (${R(q.amount)})` : `Amount on proof is ${R(p.amount)}, request is ${R(q.amount)}` },
      { ok: !!p.usedRef, text: p.usedRef ? `Client says they used reference ${q.ref}` : "Client did not use the reference" },
      { ok: p.date >= q.date, text: p.date >= q.date ? "Paid after the request was sent" : "Payment date is before the request was sent" },
      { ok: !used, text: used ? "This exact file was used as proof before" : "Proof file not used before" },
      { ok: (q.rails || RAILS).includes(p.method), text: `Paid by ${p.method}` },
    ];
  }
  function vPayments(c) {
    const pay = c.pay || {}, checking = c.requests.filter((r) => r.status === "Checking"), others = c.requests.filter((r) => r.status !== "Checking");
    const reqRow = (q) => `<div class="li"><div class="li-main"><span><b>${esc(q.client)}</b> · ${esc(q.what || "Payment")} · <span class="num">${R(q.amount)}</span></span><span class="hint mono">${esc(payLink(q.ref).replace("https://", ""))} · ${(q.rails || RAILS).map(esc).join(", ")}</span>
        ${q.status === "Not received" ? `<span class="small" style="color:var(--bad)">You said the money wasn't in your account. The client can upload proof again.</span>` : ""}
        ${q.status !== "Paid" ? `<div class="row" style="gap:6px;margin-top:6px"><a class="btn sm" href="https://wa.me/?text=${encodeURIComponent(`Hi ${q.client}, please pay ${R(q.amount)} for ${q.what || "your booking"}. See how to pay and upload your proof of payment here: ${payLink(q.ref)}`)}" target="_blank" rel="noopener">Send on WhatsApp</a><button class="btn sm" data-action="showqr" data-ref="${q.ref}">Show QR</button><button class="btn sm primary" data-action="scan" data-ref="${q.ref}">Simulate client scanning</button></div><div class="qrbox" id="qr-${q.ref}" hidden></div>` : ""}</div>
        <div class="li-side">${q.status === "Paid" ? pill("good", "Paid · in books") : q.status === "Not received" ? pill("bad", "Not received") : `${pill("plain", "Waiting for client")}${(q.rails || RAILS).includes("Cash") ? `<button class="btn sm" data-action="reqpaid" data-ref="${q.ref}" data-method="Cash">Paid me cash</button>` : ""}`}</div></div>`;
    return `${fHead(c, "Payments", "Clients pay you directly with the methods they already use. They upload proof of payment, and you confirm once the money is in your account.")}
      <div class="notice info"><span class="ico">i</span><div class="small"><b>ProofPocket never holds your money</b> and needs no bank integration. Your client scans your QR code or opens your link, sees exactly what to pay and where, pays from their own banking app, and uploads proof of payment. <b>A proof of payment can be faked</b>, so it only goes into your books after you check your own banking app and confirm the money is in. Prototype: no money moves.</div></div>
      ${checking.length ? `<div class="panel stack"><h2>Proof of payment to check</h2>${checking.map((q) => { const p = q.pop, ch = popChecks(c, q), bad = ch.filter((x) => !x.ok).length;
        return `<div class="popbox ${bad ? "warn" : ""}"><div class="row between" style="align-items:flex-start"><div class="stack" style="gap:2px"><b>${esc(q.client)} says they paid ${R(p.amount)}</b><span class="hint">${esc(q.what)} · reference <span class="mono">${esc(q.ref)}</span> · ${esc(p.method)} on ${shortDate(p.date)} · from ${esc(p.payer)}</span><span class="fp">${esc(p.file)} · fingerprint ${esc(p.fp)}</span></div>${bad ? pill("warn", `${bad} thing${bad > 1 ? "s" : ""} to check`) : pill("good", "Details match")}</div>
          <div class="checklist" style="margin-top:8px">${ch.map((x) => `<div class="ck" style="grid-template-columns:22px minmax(0,1fr)"><span class="mark ${x.ok ? "ok" : "no"}">${x.ok ? "✓" : "!"}</span><span class="small">${esc(x.text)}</span></div>`).join("")}</div>
          <div class="notice warn" style="margin-top:8px"><span class="ico">!</span><span class="small">Open your banking app and look for <b>${R(p.amount)}</b> with reference <b>${esc(q.ref)}</b> before you confirm. Don't hand over goods on the proof alone.</span></div>
          <div class="row" style="margin-top:10px"><button class="btn primary" data-action="popok" data-ref="${q.ref}">The money is in my account</button><button class="btn danger" data-action="popno" data-ref="${q.ref}">Not received</button></div></div>`; }).join("")}</div>` : ""}
      <div class="grid g2">
        <form class="panel stack" data-form="payreq" novalidate><h2>Ask a client to pay</h2>
          <div class="form-grid"><label class="field"><span>Client</span><input id="p-client" name="client" type="text" placeholder="Client name"></label><label class="field"><span>Amount (R)</span><input id="p-amount" name="amount" type="number" min="1"></label><label class="field" style="grid-column:1/-1"><span>For</span><input id="p-what" name="what" type="text" placeholder="e.g. Manicure and gel"></label></div>
          <div class="stack" style="gap:4px"><span class="small muted" style="font-weight:600">Client can pay by</span><div class="row" style="gap:6px">${RAILS.map((r) => `<label class="chip"><input type="checkbox" name="rail" value="${r}"${r === "Card machine" ? "" : " checked"}> ${r}</label>`).join("")}</div></div>
          <div class="row between"><span class="hint">Creates a link and QR code. Your payment details come from your profile.</span><button class="btn primary" type="submit">Create request</button></div></form>
        <form class="panel stack" data-form="paydetails" novalidate><h2>Your payment details</h2>
          <p class="small muted">Shown to clients on your payment page. In the full system, changing these needs a one-time PIN and alerts your adviser, so nobody can swap them.</p>
          <div class="form-grid"><label class="field"><span>Bank</span><input id="pd-bank" name="bank" type="text" value="${esc(pay.bank || "")}"></label><label class="field"><span>Account name</span><input id="pd-name" name="accName" type="text" value="${esc(pay.accName || "")}"></label><label class="field"><span>Account number</span><input id="pd-no" name="accNo" type="text" class="mono" value="${esc(pay.accNo || "")}"></label><label class="field"><span>PayShap ShapID (usually your cell number)</span><input id="pd-shap" name="shapId" type="text" class="mono" value="${esc(pay.shapId || "")}"></label></div>
          ${/personal/i.test(pay.accName || "") ? `<div class="notice warn"><span class="ico">!</span><span class="small">This is a personal account. Open a business account (Registration steps) so business and personal money stay apart.</span></div>` : ""}
          <div class="row between"><span class="hint">Used on every new payment page</span><button class="btn" type="submit">Save details</button></div></form>
      </div>
      <div class="panel"><div class="panel-head"><h2>Payment requests</h2><span class="hint">Cash paid in person can be marked straight away</span></div>${others.length ? `<div class="list">${others.map(reqRow).join("")}</div>` : `<p class="muted">No requests yet.</p>`}</div>
      <div class="grid g2">
        <form class="panel stack" data-form="supplierpay" novalidate><h2>Pay a supplier</h2>
          ${c.suppliers.length ? `<div class="form-grid"><label class="field"><span>Supplier</span><select id="sp-sup" name="sup">${c.suppliers.map((s) => `<option value="${s.id}">${esc(s.name)} · ${esc(s.bank)}${s.pending ? " · ON HOLD" : ""}</option>`).join("")}</select></label><label class="field"><span>Amount (R)</span><input id="sp-amt" name="amount" type="number" min="1"></label><label class="field" style="grid-column:1/-1"><span>For</span><input id="sp-what" name="what" type="text" placeholder="Invoice number or items"></label></div>
          <div class="row between"><span class="hint">You pay from your banking app; ProofPocket records it.</span><button class="btn primary" type="submit">Record payment</button></div>` : `<p class="muted small">No saved suppliers yet.</p>`}
          <details><summary class="small">Add a supplier</summary><div class="form-grid" style="margin-top:8px"><label class="field"><span>Name</span><input id="ns-name" type="text"></label><label class="field"><span>Bank and last 4 digits</span><input id="ns-bank" type="text" placeholder="e.g. FNB ••1234"></label></div><button class="btn sm" type="button" data-action="addsupplier" style="margin-top:8px">Save supplier</button></details></form>
        <form class="panel stack" data-form="cashout" novalidate><h2>Record a cash payment out</h2><div class="form-grid"><label class="field"><span>Paid to</span><input id="co-name" name="name" type="text" placeholder="e.g. Collector, Thabo"></label><label class="field"><span>Amount (R)</span><input id="co-amount" name="amount" type="number" min="1"></label><label class="field" style="grid-column:1/-1"><span>For</span><input id="co-what" name="what" type="text" placeholder="e.g. PET bottles, 120 kg"></label></div>
          <div class="row between"><label class="check"><input id="co-nophone" name="nophone" type="checkbox" checked>Payee has no phone, give a slip number</label><button class="btn primary" type="submit">Record</button></div></form>
      </div>`;
  }
  function payPageHTML() {
    const c = company(ui.pay.cid), q = c && c.requests.find((r) => r.ref === ui.pay.ref); if (!q) return "";
    const pay = c.pay || {}, ver = isVerified(c), copy = (label, val) => `<div class="copyrow"><span class="hint">${label}</span><span class="mono">${esc(val)}</span><button type="button" class="btn sm" data-action="copytext" data-text="${esc(val)}">Copy</button></div>`;
    const sent = q.status === "Checking", paid = q.status === "Paid";
    const ways = (q.rails || RAILS).map((r) => r === "PayShap" ? `<div class="way"><b>PayShap</b><span class="small">In your banking app choose PayShap and pay to this ShapID. It arrives instantly.</span>${copy("ShapID", pay.shapId || "—")}${copy("Reference", q.ref)}</div>`
      : r === "Bank EFT" ? `<div class="way"><b>Bank transfer (EFT)</b><span class="small">Add these details as a once-off payment in your banking app.</span>${copy("Bank", pay.bank || "—")}${copy("Account name", pay.accName || "—")}${copy("Account number", pay.accNo || "—")}${copy("Reference", q.ref)}</div>`
      : r === "Cash" ? `<div class="way"><b>Cash</b><span class="small">Pay ${esc(c.name)} in person and quote reference ${esc(q.ref)}. They will mark it paid.</span></div>`
      : `<div class="way"><b>Card</b><span class="small">Tap your card on ${esc(c.name)}'s card machine in person.</span></div>`).join("");
    const digital = (q.rails || RAILS).filter((r) => r === "PayShap" || r === "Bank EFT");
    return `<div class="scrim" data-action="closepay"></div><aside class="drawer paypage" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="pp-title">
      <div class="drawer-head"><div><div class="label">Client view · opened from QR code</div><span class="hint mono">${esc(payLink(q.ref).replace("https://", ""))}</span></div><button class="btn sm" data-action="closepay">Close client view</button></div>
      <div class="drawer-body">
        <div class="panel stack" style="text-align:center;align-items:center"><span class="small muted">You're paying</span><h2 id="pp-title">${esc(c.name)}</h2>${ver ? pill("good", "Verified on ProofPocket") : pill("warn", "Starter: not yet verified")}
          <span class="payamt num">${R(q.amount)}</span><span>${esc(q.what || "Payment")}</span><span class="hint">Reference <b class="mono">${esc(q.ref)}</b> · requested ${shortDate(q.date)}</span></div>
        ${paid ? `<div class="notice good"><span class="ico">✓</span><div><b>Paid. Thank you.</b> <span class="small">${esc(c.name)} has confirmed your payment.</span></div></div>`
        : sent ? `<div class="notice info"><span class="ico">✓</span><div><b>Proof of payment sent.</b> <span class="small">${esc(c.name)} will confirm as soon as the money shows in their account. You'll get a message when it's confirmed.</span></div></div>`
        : `${q.status === "Not received" ? `<div class="notice bad"><span class="ico">!</span><span class="small">${esc(c.name)} hasn't received this payment yet. Check your bank, then upload your proof again.</span></div>` : ""}
          <div class="panel stack"><h3>How to pay</h3>${ways}</div>
          <div class="notice warn"><span class="ico">!</span><span class="small">Only pay to the details on this page. They come from ${esc(c.name)}'s ProofPocket profile. ProofPocket will never ask you to pay a different account.</span></div>
          ${digital.length ? `<form class="panel stack" data-form="pop" novalidate><h3>Paid? Send your proof of payment</h3>
            <div class="form-grid"><label class="field"><span>Your name</span><input id="pop-name" name="payer" type="text" value="${esc(q.client)}"></label><label class="field"><span>Amount paid (R)</span><input id="pop-amt" name="amount" type="number" min="1" value="${q.amount}"></label><label class="field"><span>Date paid</span><input id="pop-date" name="date" type="date" value="${iso(TODAY)}" max="${iso(TODAY)}"></label><label class="field"><span>Paid by</span><select id="pop-method" name="method">${digital.map((m) => `<option>${m}</option>`).join("")}</select></label></div>
            <label class="check"><input id="pop-ref" name="usedRef" type="checkbox" checked>I used reference ${esc(q.ref)}</label>
            <label class="field"><span>Proof of payment (screenshot or PDF from your bank)</span><input id="pop-file" name="file" type="file" accept="image/*,.pdf"></label>
            ${ui.pay.err ? `<p class="err">${esc(ui.pay.err)}</p>` : ""}
            <div class="row between"><span class="hint">ProofPocket reads the amount, date and reference from your proof in the full system.</span><button class="btn primary" type="submit">I've paid, send proof</button></div></form>` : ""}`}
        <div class="row between"><span class="hint">Something wrong with this request?</span><button class="btn sm danger" data-action="report" data-id="${c.id}">Report this request</button></div>
      </div></aside>`;
  }
  function vCashflow(c) {
    const a = avg(c), cash = cashNow(c), runway = a.exp > 0 ? cash / a.exp : 0, forecast = cash + (a.inc - a.exp);
    const ownerPaid = c.ledger.filter((e) => isThisMonth(e.date) && e.cat === "Owner salary").reduce((s, e) => s + e.amount, 0);
    const personal = c.ledger.filter((e) => e.personal).reduce((s, e) => s + e.amount, 0);
    const owed = c.requests.filter((r) => r.status === "Waiting"), restock = lowStock(c);
    return `${fHead(c, "Cash flow", "Where your money is, where it's going, and how long it lasts.")}
      <div class="grid g4">
        <div class="panel stat"><span class="label">Cash on hand now</span><span class="v">${R(cash)}</span><span class="d muted small">Start of month ${R(c.opening)} plus this month's profit</span></div>
        <div class="panel stat"><span class="label">Usual month</span><span class="v">${R(a.inc - a.exp)}</span><span class="d muted small">${R(a.inc)} in, ${R(a.exp)} out</span></div>
        <div class="panel stat"><span class="label">Expected in 30 days</span><span class="v" style="color:${forecast < 0 ? "var(--bad)" : "var(--ink)"}">${R(forecast)}</span><span class="d muted small">If next month is a usual one</span></div>
        <div class="panel stat"><span class="label">Cash lasts</span><span class="v">${runway ? runway.toFixed(1) : "—"}<span class="small muted"> months</span></span><span class="d muted small">If no money came in</span></div>
      </div>
      <div class="panel"><h2>Money in and out</h2>${barChart(series(c))}</div>
      <div class="grid g2">
        <div class="panel"><h2>Paying yourself</h2><div class="list">
          <div class="li"><span>Owner salary this month</span><span class="num">${R(ownerPaid)}</span></div>
          <div class="li"><span>Personal purchases from business money</span><span class="num" style="color:${personal ? "var(--bad)" : "var(--ink)"}">${R(personal)}</span></div>
          <div class="li"><span class="small muted">A set monthly salary keeps business money clean and shows funders you run the business professionally.</span></div></div></div>
        <div class="panel"><h2>Coming up</h2><div class="list">
          ${owed.map((r) => `<div class="li"><span>${esc(r.client)} owes you</span><span class="num in">+${R(r.amount)}</span></div>`).join("")}
          ${restock.map((s) => `<div class="li"><span>Restock ${esc(s.name)}</span><span class="num">−${R(s.cost * Math.max(1, s.reorder * 2 - s.qty))}</span></div>`).join("")}
          ${!owed.length && !restock.length ? `<div class="li"><span class="muted">Nothing scheduled.</span></div>` : ""}</div></div>
      </div>`;
  }
  function vMarkets(c) {
    const p = c.profile, ver = isVerified(c);
    return `${fHead(c, "Profile & marketing", "Your public page, a verified QR code, and posts you share from your own WhatsApp and social media.")}
      ${!ver ? lock("Your profile isn't in the public directory yet", "Finish the four verification steps to get the Verified badge and be listed. You can still share posts from your own accounts now.", `<button class="btn sm" data-action="nav" data-view="start" style="margin-left:auto">Get verified</button>`) : ""}
      <div class="grid g2">
        <form class="panel stack" data-form="profile" novalidate><h2>Your public profile</h2>
          <label class="field"><span>One line about your business</span><input id="pr-tag" name="tagline" type="text" value="${esc(p.tagline)}" maxlength="90"></label>
          <label class="field"><span>Services and prices (one per line)</span><textarea id="pr-svc" name="services">${esc(p.services)}</textarea></label>
          <div class="form-grid"><label class="field"><span>WhatsApp number</span><input id="pr-wa" name="whatsapp" type="text" value="${esc(p.whatsapp)}"></label><label class="field"><span>Instagram</span><input id="pr-ig" name="instagram" type="text" value="${esc(p.instagram)}"></label><label class="field"><span>Hours</span><input id="pr-hours" name="hours" type="text" value="${esc(p.hours)}"></label></div>
          <div class="row between"><span class="hint mono">${esc(profileUrl(c))}</span><button class="btn primary" type="submit">Save profile</button></div></form>
        <div class="panel stack"><h2>Verified QR code</h2><p class="small muted">Print it at your stall or add it to your posts. Scanning it opens your profile and shows whether you're verified.</p>
          <div class="row" style="gap:16px;align-items:center"><div class="qrbox" id="qr-profile" data-text="https://${esc(profileUrl(c))}"></div><div class="stack" style="gap:6px">${ver ? pill("good", "Verified on ProofPocket") : pill("warn", "Starter: not verified yet")}<span class="small">${esc(c.name)}</span><button class="btn sm" data-action="copylink">Copy profile link</button></div></div></div>
      </div>
      <form class="panel stack" data-form="post" novalidate><h2>Create a post</h2>
        <label class="field"><span>What do you want to tell customers?</span><textarea id="po-text" name="text" maxlength="400" placeholder="e.g. Gel overlays this Saturday, R250. Book on WhatsApp."></textarea></label>
        <div class="row between"><span class="hint">Posts go out from your own accounts with your profile link.${ver ? " Verified businesses can ask for a weekly feature." : ""}</span><div class="row" style="gap:6px"><button class="btn primary" type="submit" name="do" value="share">Save post</button>${ver ? `<button class="btn" type="submit" name="do" value="feature">Save and request a feature</button>` : ""}</div></div></form>
      <div class="panel"><h2>Your posts</h2>${c.posts.length ? `<div class="list">${c.posts.map((po) => `<div class="li"><div class="li-main"><span>${esc(po.text)}</span><span class="hint">${shortDate(po.date)}${po.shared.length ? " · shared to " + po.shared.map(esc).join(", ") : ""}</span></div>
        <div class="li-side"><div class="row" style="gap:6px"><a class="btn sm" data-action="shared" data-id="${po.id}" data-net="WhatsApp" href="https://wa.me/?text=${encodeURIComponent(shareText(c, po.text))}" target="_blank" rel="noopener">WhatsApp</a><a class="btn sm" data-action="shared" data-id="${po.id}" data-net="Facebook" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://" + profileUrl(c))}" target="_blank" rel="noopener">Facebook</a><a class="btn sm" data-action="shared" data-id="${po.id}" data-net="X" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText(c, po.text))}" target="_blank" rel="noopener">X</a></div>${po.feature === "featured" ? pill("good", "Featured this week") : po.feature === "requested" ? pill("warn", "Feature requested") : ""}</div></div>`).join("")}</div>` : `<p class="muted">No posts yet.</p>`}</div>
      <div class="panel"><h2>Buyers looking for suppliers</h2><div class="grid g2">${data.buyers.map((b) => { const match = b.sectors.includes(c.sector), sent = c.intros.includes(b.id);
        return `<div class="panel stack" style="background:var(--surface-2)"><div class="panel-head" style="margin:0"><h3>${esc(b.name)}</h3>${match ? pill("info", "Good fit") : pill("plain", b.kind)}</div><p class="small">${esc(b.wants)}</p><div class="row between"><span class="hint">Your adviser arranges the introduction</span>${sent ? pill("good", "Requested") : ver ? `<button class="btn sm${match ? " primary" : ""}" data-action="intro" data-id="${b.id}">Request introduction</button>` : pill("plain", "Verified only")}</div></div>`; }).join("")}</div></div>`;
  }
  function vFunding(c) {
    const r = readiness(c), myApps = data.apps.filter((a) => a.companyId === c.id);
    const progs = data.funders.flatMap((f) => f.programmes.map((p) => ({ f, p, gaps: progCheck(c, p) }))).sort((a, b) => a.gaps.length - b.gaps.length);
    return `${fHead(c, "Funding readiness", "Funders set their own requirements on ProofPocket. See what each one checks, and what you still need, before you apply.")}
      ${!isVerified(c) ? lock("Funders can't see you yet", "You can see your score and every programme's requirements now. You can apply once you're verified.", `<button class="btn sm" data-action="nav" data-view="start" style="margin-left:auto">Get verified</button>`) : ""}
      <div class="grid g3">
        <div class="panel"><div class="row" style="gap:18px">${ring(r.score)}<div class="stack" style="gap:6px"><span>${pill(scoreClass(r.score), scoreLabel(r.score))}</span><span class="small muted">From your checked documents and the state of your books. Funders see the same score.</span></div></div></div>
        <div class="panel span2"><h2>What makes up your score</h2><div class="grid g2"><div><div class="label" style="margin-bottom:4px">Documents</div>${checklist(r.items.filter((i) => i.group === "Documents"))}</div><div><div class="label" style="margin-bottom:4px">Bookkeeping</div>${checklist(r.items.filter((i) => i.group === "Bookkeeping"))}</div></div></div>
      </div>
      <div class="panel" style="padding:0"><div class="panel-head" style="padding:16px 18px 0"><h2>Programmes and what you're missing</h2><span class="small muted">Only verified funders are listed</span></div>
        <div class="table-wrap flush"><table><thead><tr><th>Programme</th><th>Amount</th><th>Funds left</th><th>What you still need</th><th>Apply</th></tr></thead><tbody>
        ${progs.map(({ f, p, gaps }) => { const applied = myApps.some((a) => a.programmeId === p.id);
          return `<tr><td><b>${esc(p.name)}</b><div class="hint">${esc(f.name)} · ${esc(f.kind)} ${pill("good", "Verified funder")}</div></td><td class="num">${R(p.min)}–${R(p.max)}</td><td class="num">${R(p.budget - p.used)}</td>
            <td>${gaps.length ? `<div class="row" style="gap:4px">${gaps.map((g) => `<span class="chip">× ${esc(g)}</span>`).join("")}</div>` : pill("good", "Nothing, you qualify")}</td>
            <td>${applied ? pill("info", "Applied") : gaps.length ? `<span class="small muted">—</span>` : `<div class="row" style="gap:6px;flex-wrap:nowrap"><input id="amt-${p.id}" type="number" min="${p.min}" max="${p.max}" value="${p.max}" aria-label="Amount to request" style="width:110px"><button class="btn sm primary" data-action="apply" data-prog="${p.id}">Apply</button></div>`}</td></tr>`; }).join("") || `<tr><td colspan="5" class="muted">No programmes yet.</td></tr>`}</tbody></table></div></div>
      <div class="panel"><h2>Your applications</h2>${myApps.length ? `<div class="grid g2">${myApps.map((a) => { const pr = programme(a.programmeId), lastO = a.offers[a.offers.length - 1];
        return `<div class="panel" style="background:var(--surface-2)"><div class="panel-head"><div><h3>${esc(pr.p.name)}</h3><span class="hint">${esc(pr.f.name)} · applied ${shortDate(a.date)}</span></div>${statusPill(a.status)}</div>
          <div class="row between" style="margin-bottom:8px"><span class="small muted">Requested <b class="num">${R(a.requested)}</b></span><span class="small muted">Current offer <b class="num">${R(lastO.amount)}</b></span></div>
          <div class="label" style="margin-bottom:2px">Offer history</div>${offerHistory(a)}${a.statusReason ? `<p class="small" style="margin-top:8px">${esc(a.statusReason)}</p>` : ""}
          ${a.offers.length > 1 && !lastO.reason ? `<div class="row" style="margin-top:10px"><button class="btn sm" data-action="askreason" data-app="${a.id}"${a.reasonAsked ? " disabled" : ""}>${a.reasonAsked ? "Reason requested" : "Ask the funder for a reason"}</button></div>` : ""}</div>`; }).join("")}</div>` : `<p class="muted">No applications yet.</p>`}</div>`;
  }
  function vProcurement(c) {
    const rm = recordMonths(c), ver = isVerified(c);
    return `${fHead(c, "Procurement", "Tenders and supplier opportunities. Buyers see your checked documents and your track record on ProofPocket, so you don't have to prove it from scratch each time.")}
      <div class="grid g3"><div class="panel stat"><span class="label">Track record</span><span class="v">${rm}<span class="small muted"> of 6 months</span></span><div class="bar" style="width:100%"><i style="width:${Math.min(100, (rm / 6) * 100)}%"></i></div></div>
        <div class="panel stat"><span class="label">Account</span><span class="v" style="font-size:1.1rem">${ver ? "Verified" : "Starter"}</span><span class="d muted small">${ver ? "Buyers can check your documents" : "Verify to apply"}</span></div>
        <div class="panel stat"><span class="label">Tender documents</span><span class="v" style="font-size:1.1rem">${["tax", "csd", "bbbee"].filter((k) => c.docs[k] === "verified").length} of 3</span><span class="d muted small">Tax, CSD, B-BBEE</span></div></div>
      <div class="table-wrap"><table><thead><tr><th>Opportunity</th><th>Value</th><th>Closes</th><th>Needs</th><th></th></tr></thead><tbody>
        ${data.tenders.map((t) => { const miss = missingFor(c, t.req), short = rm < t.months, match = t.sectors.includes(c.sector), on = c.interest.includes(t.id);
          return `<tr><td><b>${esc(t.title)}</b><div class="hint">${esc(t.buyer)}${match ? " · " + pill("info", "Your sector") : ""}</div></td><td class="num">${R(t.value)}</td><td class="num">${shortDate(t.closes)}</td>
            <td><div class="row" style="gap:4px">${t.req.map((k) => `<span class="chip">${c.docs[k] === "verified" ? "✓" : "×"} ${esc(DOCS[k].short)}</span>`).join("")}<span class="chip">${short ? "×" : "✓"} ${t.months} months' record</span></div></td>
            <td class="r">${on ? pill("good", "Interest sent") : !ver ? pill("plain", "Verify first") : miss.length ? `<button class="btn sm" data-action="nav" data-view="start">Add ${miss.length} document${miss.length > 1 ? "s" : ""}</button>` : short ? pill("plain", `${t.months - rm} more month${t.months - rm > 1 ? "s" : ""}`) : `<button class="btn sm primary" data-action="interest" data-id="${t.id}">Express interest</button>`}</td></tr>`; }).join("")}
      </tbody></table></div>`;
  }
  function vProtection(c) {
    return `${fHead(c, "Fraud protection", "Scam warnings, holds on changed bank details, and a fingerprint of every document you upload.")}
      <div class="panel"><h2>Messages about money</h2>${c.messages.length ? `<div class="list">${c.messages.map((m) => `<div class="li"><div class="li-main"><span><b>${esc(m.from)}</b> ${m.verified ? pill("good", "Verified on ProofPocket") : pill("bad", "Not verified")}</span><span class="hint">${esc(m.address)} · ${shortDate(m.date)}</span><p class="small" style="margin-top:4px">“${esc(m.text)}”</p>${m.flags.length ? `<div class="row" style="gap:4px;margin-top:4px">${m.flags.map((f) => pill("bad", f)).join("")}</div>` : ""}</div>
        <div class="li-side">${m.status === "open" && !m.verified ? `<button class="btn sm danger" data-action="msg" data-id="${m.id}" data-do="block">Report and block</button><button class="btn sm" data-action="msg" data-id="${m.id}" data-do="safe">It's genuine</button>` : m.status === "blocked" ? pill("plain", "Reported and blocked") : m.status === "safe" ? pill("plain", "Marked genuine") : ""}</div></div>`).join("")}</div>` : `<p class="muted">No messages.</p>`}</div>
      <div class="panel"><div class="panel-head"><h2>Supplier bank details</h2><button class="btn sm" data-action="simchange">Simulate a change request</button></div>${c.suppliers.length ? `<div class="list">${c.suppliers.map((s) => `<div class="li"><div class="li-main"><span><b>${esc(s.name)}</b> · ${esc(s.bank)}</span>${s.pending ? `<span class="small" style="color:var(--bad)">New details received ${shortDate(s.pending.date)}: ${esc(s.pending.bank)}. Payments are on hold until you confirm by phone, on a number you already had.</span>` : `<span class="hint">No changes</span>`}</div><div class="li-side">${s.pending ? `<button class="btn sm" data-action="supok" data-id="${s.id}">I've confirmed by phone</button><button class="btn sm danger" data-action="supreject" data-id="${s.id}">Reject change</button>` : pill("good", "Unchanged")}</div></div>`).join("")}</div>` : `<p class="muted">No suppliers saved. Add one under Payments.</p>`}</div>
      <div class="grid g2">
        <div class="panel"><h2>Document fingerprints</h2><p class="small muted" style="margin-bottom:8px">If a file is changed after it was checked, the fingerprint stops matching and funders are warned.</p><div class="list">${Object.keys(c.fp).map((k) => `<div class="li"><span class="small">${esc(DOCS[k].name)}</span><span class="fp">${esc(c.fp[k])}</span></div>`).join("") || '<p class="muted small">No documents yet.</p>'}</div></div>
        <div class="panel"><h2>Rules that keep you safe</h2><div class="list">
          <div class="li"><span class="small">Verified funders and incubators show a badge. Anyone else offering funding is a warning sign.</span></div>
          <div class="li"><span class="small">Be wary of any request to pay a fee before money is released. Check with your adviser first.</span></div>
          <div class="li"><span class="small">When a supplier changes bank details, ProofPocket holds payments until you confirm by phone.</span></div>
          <div class="li"><span class="small">ProofPocket will never ask for your banking PIN or one-time PIN.</span></div></div></div>
      </div>`;
  }
  function vPrivacy(c) {
    const opt = (v, t, d) => `<label class="radio-card${c.consent.funders === v ? " on" : ""}"><input type="radio" name="consent" value="${v}" data-change="consent"${c.consent.funders === v ? " checked" : ""}><span><b>${t}</b><span class="hint">${d}</span></span></label>`;
    return `${fHead(c, "Privacy & sharing", "You decide who sees what. You can change this at any time.")}
      <div class="panel stack"><h2>What verified funders can see</h2>
        ${opt("none", "Nothing", "Funders can't find you. Applying to a programme still shares your profile with that funder only.")}
        ${opt("summary", "Summary", "Readiness score, document status (not the files) and monthly totals.")}
        ${opt("full", "Full books", "Everything in Summary, plus each entry in your books. Funders with full access can decide faster.")}</div>
      <div class="grid g2"><div class="panel"><h2>Always private</h2><div class="list"><div class="li"><span class="small">Your document files. Others see only whether they're checked.</span></div><div class="li"><span class="small">Your ID number and bank account number.</span></div><div class="li"><span class="small">Personal purchases you've marked.</span></div></div></div>
        <div class="panel"><h2>Your incubator</h2><p class="small">${ngo(c.ngo.id) ? `${esc(ngo(c.ngo.id).name)} supports you and can see your books and documents in order to help. Adviser: ${esc(c.ngo.adviser || "not assigned yet")}.` : "You haven't chosen an incubator."}</p></div></div>`;
  }

  // ================================================================ funder views
  function funderSetup(f) {
    return `<div class="page-head"><div><div class="label">${esc(f.name)}</div><h1>Set your requirements</h1><p class="muted">Before you see companies, tell founders what you need. They see these requirements on their Funding page before they apply, so fewer incomplete applications reach you.</p></div></div>
      <form class="panel stack" data-form="fsetup" novalidate>
        <div class="form-grid">
          <label class="field"><span>Programme name</span><input id="fs-name" name="name" type="text" placeholder="e.g. Township Starter Grant"></label>
          <label class="field"><span>Type</span><select id="fs-kind" name="kind">${["Grant", "Loan", "Equity", "Blended"].map((k) => `<option${k === f.kind ? " selected" : ""}>${k}</option>`).join("")}</select></label>
          <label class="field"><span>Smallest amount (R)</span><input id="fs-min" name="min" type="number" min="0" value="5000"></label>
          <label class="field"><span>Largest amount (R)</span><input id="fs-max" name="max" type="number" min="0" value="30000"></label>
          <label class="field"><span>Total budget (R)</span><input id="fs-budget" name="budget" type="number" min="0" value="500000"></label>
          <label class="field"><span>Months of records needed</span><input id="fs-months" name="minMonths" type="number" min="0" max="36" value="3"></label>
          <label class="field"><span>Minimum readiness score</span><input id="fs-score" name="minScore" type="number" min="0" max="100" value="40"></label>
        </div>
        <div><div class="label" style="margin-bottom:6px">Documents applicants must have checked</div><div class="row" style="gap:6px">${Object.keys(DOCS).filter((k) => k !== "id" && k !== "addr").map((k) => `<label class="chip"><input type="checkbox" name="req" value="${k}"${["cipc", "bank", "tax"].includes(k) ? " checked" : ""}> ${esc(DOCS[k].name)}</label>`).join("")}</div></div>
        <div class="row between"><span class="hint">You can change requirements later. Founders see every change.</span><div class="row" style="gap:6px">${f.programmes.length ? `<button class="btn" type="button" data-action="cancelsetup">Cancel</button>` : ""}<button class="btn primary" type="submit">Save and open pipeline</button></div></div>
        <p class="err" id="fs-err" hidden></p>
      </form>`;
  }
  function funderPipeline() {
    const f = funder(ui.me.funder), F = ui.filter, vis = data.companies.filter(funderVisible);
    const sectors = [...new Set(vis.map((c) => c.sector))].sort();
    const rows = vis.map((c) => ({ c, r: readiness(c).score })).filter(({ c, r }) => (!F.q || (c.name + c.town + c.sector).toLowerCase().includes(F.q.toLowerCase())) && (!F.sector || c.sector === F.sector) && (!F.setting || c.setting === F.setting) && r >= F.min).sort((a, b) => b.r - a.r);
    const qual = (c) => f.programmes.filter((p) => progCheck(c, p).length === 0).length;
    return `<div class="page-head"><div><div class="label">${esc(f.name)} · ${esc(f.kind)} funder</div><h1>Company pipeline</h1><p class="muted">Verified companies that chose to share with funders, ranked by readiness. Scores come from checked documents and live books, not self-reported figures.</p></div></div>
      <div class="grid g4">
        <div class="panel stat"><span class="label">Verified and sharing</span><span class="v">${vis.length}</span><span class="d muted">${data.companies.length - vis.length} Starter or private</span></div>
        <div class="panel stat"><span class="label">Meet your requirements</span><span class="v">${vis.filter((c) => qual(c) > 0).length}</span><span class="d muted">For at least one programme</span></div>
        <div class="panel stat"><span class="label">Funding ready (70+)</span><span class="v">${vis.filter((c) => readiness(c).score >= 70).length}</span></div>
        <div class="panel stat"><span class="label">Applications to you</span><span class="v">${data.apps.filter((a) => a.funderId === f.id).length}</span><span class="d"><button class="btn ghost sm" data-action="nav" data-view="applications">Open</button></span></div>
      </div>
      <div class="panel"><div class="form-grid">
        <label class="field"><span>Search</span><input id="flt-q" type="text" data-filter="q" value="${esc(F.q)}" placeholder="Name, town or sector"></label>
        <label class="field"><span>Sector</span><select id="flt-sector" data-filter="sector"><option value="">All sectors</option>${sectors.map((s) => `<option${s === F.sector ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label>
        <label class="field"><span>Area</span><select id="flt-setting" data-filter="setting"><option value="">Township, urban and rural</option>${["Township", "Urban", "Rural"].map((s) => `<option${s === F.setting ? " selected" : ""}>${s}</option>`).join("")}</select></label>
        <label class="field"><span>Minimum readiness: <b class="num">${F.min}</b></span><input id="flt-min" type="range" min="0" max="100" step="5" value="${F.min}" data-filter="min" style="accent-color:var(--accent)"></label>
      </div></div>
      <div class="table-wrap"><table><thead><tr><th>Company</th><th>Area</th><th>Readiness</th><th>Your programmes</th><th>Income, 5 months</th><th>Books</th><th>Sharing</th></tr></thead>
        <tbody>${rows.map(({ c, r }) => { const last = lastEntryDays(c), q = qual(c);
          return `<tr class="click" data-action="open" data-id="${c.id}" tabindex="0"><td><b>${esc(c.name)}</b><div class="hint">${esc(c.sector)} · ${esc(c.stage)}</div></td><td>${esc(c.town)}<div class="hint">${esc(c.setting)}</div></td><td>${scoreCell(r)}</td><td>${q ? pill("good", `Qualifies for ${q}`) : pill("plain", "Not yet")}</td><td>${spark(c)}</td><td>${last <= 7 ? pill("good", "Up to date") : last <= 14 ? pill("warn", last + " days") : pill("bad", last === Infinity ? "None" : last + " days")}</td><td class="small">${c.consent.funders === "full" ? "Full books" : "Summary"}</td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">No companies match these filters.</td></tr>`}</tbody></table></div>`;
  }
  function funderApplications() {
    const f = funder(ui.me.funder), list = data.apps.filter((a) => a.funderId === f.id).sort((a, b) => (a.date < b.date ? 1 : -1));
    return `<div class="page-head"><div><div class="label">${esc(f.name)}</div><h1>Applications</h1><p class="muted">Every change to an offer needs a reason, and founders see the full history.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Company</th><th>Programme</th><th class="r">Requested</th><th class="r">Current offer</th><th>Status</th><th>Readiness</th><th></th></tr></thead>
        <tbody>${list.map((a) => { const c = company(a.companyId), pr = programme(a.programmeId), last = a.offers[a.offers.length - 1];
          return `<tr><td><b>${esc(c.name)}</b><div class="hint">${shortDate(a.date)}</div></td><td>${esc(pr.p.name)}</td><td class="r num">${R(a.requested)}</td><td class="r num">${R(last.amount)}${a.offers.length > 1 && !last.reason ? `<div class="hint" style="color:var(--bad)">No reason given</div>` : ""}${a.reasonAsked ? `<div class="hint" style="color:var(--warn)">Founder asked why</div>` : ""}</td><td>${statusPill(a.status)}</td><td>${scoreCell(readiness(c).score)}</td><td class="r"><button class="btn sm" data-action="open" data-id="${c.id}">Open</button></td></tr>`; }).join("") || `<tr><td colspan="7" class="muted">No applications yet.</td></tr>`}</tbody></table></div>`;
  }
  function funderProgrammes() {
    const f = funder(ui.me.funder);
    return `<div class="page-head"><div><div class="label">${esc(f.name)}</div><h1>Programmes & requirements</h1><p class="muted">Founders see these requirements before they apply. Changes reach them straight away.</p></div><button class="btn" data-action="newprog">Add a programme</button></div>
      ${f.programmes.map((p) => { const ok = data.companies.filter((c) => funderVisible(c) && progCheck(c, p).length === 0).length, left = p.budget - p.used;
        return `<div class="panel stack"><div class="panel-head" style="margin:0"><div><h2>${esc(p.name)}</h2><span class="hint">${esc(f.kind)} · ${R(p.min)} to ${R(p.max)} per business · ${p.minMonths || 0} months of records · score ${p.minScore || 0}+</span></div>${pill("info", `${ok} verified ${ok === 1 ? "company qualifies" : "companies qualify"}`)}</div>
          <div class="grid g3"><div class="stat"><span class="label">Budget</span><span class="v">${R(p.budget)}</span></div><div class="stat"><span class="label">Committed</span><span class="v">${R(p.used)}</span></div><div class="stat"><span class="label">Left</span><span class="v">${R(left)}</span><div class="bar" style="width:100%"><i style="width:${Math.round((p.used / (p.budget || 1)) * 100)}%"></i></div></div></div>
          <div><div class="label" style="margin-bottom:6px">Required documents (click to change)</div><div class="row" style="gap:6px">${Object.keys(DOCS).filter((k) => k !== "addr" && k !== "id").map((k) => `<button type="button" class="chip" data-action="togglereq" data-prog="${p.id}" data-doc="${k}" aria-pressed="${p.req.includes(k)}">${esc(DOCS[k].name)}</button>`).join("")}</div></div></div>`; }).join("")}`;
  }

  // ================================================================ NGO views
  const cohort = () => data.companies.filter((c) => c.ngo.id === ui.me.ngo);
  const verifyQueue = () => cohort().flatMap((c) => Object.keys(c.docs).filter((k) => c.docs[k] === "pending").map((k) => ({ c, k })));
  function ngoCohort() {
    const n = ngo(ui.me.ngo), list = cohort();
    return `<div class="page-head"><div><div class="label">${esc(n.name)}</div><h1>Cohort board</h1><p class="muted">Your companies by support stage. Starter companies are ones you're helping to register.</p></div></div>
      <div class="grid g4">
        <div class="panel stat"><span class="label">Companies</span><span class="v">${list.length}</span><span class="d muted">${list.filter((c) => !isVerified(c)).length} Starter</span></div>
        <div class="panel stat"><span class="label">Average readiness</span><span class="v">${list.length ? Math.round(list.reduce((s, c) => s + readiness(c).score, 0) / list.length) : 0}</span></div>
        <div class="panel stat"><span class="label">Documents to check</span><span class="v" style="color:${verifyQueue().length ? "var(--warn)" : "var(--ink)"}">${verifyQueue().length}</span><span class="d"><button class="btn ghost sm" data-action="nav" data-view="verify">Open</button></span></div>
        <div class="panel stat"><span class="label">Support sessions logged</span><span class="v">${list.reduce((s, c) => s + c.ngo.log.length, 0)}</span></div>
      </div>
      <div class="board">${STAGES.map((s, i) => { const col = list.filter((c) => c.ngo.stage === i);
        return `<div class="col"><div class="col-head"><span class="label">${esc(s)}</span><span class="n">${col.length}</span></div>${col.map((c) => { const fl = flags(c).filter((x) => !x.text.startsWith("Starter"));
          return `<button type="button" class="card" data-action="open" data-id="${c.id}"><span class="row between" style="gap:6px"><b>${esc(c.name)}</b>${levelPill(c)}</span><span class="hint">${esc(c.sector)} · ${esc(c.town)}</span>${scoreCell(readiness(c).score)}<span class="hint">Adviser: ${esc(c.ngo.adviser || "not assigned")}</span>${fl.length ? `<span class="flags">${fl.slice(0, 2).map((f) => pill(f.level, f.text)).join("")}${fl.length > 2 ? pill("plain", "+" + (fl.length - 2)) : ""}</span>` : ""}</button>`; }).join("") || `<span class="hint" style="padding:4px">None</span>`}</div>`; }).join("")}</div>`;
  }
  function ngoVerify() {
    const n = ngo(ui.me.ngo), q = verifyQueue();
    return `<div class="page-head"><div><div class="label">${esc(n.name)}</div><h1>Document checks</h1><p class="muted">Check each upload against the original or the issuer's records, then approve it or send it back with a reason. A company becomes Verified when its four joining documents are approved.</p></div></div>
      <div class="panel">${q.length ? `<div class="list">${q.map(({ c, k }) => `<div class="li"><div class="li-main"><span><b>${esc(c.name)}</b> · ${esc(DOCS[k].name)} ${levelPill(c)}</span><span class="fp">${esc(c.files[k] || "uploaded file")} · fingerprint ${esc(c.fp[k] || "")}</span>${k === "cipc" && c.reg ? `<span class="hint">CIPC number given: <span class="mono">${esc(c.reg)}</span></span>` : ""}
          <input id="rej-${c.id}-${k}" type="text" placeholder="Reason, if you send it back" aria-label="Reason for sending back" style="max-width:300px;margin-top:6px"></div>
          <div class="li-side"><button class="btn sm primary" data-action="docapprove" data-id="${c.id}" data-doc="${k}">Approve</button><button class="btn sm danger" data-action="docreject" data-id="${c.id}" data-doc="${k}">Send back</button></div></div>`).join("")}</div>` : `<p class="muted">No documents waiting. New uploads from your companies appear here.</p>`}</div>`;
  }
  function ngoAttention() {
    const n = ngo(ui.me.ngo), items = cohort().flatMap((c) => flags(c).map((f) => ({ c, f }))).sort((a, b) => (a.f.level === "bad" ? -1 : 1) - (b.f.level === "bad" ? -1 : 1));
    return `<div class="page-head"><div><div class="label">${esc(n.name)}</div><h1>Needs attention</h1><p class="muted">Problems spotted in your companies' books, documents, stock and messages, most urgent first.</p></div></div>
      <div class="panel">${items.length ? `<div class="list">${items.map(({ c, f }) => `<div class="li"><div class="li-main"><span>${pill(f.level, f.level === "bad" ? "Act now" : "Check")} <b>${esc(c.name)}</b></span><span class="small">${esc(f.text)}</span></div><div class="li-side"><button class="btn sm" data-action="open" data-id="${c.id}">Open</button></div></div>`).join("")}</div>` : `<p class="muted">Nothing needs attention.</p>`}</div>`;
  }
  function ngoSupport() {
    const n = ngo(ui.me.ngo), list = cohort();
    const log = list.flatMap((c) => c.ngo.log.map((l) => ({ c, l }))).sort((a, b) => (a.l.date < b.l.date ? 1 : -1));
    const intros = list.flatMap((c) => c.intros.map((b) => ({ c, b: data.buyers.find((x) => x.id === b) })));
    return `<div class="page-head"><div><div class="label">${esc(n.name)}</div><h1>Support log</h1><p class="muted">Record every intervention so funders and your monitoring and evaluation reports show what support each company received.</p></div></div>
      <form class="panel stack" data-form="ngolog" novalidate><h2>Log support</h2><div class="form-grid">
        <label class="field"><span>Company</span><select id="nl-company" name="company">${list.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label>
        <label class="field"><span>Type of support</span><select id="nl-type" name="type">${SUPPORT_TYPES.map((t) => `<option>${t}</option>`).join("")}</select></label>
        <label class="field" style="grid-column:1/-1"><span>What happened and what's next</span><textarea id="nl-note" name="note" placeholder="e.g. Walked through CIPC registration on BizPortal; follow up when the certificate arrives."></textarea></label></div>
        <div class="row between"><span class="hint">Shows on the company's timeline.</span><button class="btn primary" type="submit">Save</button></div></form>
      ${intros.length ? `<div class="panel"><h2>Introduction requests</h2><div class="list">${intros.map(({ c, b }) => `<div class="li"><span><b>${esc(c.name)}</b> asked to meet ${esc(b.name)}</span>${pill("warn", "To arrange")}</div>`).join("")}</div></div>` : ""}
      <div class="panel"><h2>History</h2>${log.length ? `<div class="timeline">${log.map(({ c, l }) => `<div class="tl"><span class="when">${shortDate(l.date)}</span><span><b>${esc(c.name)}</b> · ${esc(l.type)}<br><span class="small muted">${esc(l.note)}</span></span></div>`).join("")}</div>` : `<p class="muted">No support logged yet.</p>`}</div>`;
  }

  // ================================================================ public directory
  function vDirectory() {
    const D = ui.dir, list = data.companies.filter(isVerified), sectors = [...new Set(list.map((c) => c.sector))].sort();
    const rows = list.filter((c) => (!D.q || (c.name + c.town + c.sector + c.profile.tagline).toLowerCase().includes(D.q.toLowerCase())) && (!D.sector || c.sector === D.sector));
    const featured = list.flatMap((c) => c.posts.filter((p) => p.feature === "featured").map((p) => ({ c, p })));
    return `<div class="page-head"><div><div class="label">ProofPocket directory</div><h1>Verified local businesses</h1><p class="muted">Every business here has shown ProofPocket its CIPC registration, owner ID, business bank account and address. Scan a business's QR code to check it.</p></div></div>
      ${featured.length ? `<div class="panel"><h2>Featured this week</h2><div class="grid g2">${featured.map(({ c, p }) => `<button type="button" class="feature" data-action="open" data-id="${c.id}"><span class="row between" style="gap:6px"><b>${esc(c.name)}</b>${pill("good", "Verified")}</span><span class="small">${esc(p.text)}</span><span class="hint">${esc(c.town)} · ${shortDate(p.date)}</span></button>`).join("")}</div></div>` : ""}
      <div class="panel"><div class="form-grid"><label class="field"><span>Search</span><input id="dir-q" type="text" data-dir="q" value="${esc(D.q)}" placeholder="e.g. catering Mamelodi"></label><label class="field"><span>Sector</span><select id="dir-sector" data-dir="sector"><option value="">All</option>${sectors.map((s) => `<option${s === D.sector ? " selected" : ""}>${esc(s)}</option>`).join("")}</select></label></div></div>
      <div class="grid g3">${rows.map((c) => `<button type="button" class="panel bizcard" data-action="open" data-id="${c.id}"><span class="row between" style="gap:6px"><b>${esc(c.name)}</b>${pill("good", "Verified")}</span><span class="small">${esc(c.profile.tagline || c.sector)}</span><span class="hint">${esc(c.sector)} · ${esc(c.town)}, ${esc(c.province)}</span></button>`).join("") || `<p class="muted">No businesses match.</p>`}</div>`;
  }
  function profileHTML(c) {
    const p = c.profile, wa = (p.whatsapp || "").replace(/\D/g, "").replace(/^0/, "");
    return `<div class="scrim" data-action="close"></div><aside class="drawer" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="dr-title">
      <div class="drawer-head"><div><div class="label">${esc(c.sector)} · ${esc(c.town)}, ${esc(c.province)}</div><h2 id="dr-title">${esc(c.name)}</h2><div class="row" style="gap:6px;margin-top:6px">${pill("good", "Verified on ProofPocket")}${pill("plain", "Trading since " + c.founded)}</div></div><button class="btn sm" data-action="close">Close</button></div>
      <div class="drawer-body">
        <div class="panel stack"><p>${esc(p.tagline)}</p><div class="label">Services</div><div class="list">${(p.services || "").split("\n").filter(Boolean).map((s) => `<div class="li"><span class="small">${esc(s)}</span></div>`).join("") || '<span class="hint">No services listed yet.</span>'}</div></div>
        <div class="grid g2"><div class="panel stack"><div class="label">Contact</div>${p.whatsapp ? `<span>WhatsApp <span class="mono">${esc(p.whatsapp)}</span></span>` : ""}${p.instagram ? `<span>Instagram ${esc(p.instagram)}</span>` : ""}<span class="hint">${esc(p.hours)}</span>${wa ? `<a class="btn sm primary" href="https://wa.me/27${esc(wa)}" target="_blank" rel="noopener" style="align-self:start">Message on WhatsApp</a>` : ""}</div>
          <div class="panel stack"><div class="label">What ProofPocket checked</div>${JOIN_DOCS.map((k) => `<span class="small">✓ ${esc(DOCS[k].name)}</span>`).join("")}<span class="hint">ProofPocket checks documents, not the quality of work.</span></div></div>
        <div class="panel stack"><div class="label">Something wrong?</div><p class="small">If this business asked you to pay in a way that felt unsafe, tell us.</p><button class="btn sm danger" data-action="report" data-id="${c.id}" style="align-self:start">Report this business</button></div>
      </div></aside>`;
  }

  // ================================================================ join flow
  function vJoin() {
    const g = ui.join, d = g.d, reg = d.registered === "yes", need = reg ? JOIN_DOCS : ["id", "addr"];
    const ws = (n, t) => `<span class="ws ${g.step === n ? "on" : g.step > n ? "done" : ""}"><b>${g.step > n ? "✓" : n}</b>${t}</span>`;
    let body = "";
    if (g.step === 1) {
      body = `<form class="panel stack" data-form="join1" novalidate><h2>About you and your business</h2><div class="form-grid">
        <label class="field"><span>Your name</span><input id="j-founder" name="founder" type="text" value="${esc(d.founder)}"></label>
        <label class="field"><span>Business name</span><input id="j-name" name="name" type="text" value="${esc(d.name)}"></label>
        <label class="field"><span>Type of business</span><select id="j-type" name="type">${Object.entries(TYPES).map(([k, t]) => `<option value="${k}"${k === d.type ? " selected" : ""}>${esc(t.label)}</option>`).join("")}</select></label>
        <label class="field"><span>Town or township</span><input id="j-town" name="town" type="text" value="${esc(d.town)}"></label>
        <label class="field"><span>Province</span><select id="j-province" name="province">${PROVINCES.map((p) => `<option${p === d.province ? " selected" : ""}>${p}</option>`).join("")}</select></label>
        <label class="field"><span>Area</span><select id="j-setting" name="setting">${["Township", "Urban", "Rural"].map((p) => `<option${p === d.setting ? " selected" : ""}>${p}</option>`).join("")}</select></label>
        <label class="field"><span>Incubator or NGO supporting you</span><select id="j-ngo" name="ngo"><option value="">None yet</option>${data.ngos.map((n) => `<option value="${n.id}"${n.id === d.ngo ? " selected" : ""}>${esc(n.name)}</option>`).join("")}</select></label>
      </div>
      <div class="stack" style="gap:6px"><span class="small muted" style="font-weight:600">Is the business registered with CIPC?</span><div class="row">
        <label class="radio-card${!reg ? " on" : ""}"><input type="radio" name="registered" value="no"${!reg ? " checked" : ""}><span><b>Not yet</b><span class="hint">Start as a Starter. We'll guide you through registering.</span></span></label>
        <label class="radio-card${reg ? " on" : ""}"><input type="radio" name="registered" value="yes"${reg ? " checked" : ""}><span><b>Yes</b><span class="hint">Upload your documents to get verified.</span></span></label></div></div>
      ${reg ? `<div class="form-grid"><label class="field"><span>Registered name</span><input id="j-legal" name="legal" type="text" value="${esc(d.legal)}"></label><label class="field"><span>CIPC number</span><input id="j-reg" name="reg" type="text" class="mono" value="${esc(d.reg)}" placeholder="2024/123456/07"></label></div>` : ""}
      ${g.err ? `<p class="err">${esc(g.err)}</p>` : ""}<div class="row between"><span class="hint">Takes about five minutes.</span><button class="btn primary" type="submit">Continue</button></div></form>`;
    } else if (g.step === 2) {
      body = `<div class="panel stack"><h2>${reg ? "Documents that prove you're a registered business" : "Confirm who you are"}</h2><p class="small muted">${reg ? "All four are checked by your adviser or a ProofPocket checker. Each file gets a fingerprint." : "Starters show an ID and proof of address so nobody can sign up as you. You'll add business documents later."}</p>
        ${need.map((k) => { const f = g.files[k]; return `<div class="upload"><div><b>${esc(DOCS[k].name)}</b>${f ? `<div class="small">${esc(f.name)}</div><div class="fp">Fingerprint ${esc(f.fp)}</div>` : `<div class="hint">PDF or photo, up to 5 MB</div>`}</div>${uploadBtn(k, f ? "Replace" : "Upload", "joinfile")}</div>`; }).join("")}
        ${g.err ? `<p class="err">${esc(g.err)}</p>` : ""}<div class="row between"><button class="btn" data-action="joinback">Back</button><button class="btn primary" data-action="joinnext">Continue</button></div></div>`;
    } else {
      body = `<div class="panel stack"><h2>Check and join</h2>
        <div class="grid g2"><div class="stack small"><div><span class="label">Business</span><div><b>${esc(reg && d.legal ? d.legal : d.name)}</b>${reg ? ` · <span class="mono">${esc(d.reg)}</span>` : ""}</div></div><div><span class="label">Owner</span><div>${esc(d.founder)}</div></div><div><span class="label">Type and area</span><div>${esc(TYPES[d.type].label)} · ${esc(d.town)}, ${esc(d.province)} (${esc(d.setting)})</div></div><div><span class="label">Supported by</span><div>${esc(ngo(d.ngo)?.name || "None yet")}</div></div><div><span class="label">Account</span><div>${reg ? "Verified, once documents are checked" : "Starter"}</div></div></div>
        <div class="list">${need.map((k) => `<div class="li"><span class="small">${esc(DOCS[k].name)}</span>${pill("good", "Attached")}</div>`).join("")}</div></div>
        <label class="check"><input id="j-agree" type="checkbox" data-change="agree"${g.agree ? " checked" : ""}>These documents belong to me and this business. I agree that my chosen incubator can see my records, and that verified funders see only what I allow under Privacy &amp; sharing.</label>
        ${g.err ? `<p class="err">${esc(g.err)}</p>` : ""}<div class="row between"><button class="btn" data-action="joinback">Back</button><button class="btn primary" data-action="joinsubmit">Join ProofPocket</button></div></div>`;
    }
    return `<div class="page-head"><div><div class="label">Join ProofPocket</div><h1>Start your business record</h1><p class="muted">Anyone can start. Registered businesses that pass the document check get the Verified badge, which funders, buyers and customers look for.</p></div></div>
      <div class="wizard-steps">${ws(1, "Details")}${ws(2, "Documents")}${ws(3, "Join")}</div>
      <div class="grid g3"><div class="span2 stack">${body}</div>
        <div class="panel stack"><h2>Starter or Verified?</h2><div class="list"><div class="li"><div class="li-main"><b>Starter</b><span class="small">Books, stock, payments, cash flow, the registration guide, and sharing posts from your own accounts.</span></div></div><div class="li"><div class="li-main"><b>Verified</b><span class="small">Everything in Starter, plus the badge, the public directory, funder matching, buyer introductions and tenders.</span></div></div></div><p class="hint">Both are free.</p></div></div>`;
  }

  // ================================================================ drawer (funders, NGOs, public)
  function drawerHTML(c) {
    if (ui.role === "directory") return profileHTML(c);
    const r = readiness(c), fl = flags(c), n = ngo(c.ngo.id), sums = series(c).slice(0, 5), inc5 = sums.reduce((s, m) => s + m.inc, 0), exp5 = sums.reduce((s, m) => s + m.exp, 0);
    const full = ui.role === "ngo" || c.consent.funders === "full";
    const f = funder(ui.me.funder), apps = ui.role === "funder" ? data.apps.filter((a) => a.companyId === c.id && a.funderId === f.id) : [];
    const recent = c.ledger.slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8);
    return `<div class="scrim" data-action="close"></div><aside class="drawer" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="dr-title">
      <div class="drawer-head"><div><div class="label">${esc(c.sector)} · ${esc(c.town)}, ${esc(c.province)}</div><h2 id="dr-title">${esc(c.name)}</h2>
        <div class="row" style="gap:6px;margin-top:6px">${levelPill(c)}${c.reg ? pill("plain", "CIPC " + c.reg) : ""}${pill("plain", c.setting)}${pill("plain", recordMonths(c) + " months on record")}</div></div><button class="btn sm" data-action="close" aria-label="Close">Close</button></div>
      <div class="drawer-body">
        <div class="grid g2">
          <div class="panel"><div class="row" style="gap:16px">${ring(r.score)}<div class="stack" style="gap:6px">${pill(scoreClass(r.score), scoreLabel(r.score))}<span class="small muted">${verifiedCount(c)} of ${Object.keys(DOCS).length} documents checked</span></div></div></div>
          <div class="panel grid g2" style="gap:10px"><div class="stat"><span class="label">Income, 5 months</span><span class="v" style="font-size:1.1rem">${R(inc5)}</span></div><div class="stat"><span class="label">Avg monthly profit</span><span class="v" style="font-size:1.1rem">${R((inc5 - exp5) / Math.max(1, sums.filter((m) => m.inc + m.exp > 0).length))}</span></div><div class="stat"><span class="label">Cash on hand</span><span class="v" style="font-size:1.1rem">${R(cashNow(c))}</span></div><div class="stat"><span class="label">People</span><span class="v" style="font-size:1.1rem">${c.employees}</span></div></div>
        </div>
        ${fl.length ? `<div class="panel"><h3>Flags</h3><div class="row" style="gap:6px">${fl.map((x) => pill(x.level, x.text)).join("")}</div></div>` : ""}
        <div class="panel"><h3>Money in and out</h3>${barChart(series(c))}</div>
        ${full ? `<div class="panel" style="padding:0"><h3 style="padding:16px 18px 8px">Latest entries</h3><div class="table-wrap flush"><table><tbody>${recent.map((e) => `<tr><td class="num">${shortDate(e.date)}</td><td>${esc(e.note)}${e.personal ? " " + pill("warn", "Personal") : ""}</td><td class="small">${esc(e.method)}</td><td class="r num ${e.type === "in" ? "in" : ""}">${e.type === "in" ? "+" : "−"}${R(e.amount)}</td></tr>`).join("") || `<tr><td class="muted">No entries.</td></tr>`}</tbody></table></div></div>` : `<div class="notice info"><span class="ico">i</span><span class="small">This founder shares a summary only. Individual book entries are private.</span></div>`}
        <div class="grid g2"><div class="panel"><h3>Documents</h3><div class="list">${Object.keys(DOCS).map((k) => `<div class="li"><span class="small">${esc(DOCS[k].name)}</span>${docPill(c.docs[k])}</div>`).join("")}</div></div><div class="panel"><h3>Bookkeeping health</h3>${checklist(r.items.filter((i) => i.group === "Bookkeeping"))}</div></div>
        ${ui.role === "funder" ? funderDrawerPart(c, apps, f) : ""}
        <div class="panel stack"><div class="panel-head" style="margin:0"><h3>Incubator support</h3><span class="small muted">${esc(n?.name || "No incubator")}</span></div>${steps(c.ngo.stage)}
          ${ui.role === "ngo" && n ? `<div class="form-grid"><label class="field"><span>Adviser</span><select id="adv-${c.id}" data-change="adviser" data-id="${c.id}"><option value="">Not assigned</option>${n.advisers.map((a) => `<option${a === c.ngo.adviser ? " selected" : ""}>${esc(a)}</option>`).join("")}</select></label><div class="row">${c.ngo.stage < STAGES.length - 1 ? `<button class="btn primary" data-action="advance" data-id="${c.id}">Move to ${esc(STAGES[c.ngo.stage + 1])}</button>` : pill("good", "In monitoring")}${c.ngo.stage > 0 ? `<button class="btn" data-action="stageback" data-id="${c.id}">Back a stage</button>` : ""}</div></div>` : `<span class="small">Adviser: ${esc(c.ngo.adviser || "not assigned")}</span>`}
          ${c.ngo.log.length ? `<div class="timeline">${c.ngo.log.map((l) => `<div class="tl"><span class="when">${shortDate(l.date)}</span><span><b>${esc(l.type)}</b><br><span class="small muted">${esc(l.note)}</span></span></div>`).join("")}</div>` : `<p class="small muted">No support logged yet.</p>`}</div>
        <div class="panel"><h3>Activity</h3>${timeline(c.activity)}</div>
      </div></aside>`;
  }
  function funderDrawerPart(c, apps, f) {
    const open = f.programmes.filter((p) => !apps.some((a) => a.programmeId === p.id));
    return `<div class="panel stack"><h3>Applications to ${esc(f.name)}</h3>
      ${apps.length ? apps.map((a) => { const pr = programme(a.programmeId), last = a.offers[a.offers.length - 1], done = a.status === "Approved" || a.status === "Declined";
        return `<div class="panel" style="background:var(--surface-2)"><div class="panel-head"><div><b>${esc(pr.p.name)}</b><div class="hint">Requested ${R(a.requested)} · current offer ${R(last.amount)}</div></div>${statusPill(a.status)}</div>
          ${a.reasonAsked ? `<div class="notice warn" style="margin-bottom:8px"><span class="ico">?</span><span class="small">The founder asked why the offer changed. Add a reason with your next change.</span></div>` : ""}${offerHistory(a)}${a.statusReason ? `<p class="small" style="margin-top:6px">${esc(a.statusReason)}</p>` : ""}
          ${done ? "" : `<form class="form-grid" data-form="offer" data-app="${a.id}" novalidate style="margin-top:10px"><label class="field"><span>New offer (R)</span><input id="of-amt-${a.id}" name="amount" type="number" min="0" value="${last.amount}"></label><label class="field" style="grid-column:span 2"><span>Reason the founder will see</span><input id="of-why-${a.id}" name="reason" type="text" placeholder="e.g. Quarterly budget reduced by 30%"></label>
            <div class="row" style="grid-column:1/-1"><button class="btn sm" type="submit">Change offer</button><button class="btn sm primary" type="button" data-action="approve" data-app="${a.id}">Approve current offer</button><button class="btn sm danger" type="button" data-action="decline" data-app="${a.id}">Decline</button></div><p class="err" id="of-err-${a.id}" hidden></p></form>`}</div>`; }).join("") : `<p class="small muted">No applications from this company yet.</p>`}
      ${open.length ? `<div class="row" style="align-items:end"><label class="field" style="flex:1"><span>Invite to apply</span><select id="inv-${c.id}">${open.map((p) => { const g = progCheck(c, p); return `<option value="${p.id}">${esc(p.name)} · ${g.length ? "still needs " + g.length + " thing" + (g.length > 1 ? "s" : "") : "qualifies now"}</option>`; }).join("")}</select></label><button class="btn" data-action="invite" data-id="${c.id}">Send invite</button></div>` : ""}</div>`;
  }

  // ================================================================ render
  const VIEWS = {
    founder: { home: vHome, start: vStart, books: vBooks, stock: vStock, payments: vPayments, cashflow: vCashflow, markets: vMarkets, funding: vFunding, procurement: vProcurement, protection: vProtection, privacy: vPrivacy },
    funder: { pipeline: funderPipeline, applications: funderApplications, programmes: funderProgrammes },
    ngo: { cohort: ngoCohort, verify: ngoVerify, attention: ngoAttention, support: ngoSupport },
    directory: { browse: vDirectory },
    join: { start: vJoin },
  };
  function render() {
    renderTop(); renderRail();
    const el = document.getElementById("view");
    if (ui.role === "funder" && !funder(ui.me.funder).setup) el.innerHTML = funderSetup(funder(ui.me.funder));
    else { const fn = VIEWS[ui.role][ui.view[ui.role]] || Object.values(VIEWS[ui.role])[0]; el.innerHTML = fn(company(ui.me.founder)); }
    drawQRs(); renderDrawer();
  }
  function renderDrawer() {
    const root = document.getElementById("drawer-root"), c = ui.drawer && company(ui.drawer);
    root.innerHTML = ui.pay ? payPageHTML() : c && ["funder", "ngo", "directory"].includes(ui.role) ? drawerHTML(c) : "";
    document.body.style.overflow = root.innerHTML ? "hidden" : "";
  }
  function drawQRs() { document.querySelectorAll(".qrbox[data-text]").forEach((el) => drawQR(el, el.dataset.text)); }
  function drawQR(el, text) {
    el.innerHTML = "";
    if (window.QRCode) {
      try { new window.QRCode(el, { text, width: 132, height: 132, colorDark: "#181C27", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M }); return; } catch (e) { /* fall through */ }
    }
    el.innerHTML = `<span class="hint mono" style="word-break:break-all">${esc(text)}</span>`;
  }
  let toastTimer;
  function toast(msg) { const r = document.getElementById("toast-root"); r.innerHTML = `<div class="toast">${esc(msg)}</div>`; clearTimeout(toastTimer); toastTimer = setTimeout(() => { r.innerHTML = ""; }, 3200); }
  function commit(msg) { save(); render(); if (msg) toast(msg); }
  function setRole(role) { ui.role = role; ui.drawer = null; ui.pay = null; try { history.replaceState(null, "", "#" + role); } catch (e) { /* ignore */ } render(); window.scrollTo(0, 0); }

  // ================================================================ files & verification
  async function fingerprint(file) {
    try { const h = await crypto.subtle.digest("SHA-256", await file.arrayBuffer()); return Array.from(new Uint8Array(h)).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join(""); }
    catch (e) { let h = 2166136261; const s = file.name + file.size + file.lastModified; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16).padStart(8, "0") + (file.size >>> 0).toString(16).padStart(8, "0"); }
  }
  // Companies with an incubator wait for their adviser (see Document checks). Others get a simulated ProofPocket checker.
  function routeCheck(c, k) {
    if (ngo(c.ngo.id)) return;
    setTimeout(() => { const x = company(c.id); if (!x || x.docs[k] !== "pending") return; approveDoc(x, k, "ProofPocket checker"); commit(`${DOCS[k].name} checked`); }, 2500);
  }
  function approveDoc(c, k, by) {
    const was = isVerified(c);
    c.docs[k] = "verified"; addActivity(c, `${DOCS[k].name} approved by ${by}.`);
    if (!was && isVerified(c)) { addActivity(c, "Verified on ProofPocket. Listed in the public directory."); c.messages.unshift({ id: uid("m"), from: "ProofPocket", address: "Verified", verified: true, date: iso(TODAY), text: "You're verified. Funders, buyers and customers can now find you.", flags: [], status: "open" }); }
  }

  // ================================================================ events
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("[data-action]"); if (!t) return;
    const a = t.dataset.action, me = company(ui.me.founder);
    if (t.tagName === "A" && a !== "shared") ev.preventDefault();
    switch (a) {
      case "role": setRole(t.dataset.role); break;
      case "nav": ui.view[ui.role] = t.dataset.view; ui.entryWarn = ""; render(); window.scrollTo(0, 0); break;
      case "open": ui.drawer = t.dataset.id; renderDrawer(); document.querySelector(".drawer")?.focus(); break;
      case "close": ui.drawer = null; renderDrawer(); break;
      case "reset": try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } data = seed(); ui.me = { founder: "c1", funder: "f1", ngo: "n1" }; ui.drawer = null; ui.join = freshJoin(); commit("Example data restored"); break;
      case "etype": ui.entryType = t.dataset.val; ui.entryWarn = ""; render(); break;
      case "repaid": { const e = me.ledger.find((x) => x.id === t.dataset.id); if (e) { e.personal = false; e.note = (e.note || "") + " (paid back)"; addActivity(me, `Personal purchase of ${R(e.amount)} paid back to the business.`); commit("Marked as paid back"); } break; }
      case "inboxok": case "inboxpersonal": { const x = me.inbox.find((i) => i.id === t.dataset.id); if (!x) break; const cat = document.getElementById("inbox-cat-" + x.id)?.value || "Other expense";
        me.ledger.push({ id: uid("e"), date: x.date, type: x.type, amount: x.amount, method: /PAYSHAP/.test(x.desc) ? "PayShap" : /POS/.test(x.desc) ? "Card machine" : "Bank EFT", cat: a === "inboxpersonal" ? "Other expense" : cat, note: x.desc, personal: a === "inboxpersonal", receipt: true });
        me.inbox = me.inbox.filter((i) => i.id !== x.id); commit(a === "inboxpersonal" ? "Added and marked personal" : "Added to your books"); break; }
      case "syncbank": { const n = Math.floor(Math.random() * 3) + 1; for (let i = 0; i < n; i++) { const isIn = Math.random() > 0.4; me.inbox.push({ id: uid("i"), date: iso(TODAY), desc: isIn ? `PAYSHAP CR ${["MOKOENA L", "DLAMINI S", "NKOSI P"][i % 3]}` : `POS PURCHASE ${["SHOPRITE", "BUILDERS", "CHECKERS"][i % 3]}`, amount: isIn ? 150 + Math.round(Math.random() * 600) : 80 + Math.round(Math.random() * 400), type: isIn ? "in" : "out" }); }
        commit(`${n} new bank transaction${n > 1 ? "s" : ""}. Sort ${n > 1 ? "them" : "it"} in Bookkeeping.`); break; }
      case "reqpaid": { const q = me.requests.find((x) => x.ref === t.dataset.ref); if (q) { q.status = "Paid"; me.ledger.push({ id: uid("e"), date: iso(TODAY), type: "in", amount: q.amount, method: t.dataset.method, cat: "Services", note: `${q.what || "Payment"} · ${q.client} · ${q.ref}`, personal: false, receipt: t.dataset.method !== "Cash" }); addActivity(me, `Payment ${q.ref} received (${R(q.amount)}, ${t.dataset.method}).`); commit("Payment added to your books"); } break; }
      case "showqr": { const box = document.getElementById("qr-" + t.dataset.ref); if (box) { box.hidden = !box.hidden; if (!box.hidden) drawQR(box, payLink(t.dataset.ref)); } break; }
      case "scan": ui.pay = { cid: me.id, ref: t.dataset.ref, err: "" }; renderDrawer(); document.querySelector(".paypage")?.focus(); break;
      case "closepay": ui.pay = null; renderDrawer(); break;
      case "copytext": { const v = t.dataset.text; try { navigator.clipboard.writeText(v).then(() => toast("Copied"), () => toast(v)); } catch (e) { toast(v); } break; }
      case "popok": case "popno": { const q = me.requests.find((x) => x.ref === t.dataset.ref); if (!q || !q.pop) break;
        if (a === "popok") { q.status = "Paid"; me.ledger.push({ id: uid("e"), date: q.pop.date, type: "in", amount: Number(q.pop.amount), method: q.pop.method, cat: "Services", note: `${q.what || "Payment"} · ${q.client} · ${q.ref} · proof of payment attached`, personal: false, receipt: true, popFp: q.pop.fp }); addActivity(me, `Confirmed ${R(q.pop.amount)} from ${q.client} (${q.ref}) in the bank. Proof of payment attached.`); commit("Confirmed and added to your books with the proof attached"); }
        else { q.status = "Not received"; q.attempts = (q.attempts || 0) + 1; q.lastPop = q.pop; q.pop = null; addActivity(me, `Proof of payment for ${q.ref} rejected: money not in the account.`);
          if (q.attempts >= 2) me.messages.unshift({ id: uid("m"), from: `${q.client} (client)`, address: `Payment request ${q.ref}`, verified: false, date: iso(TODAY), text: `Sent proof of payment twice for ${R(q.amount)}, but the money never arrived.`, flags: ["Possible fake proof of payment", "Don't hand over goods until the money shows in your bank"], status: "open" });
          commit(q.attempts >= 2 ? "Marked not received. Flagged as a possible fake proof of payment." : "Marked not received. The client can upload proof again."); }
        break; }
      case "addsupplier": { const nm = document.getElementById("ns-name")?.value.trim(), bk = document.getElementById("ns-bank")?.value.trim(); if (!nm || !bk) { toast("Add the supplier's name and bank"); break; } me.suppliers.push({ id: uid("s"), name: nm, bank: bk, pending: null }); commit("Supplier saved"); break; }
      case "simchange": { const s = me.suppliers[0]; if (!s) { toast("Save a supplier under Payments first"); break; } s.pending = { bank: "New bank ••" + Math.floor(1000 + Math.random() * 9000), date: iso(TODAY) }; addActivity(me, `${s.name} sent new bank details. Payments on hold.`); commit("Change received. Payments to this supplier are on hold."); break; }
      case "supok": { const s = me.suppliers.find((x) => x.id === t.dataset.id); s.bank = s.pending.bank; s.pending = null; addActivity(me, `Confirmed ${s.name}'s new bank details by phone.`); commit("New details confirmed"); break; }
      case "supreject": { const s = me.suppliers.find((x) => x.id === t.dataset.id); s.pending = null; addActivity(me, `Rejected a bank detail change for ${s.name}.`); commit("Change rejected. Old details kept."); break; }
      case "stockuse": case "stockbuy": { const s = me.stock.find((x) => x.id === t.dataset.id); if (!s) break;
        if (a === "stockuse") { s.qty = Math.max(0, +(s.qty - 1).toFixed(2)); commit(`${s.name}: ${s.qty} ${s.unit} left`); }
        else { const add = Math.max(1, s.reorder * 2 - s.qty); s.qty = +(s.qty + add).toFixed(2); me.ledger.push({ id: uid("e"), date: iso(TODAY), type: "out", amount: Math.round(add * s.cost), method: "Bank EFT", cat: "Stock and materials", note: `Restock ${s.name} (${add} ${s.unit})`, personal: false, receipt: true }); commit(`Restocked ${s.name}; ${R(add * s.cost)} added to your books`); }
        break; }
      case "apply": { const pid = t.dataset.prog, pr = programme(pid), amt = Number(document.getElementById("amt-" + pid)?.value || 0);
        if (amt < pr.p.min || amt > pr.p.max) { toast(`Enter an amount between ${R(pr.p.min)} and ${R(pr.p.max)}`); break; }
        data.apps.push({ id: uid("ap"), companyId: me.id, funderId: pr.f.id, programmeId: pid, requested: amt, date: iso(TODAY), status: "Submitted", statusReason: "", offers: [{ amount: amt, date: iso(TODAY), reason: "Requested amount" }] });
        addActivity(me, `Applied to ${pr.p.name} for ${R(amt)}.`); commit(`Application sent to ${pr.f.name}`); break; }
      case "askreason": { const ap = data.apps.find((x) => x.id === t.dataset.app); if (ap) { ap.reasonAsked = true; addActivity(me, "Asked the funder to explain the change to the offer."); commit("Request sent to the funder"); } break; }
      case "interest": { me.interest.push(t.dataset.id); addActivity(me, `Expressed interest in "${data.tenders.find((x) => x.id === t.dataset.id).title}".`); commit("Interest sent with your checked documents and track record"); break; }
      case "intro": { me.intros.push(t.dataset.id); addActivity(me, `Asked for an introduction to ${data.buyers.find((x) => x.id === t.dataset.id).name}.`); commit("Your adviser will arrange the introduction"); break; }
      case "shared": { const po = me.posts.find((x) => x.id === t.dataset.id); if (po && !po.shared.includes(t.dataset.net)) { po.shared.push(t.dataset.net); save(); setTimeout(render, 50); } break; }
      case "copylink": { const link = "https://" + profileUrl(me); try { navigator.clipboard.writeText(link).then(() => toast("Profile link copied"), () => toast(link)); } catch (e) { toast(link); } break; }
      case "msg": { const m = me.messages.find((x) => x.id === t.dataset.id); if (m) { m.status = t.dataset.do === "block" ? "blocked" : "safe"; addActivity(me, t.dataset.do === "block" ? `Reported and blocked "${m.from}".` : `Marked "${m.from}" as genuine.`); commit(t.dataset.do === "block" ? "Reported. Other founders will be warned about this sender." : "Marked as genuine"); } break; }
      case "togglereq": { const pr = programme(t.dataset.prog), k = t.dataset.doc, i = pr.p.req.indexOf(k); if (i >= 0) pr.p.req.splice(i, 1); else pr.p.req.push(k); commit("Requirements updated; founders see the change"); break; }
      case "newprog": funder(ui.me.funder).setup = false; render(); break;
      case "cancelsetup": funder(ui.me.funder).setup = true; render(); break;
      case "approve": case "decline": { const ap = data.apps.find((x) => x.id === t.dataset.app), c = company(ap.companyId), why = document.getElementById("of-why-" + ap.id)?.value.trim();
        if (a === "decline" && !why) { const e = document.getElementById("of-err-" + ap.id); if (e) { e.textContent = "Add a reason before declining. The founder will see it."; e.hidden = false; } break; }
        ap.status = a === "approve" ? "Approved" : "Declined"; ap.statusReason = why || "Approved at the current offer.";
        addActivity(c, `${funder(ap.funderId).name} ${a === "approve" ? "approved" : "declined"} the ${programme(ap.programmeId).p.name} application.`); commit(a === "approve" ? "Application approved" : "Application declined"); break; }
      case "invite": { const c = company(t.dataset.id), pr = programme(document.getElementById("inv-" + c.id).value); addActivity(c, `${pr.f.name} invited you to apply to ${pr.p.name}.`); c.messages.unshift({ id: uid("m"), from: pr.f.name, address: "Verified funder", verified: true, date: iso(TODAY), text: `You're invited to apply to ${pr.p.name}. Check Funding readiness for what's needed.`, flags: [], status: "open" }); commit("Invite sent"); break; }
      case "advance": case "stageback": { const c = company(t.dataset.id); c.ngo.stage = Math.max(0, Math.min(STAGES.length - 1, c.ngo.stage + (a === "advance" ? 1 : -1))); addActivity(c, `Support stage: ${STAGES[c.ngo.stage]}.`); commit(`Moved to ${STAGES[c.ngo.stage]}`); break; }
      case "docapprove": { const c = company(t.dataset.id), k = t.dataset.doc, was = isVerified(c); approveDoc(c, k, c.ngo.adviser || ngo(c.ngo.id).name); c.ngo.log.unshift({ date: iso(TODAY), type: "Document check", note: `Approved ${DOCS[k].name}.` }); commit(!was && isVerified(c) ? `${c.name} is now Verified` : "Approved"); break; }
      case "docreject": { const c = company(t.dataset.id), k = t.dataset.doc, why = document.getElementById(`rej-${c.id}-${k}`)?.value.trim(); if (!why) { toast("Add a reason so the founder knows what to fix"); break; }
        c.docs[k] = "missing"; delete c.fp[k]; delete c.files[k]; c.messages.unshift({ id: uid("m"), from: ngo(c.ngo.id).name, address: "Verified incubator", verified: true, date: iso(TODAY), text: `Please upload your ${DOCS[k].name} again: ${why}`, flags: [], status: "open" }); addActivity(c, `${DOCS[k].name} sent back: ${why}`); commit("Sent back to the founder"); break; }
      case "report": data.reports.push({ companyId: t.dataset.id, date: iso(TODAY) }); save(); toast("Thanks. ProofPocket will review this business within two working days."); break;
      case "joinback": ui.join.step = Math.max(1, ui.join.step - 1); ui.join.err = ""; render(); break;
      case "joinnext": { const need = ui.join.d.registered === "yes" ? JOIN_DOCS : ["id", "addr"], miss = need.filter((k) => !ui.join.files[k]); if (miss.length) { ui.join.err = `Attach: ${miss.map((k) => DOCS[k].name).join(", ")}.`; render(); break; } ui.join.step = 3; ui.join.err = ""; render(); break; }
      case "joinsubmit": {
        const g = ui.join; if (!g.agree) { g.err = "Tick the box to confirm before joining."; render(); break; }
        const d = g.d, reg = d.registered === "yes", id = uid("c"), need = reg ? JOIN_DOCS : ["id", "addr"];
        const c = { id, name: reg && d.legal ? d.legal : d.name, type: d.type, sector: TYPES[d.type].label, town: d.town, province: d.province, setting: d.setting, stage: "Early", founded: TODAY.getFullYear(), founder: d.founder, employees: 1, reg: reg ? d.reg : "",
          opening: 0, docs: docs(Object.fromEntries(need.map((k) => [k, "pending"]))), fp: Object.fromEntries(need.map((k) => [k, g.files[k].fp])), files: Object.fromEntries(need.map((k) => [k, g.files[k].name])),
          months: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], ledger: [], stock: [], suppliers: [], messages: [], alerts: [], requests: [], inbox: [], interest: [], intros: [], posts: [], consent: { funders: "summary" },
          profile: { tagline: "", services: "", whatsapp: "", instagram: "", hours: "" },
          ngo: { id: d.ngo || "", stage: 0, adviser: "", log: [] }, activity: [{ date: iso(TODAY), text: `Joined ProofPocket${reg ? "; documents sent for checking" : " as a Starter"}.` }] };
        data.companies.push(c); ui.me.founder = id; need.forEach((k) => routeCheck(c, k));
        ui.join = freshJoin(); ui.role = "founder"; ui.view.founder = "start"; try { history.replaceState(null, "", "#founder"); } catch (e) { /* ignore */ }
        commit(d.ngo ? `Welcome! ${ngo(d.ngo).name} will check your documents.` : "Welcome! A ProofPocket checker is reviewing your documents."); break;
      }
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && (ui.drawer || ui.pay)) { ui.drawer = null; ui.pay = null; renderDrawer(); }
    if (ev.key === "Enter" && ev.target.matches("tr[data-action='open']")) ev.target.click();
  });
  document.addEventListener("change", async (ev) => {
    const t = ev.target;
    if (t.dataset.filter && t.dataset.filter !== "q") { ui.filter[t.dataset.filter] = t.dataset.filter === "min" ? Number(t.value) : t.value; render(); return; }
    if (t.dataset.dir === "sector") { ui.dir.sector = t.value; render(); return; }
    if (t.name === "registered" && t.closest("[data-form='join1']")) { const fd = new FormData(t.form); Object.keys(ui.join.d).forEach((k) => { if (fd.has(k)) ui.join.d[k] = String(fd.get(k)); }); render(); return; }
    const k = t.dataset.change; if (!k) return;
    const me = company(ui.me.founder);
    if (k === "who") { ui.me[t.dataset.kind] = t.value; ui.drawer = null; ui.entryWarn = ""; commit(); }
    else if (k === "adviser") { const c = company(t.dataset.id); c.ngo.adviser = t.value; if (t.value && c.ngo.stage === 0) c.ngo.stage = 1; addActivity(c, t.value ? `Adviser ${t.value} assigned.` : "Adviser removed."); commit(t.value ? "Adviser assigned" : "Adviser removed"); }
    else if (k === "agree") { ui.join.agree = t.checked; ui.join.err = ""; }
    else if (k === "consent") { me.consent.funders = t.value; addActivity(me, `Funder sharing set to "${t.value}".`); commit("Sharing updated"); }
    else if ((k === "docfile" || k === "joinfile") && t.files && t.files[0]) {
      const file = t.files[0], key = t.dataset.doc;
      if (file.size > 5 * 1024 * 1024) { toast("Files must be 5 MB or smaller"); return; }
      const fp = await fingerprint(file);
      if (k === "joinfile") { ui.join.files[key] = { name: file.name, fp }; ui.join.err = ""; render(); return; }
      me.docs[key] = "pending"; me.fp[key] = fp; me.files[key] = file.name; addActivity(me, `Uploaded ${DOCS[key].name}.`); routeCheck(me, key);
      commit(ngo(me.ngo.id) ? `Uploaded. ${ngo(me.ngo.id).name} will check it.` : "Uploaded. Checking now.");
    }
  });
  document.addEventListener("input", (ev) => {
    const t = ev.target;
    const keep = (id) => { const pos = t.selectionStart; render(); const n = document.getElementById(id); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
    if (t.dataset.filter === "q") { ui.filter.q = t.value; keep("flt-q"); }
    if (t.dataset.dir === "q") { ui.dir.q = t.value; keep("dir-q"); }
    if (t.dataset.filter === "min") { ui.filter.min = Number(t.value); const lbl = t.closest(".field")?.querySelector("b"); if (lbl) lbl.textContent = t.value; }
  });
  document.addEventListener("submit", (ev) => {
    const f = ev.target, kind = f.dataset.form; if (!kind) return;
    ev.preventDefault();
    const fd = new FormData(f), me = company(ui.me.founder);
    if (kind === "entry") {
      const amount = Number(fd.get("amount"));
      if (!amount || amount <= 0) { ui.entryWarn = "Enter an amount greater than zero."; render(); return; }
      const note = String(fd.get("note") || "").trim(), date = String(fd.get("date") || iso(TODAY)), receipt = f.querySelector("#e-receipt")?.files?.length > 0;
      const dup = ui.entryType === "out" && !ui.entryWarn.startsWith("Possible duplicate") && me.ledger.find((e) => e.type === "out" && e.amount === amount && Math.abs(daysBetween(e.date, date)) <= 7);
      if (dup) { ui.entryWarn = `Possible duplicate: you paid ${R(amount)} for "${dup.note}" on ${shortDate(dup.date)}. Paying the same invoice twice is a common fraud. Press Save again if this is a new payment.`; render(); keepEntry(amount, fd); return; }
      const sid = fd.get("stock"), qty = Number(fd.get("qty") || 0);
      if (sid && qty > 0) { const s = me.stock.find((x) => x.id === sid); if (s) s.qty = Math.max(0, +(s.qty + (ui.entryType === "in" ? -qty : qty)).toFixed(2)); }
      me.ledger.push({ id: uid("e"), date, type: ui.entryType, amount, method: String(fd.get("method")), cat: String(fd.get("cat")), note, personal: ui.entryType === "out" && fd.get("personal") === "on", receipt });
      ui.entryWarn = ""; addActivity(me, `Recorded ${ui.entryType === "in" ? "income" : "an expense"} of ${R(amount)}.`); commit("Saved to your books");
    } else if (kind === "payreq") {
      const client = String(fd.get("client") || "").trim(), amount = Number(fd.get("amount")), rails = fd.getAll("rail").map(String);
      if (!client || !amount) { toast("Add the client's name and an amount"); return; }
      if (!rails.length) { toast("Choose at least one way to pay"); return; }
      const ref = "PP-" + Math.floor(1000 + Math.random() * 9000);
      me.requests.unshift({ ref, client, amount, what: String(fd.get("what") || "").trim(), rails, date: iso(TODAY), status: "Waiting", attempts: 0 });
      addActivity(me, `Payment request ${ref} created for ${client}.`); commit(`Request ${ref} created. Send the link on WhatsApp or show the QR code.`);
    } else if (kind === "paydetails") {
      me.pay = { bank: String(fd.get("bank") || "").trim(), accName: String(fd.get("accName") || "").trim(), accNo: String(fd.get("accNo") || "").trim(), shapId: String(fd.get("shapId") || "").trim() };
      addActivity(me, "Payment details updated."); commit("Payment details saved");
    } else if (kind === "pop") { submitPop(f, fd);
    } else if (kind === "supplierpay") {
      const s = me.suppliers.find((x) => x.id === fd.get("sup")), amount = Number(fd.get("amount"));
      if (!s || !amount) { toast("Choose a supplier and enter an amount"); return; }
      if (s.pending) { toast(`Payment blocked: ${s.name}'s bank details changed. Confirm by phone under Fraud protection first.`); return; }
      me.ledger.push({ id: uid("e"), date: iso(TODAY), type: "out", amount, method: "Bank EFT", cat: "Stock and materials", note: `${String(fd.get("what") || "Supplier payment").trim()} · ${s.name}`, personal: false, receipt: true });
      addActivity(me, `Paid ${s.name} ${R(amount)} to ${s.bank}.`); commit(`Paid ${s.name}. Recorded in your books.`);
    } else if (kind === "cashout") {
      const name = String(fd.get("name") || "").trim(), amount = Number(fd.get("amount"));
      if (!name || !amount) { toast("Add who you paid and the amount"); return; }
      const slip = fd.get("nophone") === "on" ? "S" + Math.floor(10000 + Math.random() * 90000) : "";
      me.ledger.push({ id: uid("e"), date: iso(TODAY), type: "out", amount, method: "Cash", cat: me.type === "recycling" ? "Collector payments" : "Other expense", note: `${String(fd.get("what") || "Cash payment").trim()} · ${name}${slip ? " · slip " + slip : ""}`, personal: false, receipt: false });
      addActivity(me, `Cash payment of ${R(amount)} to ${name} recorded.`); commit(slip ? `Recorded. Give ${name} slip number ${slip}.` : "Cash payment recorded");
    } else if (kind === "stockadd") {
      const name = String(fd.get("name") || "").trim(); if (!name) { toast("Name the item"); return; }
      me.stock.push({ id: uid("s"), name, unit: String(fd.get("unit") || "").trim() || "units", qty: Number(fd.get("qty") || 0), reorder: Number(fd.get("reorder") || 0), cost: Number(fd.get("cost") || 0) }); commit("Item added");
    } else if (kind === "profile") {
      Object.assign(me.profile, { tagline: String(fd.get("tagline") || "").trim(), services: String(fd.get("services") || "").trim(), whatsapp: String(fd.get("whatsapp") || "").trim(), instagram: String(fd.get("instagram") || "").trim(), hours: String(fd.get("hours") || "").trim() });
      commit("Profile saved");
    } else if (kind === "post") {
      const text = String(fd.get("text") || "").trim(); if (!text) { toast("Write something first"); return; }
      const feature = ev.submitter && ev.submitter.value === "feature" ? "requested" : "none";
      me.posts.unshift({ id: uid("po"), text, date: iso(TODAY), shared: [], feature });
      commit(feature === "requested" ? "Saved. ProofPocket reviews feature requests weekly." : "Saved. Use the buttons to share it from your own accounts.");
    } else if (kind === "cipcno") {
      const reg = String(fd.get("reg") || "").trim(); if (!/^\d{4}\/\d{6}\/\d{2}$/.test(reg)) { toast("CIPC numbers look like 2026/123456/07"); return; }
      me.reg = reg; addActivity(me, `CIPC number ${reg} added.`); commit("CIPC number saved. Upload the certificate next.");
    } else if (kind === "offer") {
      const ap = data.apps.find((x) => x.id === f.dataset.app), amount = Number(fd.get("amount")), reason = String(fd.get("reason") || "").trim(), err = document.getElementById("of-err-" + ap.id);
      if (!reason) { err.textContent = "Add a reason. Founders see every change to their offer."; err.hidden = false; return; }
      ap.offers.push({ amount, date: iso(TODAY), reason }); ap.status = "Offer made"; ap.reasonAsked = false;
      addActivity(company(ap.companyId), `${funder(ap.funderId).name} changed the offer to ${R(amount)}: ${reason}`); commit("Offer updated and shared with the founder");
    } else if (kind === "fsetup") {
      const fu = funder(ui.me.funder), name = String(fd.get("name") || "").trim(), min = Number(fd.get("min")), max = Number(fd.get("max")), err = document.getElementById("fs-err");
      if (!name || !max || min > max) { err.textContent = "Add a programme name, and make sure the smallest amount isn't bigger than the largest."; err.hidden = false; return; }
      fu.kind = String(fd.get("kind")); fu.programmes.push({ id: uid("p"), name, min, max, budget: Number(fd.get("budget") || 0), used: 0, req: fd.getAll("req").map(String), minMonths: Number(fd.get("minMonths") || 0), minScore: Number(fd.get("minScore") || 0) });
      fu.setup = true; fu.name = fu.name.replace(" (new)", ""); ui.view.funder = "pipeline"; commit("Requirements saved. Founders can see them now.");
    } else if (kind === "ngolog") {
      const c = company(String(fd.get("company"))), note = String(fd.get("note") || "").trim(); if (!c || !note) { toast("Add a note about the support"); return; }
      c.ngo.log.unshift({ date: iso(TODAY), type: String(fd.get("type")), note }); addActivity(c, `${ngo(ui.me.ngo).name}: ${fd.get("type")}.`); commit("Support logged");
    } else if (kind === "join1") {
      const d = ui.join.d; Object.keys(d).forEach((k) => { if (fd.has(k)) d[k] = String(fd.get(k) || "").trim(); });
      if (!d.founder || !d.name || !d.town) { ui.join.err = "Add your name, the business name and your town."; render(); return; }
      if (d.registered === "yes" && !/^\d{4}\/\d{6}\/\d{2}$/.test(d.reg)) { ui.join.err = "The CIPC number should look like 2024/123456/07."; render(); return; }
      ui.join.step = 2; ui.join.err = ""; render();
    }
  });
  async function submitPop(f, fd) {
    const c = company(ui.pay.cid), q = c.requests.find((r) => r.ref === ui.pay.ref), file = f.querySelector("#pop-file")?.files?.[0];
    const amount = Number(fd.get("amount")), payer = String(fd.get("payer") || "").trim();
    if (!payer || !amount) { ui.pay.err = "Add your name and the amount you paid."; renderDrawer(); return; }
    if (!file) { ui.pay.err = "Attach your proof of payment (a screenshot or PDF from your bank)."; renderDrawer(); return; }
    if (file.size > 5 * 1024 * 1024) { ui.pay.err = "The file must be 5 MB or smaller."; renderDrawer(); return; }
    const fp = await fingerprint(file);
    q.pop = { payer, amount, date: String(fd.get("date") || iso(TODAY)), method: String(fd.get("method")), usedRef: fd.get("usedRef") === "on", file: file.name, fp, at: iso(TODAY) };
    q.status = "Checking"; ui.pay.err = "";
    addActivity(c, `${payer} uploaded proof of payment for ${q.ref} (${R(amount)}).`);
    commit("Proof sent to the business. They'll confirm once the money is in.");
  }
  function keepEntry(amount, fd) {
    const set = (id, v) => { const n = document.getElementById(id); if (n && v != null) n.value = v; };
    set("e-amount", amount); set("e-method", fd.get("method")); set("e-cat", fd.get("cat")); set("e-date", fd.get("date")); set("e-note", fd.get("note")); set("e-stock", fd.get("stock")); set("e-qty", fd.get("qty"));
    const p = document.getElementById("e-personal"); if (p) p.checked = fd.get("personal") === "on";
  }

  // ================================================================ boot
  load();
  const h = (location.hash || "").replace("#", "");
  if (VIEWS[h]) ui.role = h;
  if (!company(ui.me.founder)) ui.me.founder = data.companies[0].id;
  if (!funder(ui.me.funder)) ui.me.funder = data.funders[0].id;
  if (!ngo(ui.me.ngo)) ui.me.ngo = data.ngos[0].id;
  data.companies.forEach((c) => Object.keys(c.docs).forEach((k) => { if (c.docs[k] === "pending" && !ngo(c.ngo.id)) routeCheck(c, k); }));
  render();
  window.addEventListener("load", drawQRs);
})();
