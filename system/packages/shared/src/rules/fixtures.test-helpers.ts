// Test fixtures built from seed() in v2/app.js, with "today" fixed at 2026-10-24.
import type { DocState, DocType, PayMethod } from "../constants";
import type { CompanySnapshot, EntryLite } from "../types";
import { emptyDocStates } from "./verification";

export const TODAY = "2026-10-24";

/** inMonth(off): a day in the current month, `off` days before today but not before the 1st. */
const inMonth = (off: number) => `2026-10-${String(Math.max(1, 24 - off)).padStart(2, "0")}`;

type Row = [number, "in" | "out", number, PayMethod, string, string, Partial<EntryLite>?];
const ledger = (rows: Row[]): EntryLite[] =>
  rows.map(([off, direction, amount, method, category, note, extra]) => ({ date: inMonth(off), direction, amount, method, category, note, isPersonal: false, ...extra }));

const docs = (map: Partial<Record<DocType, DocState>>) => ({ ...emptyDocStates(), ...map });

/** The five earlier months, May to September 2026. */
const history = (months: [number, number][]) =>
  months.map(([moneyIn, moneyOut], i) => ({ month: `2026-0${5 + i}`, moneyIn, moneyOut })).filter((m) => m.moneyIn + m.moneyOut > 0);

const V = "verified" as const;
const base = { paymentRequests: [], unverifiedOpenMessages: 0, pendingSupplierChanges: 0, offerChangedWithoutReason: false, openingBalanceDate: "2026-10-01" };

/** c1 Nala Nails & Lashes: the Starter salon. */
export const nala = (): CompanySnapshot => ({
  ...base,
  docs: docs({ id: V, addr: V }),
  openingBalance: 1400,
  history: history([[0, 0], [0, 0], [7600, 5600], [8800, 5900], [7900, 6400]]),
  entries: ledger([
    [12, "in", 450, "cash", "Services", "Lash lift"], [11, "in", 380, "card_machine", "Services", "Manicure x2"],
    [11, "out", 1250, "eft", "Stock and materials", "Gel polish restock"], [9, "in", 520, "cash", "Services", "Full set"],
    [9, "out", 640, "card_machine", "Other expense", "Groceries", { isPersonal: true }], [9, "in", 300, "payshap", "Services", "Manicure"],
  ]),
  stock: [
    { name: "Gel polish", qty: 3, reorderAt: 4, cost: 85 }, { name: "Lash glue", qty: 1, reorderAt: 2, cost: 120 },
    { name: "Nail tips", qty: 5, reorderAt: 2, cost: 60 }, { name: "Acetone", qty: 2, reorderAt: 1, cost: 45 },
  ],
  paymentRequests: [{ status: "checking" }, { status: "waiting" }],
  unverifiedOpenMessages: 1,
  pendingSupplierChanges: 1,
});

/** c2 ReKasi Plastics: CSD pending, offer cut to R28 000 with no reason. */
export const rekasi = (): CompanySnapshot => ({
  ...base,
  docs: docs({ cipc: V, id: V, bank: V, addr: V, tax: V, bplan: V, bbbee: V, csd: "pending" }),
  openingBalance: 6200,
  history: history([[6400, 7100], [9800, 8300], [11200, 9100], [14500, 10200], [12900, 11800]]),
  entries: ledger([
    [6, "in", 4200, "eft", "Sales", "300 pencil holders (deposit)"], [5, "out", 780, "cash", "Collector payments", "PET bottles, 156 kg · slip S20431"],
    [4, "out", 2400, "eft", "Equipment", "Shredder blade service"], [3, "out", 620, "cash", "Collector payments", "HDPE, 98 kg · slip S20457"],
    [2, "in", 1850, "payshap", "Sales", "Filament spools x5"],
  ]),
  stock: [{ name: "PET flakes", qty: 120, reorderAt: 50, cost: 4 }, { name: "Filament spools", qty: 14, reorderAt: 5, cost: 95 }],
  offerChangedWithoutReason: true,
});

/** c3 Mabele AgriLink: everything in place. */
export const mabele = (): CompanySnapshot => ({
  ...base,
  docs: docs({ cipc: V, id: V, bank: V, addr: V, tax: V, bplan: V, fin: V, bbbee: V, csd: V }),
  openingBalance: 52000,
  history: history([[41000, 33500], [38500, 34100], [44200, 35800], [46900, 36200], [48300, 37900]]),
  entries: ledger([
    [3, "in", 18400, "eft", "Services", "Platform fees, 46 farmers"], [2, "out", 22000, "eft", "Wages", "Staff payroll"],
    [2, "out", 9000, "eft", "Owner salary", "Director salary"], [1, "in", 12600, "eft", "Services", "Co-op transaction fees"],
  ]),
  stock: [],
});

/** c5 Mama Tau Catering: tax expired, books three weeks old, income down. */
export const mamaTau = (): CompanySnapshot => ({
  ...base,
  docs: docs({ cipc: V, id: V, bank: V, addr: V, tax: "expired", bplan: V }),
  openingBalance: 2300,
  history: history([[15200, 12900], [9800, 11400], [17600, 13100], [16400, 12800], [11900, 12600]]),
  entries: ledger([[21, "in", 3600, "eft", "Sales", "Funeral catering, 120 plates"], [21, "out", 2100, "cash", "Stock and materials", "Meat and veg"]]),
  stock: [
    { name: "Rice (10 kg bags)", qty: 2, reorderAt: 3, cost: 165 }, { name: "Cooking oil (5 L)", qty: 1, reorderAt: 2, cost: 140 },
    { name: "Takeaway boxes", qty: 6, reorderAt: 2, cost: 210 },
  ],
});
