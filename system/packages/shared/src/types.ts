import type { DocState, DocType, PayMethod, PaymentStatus } from "./constants";

export type DocStates = Record<DocType, DocState>;

/** The parts of a book entry the rules need. */
export interface EntryLite {
  date: string; // YYYY-MM-DD
  direction: "in" | "out";
  amount: number;
  category: string;
  method: PayMethod;
  isPersonal: boolean;
  note?: string;
  voided?: boolean;
}

/** Totals for an earlier month imported or typed in by the founder (monthly_history). */
export interface MonthTotals {
  month: string; // YYYY-MM
  moneyIn: number;
  moneyOut: number;
}

export interface StockLite {
  name: string;
  qty: number;
  reorderAt: number;
  cost: number;
}

/** Everything the readiness, flag and journey rules read about one company. */
export interface CompanySnapshot {
  docs: DocStates;
  entries: EntryLite[];
  history: MonthTotals[];
  stock: StockLite[];
  openingBalance: number;
  openingBalanceDate: string;
  paymentRequests: { status: PaymentStatus }[];
  unverifiedOpenMessages: number;
  pendingSupplierChanges: number;
  /** The latest offer on any of the company's applications changed the amount without a reason. */
  offerChangedWithoutReason: boolean;
}
