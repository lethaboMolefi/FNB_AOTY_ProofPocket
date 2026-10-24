import { z } from "zod";
import { ALL_SECTORS, FUNDER_KINDS, FUNDER_REQUIRABLE_DOCS, STAGES, SUPPORT_TYPES, type DocType } from "../constants";

const rand = z.number().positive().max(9_999_999_999).multipleOf(0.01);
const reason = (msg: string) => z.string().trim().min(1, msg).max(300);
const docEnum = z.enum(FUNDER_REQUIRABLE_DOCS as [DocType, ...DocType[]]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const profileSchema = z.object({
  tagline: z.string().trim().max(90).default(""),
  services: z.string().trim().max(1000).default(""),
  whatsapp: z.string().trim().max(20).regex(/^[\d +()-]*$/, "Use digits only for the WhatsApp number").default(""),
  instagram: z.string().trim().max(40).default(""),
  hours: z.string().trim().max(80).default(""),
});
export const postSchema = z.object({ text: z.string().trim().min(1, "Write something first").max(400), requestFeature: z.boolean().default(false) });
export const sharedSchema = z.object({ net: z.enum(["WhatsApp", "Facebook", "X"]) });

export const applySchema = z.object({ programmeId: z.string().uuid(), amount: rand });

export const programmeSchema = z.object({
  name: z.string().trim().min(1, "Add a programme name, and make sure the smallest amount isn't bigger than the largest.").max(80),
  kind: z.enum(FUNDER_KINDS),
  minAmount: z.number().min(0).max(9_999_999_999),
  maxAmount: z.number().positive("Add a programme name, and make sure the smallest amount isn't bigger than the largest.").max(9_999_999_999),
  budget: z.number().min(0).max(9_999_999_999),
  minMonths: z.number().int().min(0).max(36),
  minScore: z.number().int().min(0).max(100),
  requiredDocs: z.array(docEnum).default([]),
}).refine((p) => p.minAmount <= p.maxAmount, { path: ["minAmount"], message: "Add a programme name, and make sure the smallest amount isn't bigger than the largest." });
export const requirementToggleSchema = z.object({ docType: docEnum });
export const programmeStatusSchema = z.object({ status: z.enum(["open", "closed"]) });

export const offerSchema = z.object({ amount: rand, reason: reason("Add a reason. Founders see every change to their offer.") });
export const approveSchema = z.object({ reason: z.string().trim().max(300).default(""), confirmOverBudget: z.boolean().default(false) });
export const declineSchema = z.object({ reason: reason("Add a reason before declining. The founder will see it.") });
export const appStatusSchema = z.object({ status: z.enum(["under_review", "awaiting_cofunding"]), reason: z.string().trim().max(300).default("") });
export const inviteSchema = z.object({ programmeId: z.string().uuid() });

export const supportLogSchema = z.object({ companyId: z.string().uuid(), type: z.enum(SUPPORT_TYPES), note: z.string().trim().min(1, "Add a note about the support").max(1000) });
export const assignAdviserSchema = z.object({ adviserId: z.string().uuid().nullable() });
export const stageMoveSchema = z.object({ direction: z.enum(["forward", "back"]) });
export const handledSchema = z.object({ status: z.enum(["arranged", "declined"]), note: z.string().trim().max(300).default("") });
export const membershipDecisionSchema = z.object({ accept: z.boolean() });

export const organisationSchema = z.object({
  type: z.enum(["funder", "incubator", "buyer"]),
  name: z.string().trim().min(2).max(100),
  kind: z.string().trim().max(40).default(""),
  wants: z.string().trim().max(300).default(""),
  sectors: z.array(z.string().refine((s) => ALL_SECTORS.includes(s))).default([]),
  verified: z.boolean().default(false),
});
export const inviteUserSchema = z.object({
  orgId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  displayName: z.string().trim().min(2).max(80),
  isLead: z.boolean().default(false),
});
export const featureDecisionSchema = z.object({ approve: z.boolean(), note: z.string().trim().max(300).default("") });
export const reportDecisionSchema = z.object({ status: z.enum(["resolved", "dismissed"]), note: z.string().trim().max(300).default("") });
export const watchDecisionSchema = z.object({ status: z.enum(["confirmed_scam", "cleared"]) });
export const tenderSchema = z.object({
  title: z.string().trim().min(3).max(120), buyerName: z.string().trim().min(2).max(100), value: rand, closesOn: day,
  minMonths: z.number().int().min(0).max(36), sectors: z.array(z.string().refine((s) => ALL_SECTORS.includes(s))).min(1), requiredDocs: z.array(docEnum).default([]),
});

export const STAGE_COUNT = STAGES.length;
