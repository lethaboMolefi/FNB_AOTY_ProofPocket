import { z } from "zod";
import { IN_CATS, OUT_CATS, PAY_METHOD_KEYS, type PayMethod } from "../constants";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-24");
const rand = z.number({ message: "Enter an amount" }).positive("Enter an amount greater than zero.").max(9_999_999_999).multipleOf(0.01);
const qty = z.number().min(0).max(1_000_000).multipleOf(0.01);
const allCats = [...IN_CATS, ...OUT_CATS] as string[];

export const entrySchema = z.object({
  clientUuid: z.string().uuid(),
  direction: z.enum(["in", "out"]),
  amount: rand,
  method: z.enum(PAY_METHOD_KEYS as [PayMethod, ...PayMethod[]]),
  category: z.string().refine((c) => allCats.includes(c), "Choose a category"),
  date: day,
  note: z.string().trim().max(200).default(""),
  isPersonal: z.boolean().default(false),
  stockItemId: z.string().uuid().nullable().optional(),
  qty: qty.positive().nullable().optional(),
  receiptFileId: z.string().uuid().nullable().optional(),
  /** The founder saw the duplicate-payment warning and pressed Save again. */
  confirmDuplicate: z.boolean().default(false),
}).superRefine((e, ctx) => {
  const cats: readonly string[] = e.direction === "in" ? IN_CATS : OUT_CATS;
  if (!cats.includes(e.category)) ctx.addIssue({ code: "custom", path: ["category"], message: "Choose a category for this kind of entry" });
  if (e.isPersonal && e.direction !== "out") ctx.addIssue({ code: "custom", path: ["isPersonal"], message: "Only money out can be a personal purchase" });
});
export type EntryInput = z.infer<typeof entrySchema>;

export const voidSchema = z.object({ reason: z.string().trim().min(3, "Say why this entry is wrong").max(200) });

export const stockItemSchema = z.object({
  name: z.string().trim().min(1, "Name the item").max(80),
  unit: z.string().trim().max(30).default("units"),
  qty: qty.default(0),
  reorderAt: qty.default(0),
  cost: z.number().min(0).max(10_000_000).multipleOf(0.01).default(0),
  /** What a client pays for one (used when asking a client to pay for stock). */
  price: z.number().min(0).max(10_000_000).multipleOf(0.01).default(0),
});
export const stockEditSchema = stockItemSchema.partial().omit({ qty: true });
export const clientUuidSchema = z.object({ clientUuid: z.string().uuid() });

export const historyMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Choose a month"),
  moneyIn: z.number().min(0).max(9_999_999_999).multipleOf(0.01),
  moneyOut: z.number().min(0).max(9_999_999_999).multipleOf(0.01),
});

export const settingsSchema = z.object({
  openingBalance: z.number().min(-9_999_999_999).max(9_999_999_999).multipleOf(0.01),
  openingBalanceDate: day,
  employees: z.number().int().min(1).max(100_000),
  foundedYear: z.number().int().min(1950).max(2100),
  stage: z.enum(["Early", "Growth"]),
});

export const statementImportSchema = z.object({
  fileId: z.string().uuid(),
  /** A password-protected PDF statement's password. Used once to open the file; never stored or logged. */
  password: z.string().max(100).optional(),
  /** When the columns couldn't be recognised, the founder picks them. Zero-based column numbers. */
  mapping: z.object({
    date: z.number().int().min(0),
    description: z.number().int().min(0),
    amount: z.number().int().min(0).optional(),
    moneyIn: z.number().int().min(0).optional(),
    moneyOut: z.number().int().min(0).optional(),
  }).optional(),
});
export const statementLineActionSchema = z.object({
  action: z.enum(["add", "personal", "skip"]),
  category: z.string().optional(),
});
