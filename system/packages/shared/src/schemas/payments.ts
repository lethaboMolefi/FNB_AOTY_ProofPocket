import { z } from "zod";
import { RAIL_KEYS, type Rail } from "../constants";
import { authenticatorCode } from "./auth";

const rand = z.number({ message: "Enter an amount" }).positive("Enter an amount greater than zero.").max(9_999_999_999).multipleOf(0.01);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-10-24");
const railEnum = z.enum(RAIL_KEYS as [Rail, ...Rail[]]);
const text = (max: number, msg: string) => z.string().trim().min(1, msg).max(max);

export const paymentRequestSchema = z.object({
  client: text(60, "Add the client's name and an amount"),
  amount: rand,
  what: z.string().trim().max(120).default(""),
  rails: z.array(railEnum).min(1, "Choose at least one way to pay"),
});

export const paymentDetailsSchema = z.object({
  bank: text(60, "Add your bank"),
  accountName: text(80, "Add the account name"),
  accountNumber: z.string().trim().regex(/^[\d ]{6,20}$/, "Account numbers are 6 to 20 digits"),
  shapId: z.string().trim().max(40).default(""),
  inBusinessName: z.boolean(),
  code: authenticatorCode,
});

/** The client's proof of payment, from the public payment page. */
export const proofSchema = z.object({
  payer: text(80, "Add your name and the amount you paid."),
  amount: rand,
  paidOn: day,
  method: railEnum,
  usedReference: z.boolean(),
  fileId: z.string().uuid({ message: "Attach your proof of payment (a screenshot or PDF from your bank)." }),
});

export const supplierSchema = z.object({
  name: text(80, "Add the supplier's name and bank"),
  bank: text(40, "Add the supplier's name and bank"),
  accountNumber: z.string().trim().regex(/^[\d ]{4,20}$/, "Add at least the last 4 digits of the account"),
});
export const supplierBankSchema = z.object({ bank: text(40, "Add the bank"), accountNumber: z.string().trim().regex(/^[\d ]{4,20}$/, "Add at least the last 4 digits of the account") });

export const supplierPaymentSchema = z.object({
  clientUuid: z.string().uuid(), supplierId: z.string().uuid({ message: "Choose a supplier and enter an amount" }), amount: rand,
  what: z.string().trim().max(120).default(""), date: day,
});
export const cashPayoutSchema = z.object({
  clientUuid: z.string().uuid(), name: text(80, "Add who you paid and the amount"), amount: rand,
  what: z.string().trim().max(120).default(""), noPhone: z.boolean().default(true), date: day,
});

export const messageActionSchema = z.object({ action: z.enum(["block", "safe"]) });
export const checkMessageSchema = z.object({
  sender: text(120, "Who sent it? Paste their email address or number."),
  text: text(2000, "Paste the message you received."),
});
export const sharingSchema = z.object({ sharing: z.enum(["none", "summary", "full"]) });
export const incubatorRequestSchema = z.object({ incubatorId: z.string().uuid().nullable() });
export const reportSchema = z.object({ reason: z.string().trim().max(500).default("") });
