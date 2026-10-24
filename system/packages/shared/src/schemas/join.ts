import { z } from "zod";
import { ALL_SECTORS, BUSINESS_TYPE_KEYS, CIPC_PATTERN, PROVINCES, SECTORS, type BusinessType } from "../constants";

const text = (max: number, msg: string) => z.string().trim().min(1, msg).max(max);

export const joinDetailsSchema = z.object({
  founderName: text(80, "Add your name"),
  businessName: text(90, "Add the business name"),
  businessType: z.enum(BUSINESS_TYPE_KEYS as [BusinessType, ...BusinessType[]]),
  sector: z.string().refine((s) => ALL_SECTORS.includes(s), "Choose a sector"),
  town: text(60, "Add your town"),
  province: z.enum(PROVINCES),
  area: z.enum(["township", "urban", "rural"]),
  incubatorId: z.string().uuid().nullable(),
  registered: z.boolean(),
  legalName: z.string().trim().max(120).optional(),
  cipcNumber: z.string().trim().max(20).optional(),
}).superRefine((d, ctx) => {
  if (!SECTORS[d.businessType].includes(d.sector)) ctx.addIssue({ code: "custom", path: ["sector"], message: "Choose a sector for this type of business" });
  // Anchored, fixed-length pattern on input capped at 20 characters: no catastrophic backtracking.
  // nosemgrep: regex_dos
  if (d.registered && !CIPC_PATTERN.test(d.cipcNumber ?? "")) ctx.addIssue({ code: "custom", path: ["cipcNumber"], message: "The CIPC number should look like 2024/123456/07." });
});
export type JoinDetails = z.infer<typeof joinDetailsSchema>;

export const joinCompleteSchema = z.object({
  agree: z.literal(true, { message: "Tick the box to confirm before joining." }),
});

export const cipcNumberSchema = z.object({
  cipcNumber: z.string().trim().regex(CIPC_PATTERN, "CIPC numbers look like 2026/123456/07"),
});
