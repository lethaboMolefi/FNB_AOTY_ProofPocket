import { z } from "zod";
import { ALL_SECTORS, BUSINESS_TYPE_KEYS, CIPC_PATTERN, PROVINCES, SECTORS, type BusinessType } from "../constants";

const text = (max: number, msg: string) => z.string().trim().min(1, msg).max(max);
const optText = (max: number) => z.string().trim().max(max).optional();
const phoneSchema = z.string().trim().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Enter a valid South African phone number (e.g. 0821234567)");
const urlSchema = z.string().trim().url("Enter a valid website URL (e.g. https://example.co.za)").max(255);
const idNumberSchema = z.string().trim().regex(/^\d{13}$/, "SA ID numbers are 13 digits");
const npoSchema = z.string().trim().regex(/^\d{3}[-/]\d{3}$/, "NPO numbers look like 123-456 or 123/456");

// ─── Co-founder / director (shared between tracks) ─────────────────────────
export const coFounderSchema = z.object({
  fullName: text(80, "Add the co-founder's full name"),
  idNumber: idNumberSchema,
  role: text(60, "Add their role (e.g. Technical Lead)"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  phone: phoneSchema,
  shareholding: z.coerce.number().min(1).max(99).optional(),
});
export type CoFounder = z.infer<typeof coFounderSchema>;

// ─── Founder track ─────────────────────────────────────────────────────────
export const joinDetailsSchema = z.object({
  founderName: text(80, "Add your name"),
  idNumber: idNumberSchema,
  phone: phoneSchema,
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
  // Optional co-founders
  coFounders: z.array(coFounderSchema).max(5).optional(),
}).superRefine((d, ctx) => {
  if (!SECTORS[d.businessType].includes(d.sector))
    ctx.addIssue({ code: "custom", path: ["sector"], message: "Choose a sector for this type of business" });
  // nosemgrep: regex_dos
  if (d.registered && !CIPC_PATTERN.test(d.cipcNumber ?? ""))
    ctx.addIssue({ code: "custom", path: ["cipcNumber"], message: "The CIPC number should look like 2024/123456/07." });
});
export type JoinDetails = z.infer<typeof joinDetailsSchema>;

export const joinCompleteSchema = z.object({
  agree: z.literal(true, { message: "Tick the box to confirm before joining." }),
});

export const cipcNumberSchema = z.object({
  cipcNumber: z.string().trim().regex(CIPC_PATTERN, "CIPC numbers look like 2026/123456/07"),
});

// ─── Investor / Funder track ────────────────────────────────────────────────
export const investorDetailsSchema = z.object({
  // Representative
  repName: text(80, "Add the representative's full name"),
  repIdNumber: idNumberSchema,
  repRole: text(60, "Add the representative's role (e.g. Investment Manager)"),
  repEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
  repPhone: phoneSchema,

  // Organisation
  orgName: text(120, "Add the organisation name"),
  tradingName: optText(120),
  entityType: z.enum(["vc", "angel", "pe", "dfi", "corporate_csi", "bank", "family_office", "grant_maker", "individual"], {
    message: "Choose an investor type",
  }),
  cipcNumber: z.string().trim().optional(),
  taxNumber: z.string().trim().max(20).optional(),
  website: urlSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid organisation email"),
  phone: phoneSchema,
  province: z.enum(PROVINCES),
  town: text(60, "Add the town or city"),
  physicalAddress: text(200, "Add the physical address"),

  // Investment mandate
  sectors: z.array(z.string()).min(1, "Select at least one sector"),
  stages: z.array(z.enum(["idea", "seed", "early", "growth", "expansion"])).min(1, "Select at least one stage"),
  instruments: z.array(z.enum(["equity", "debt", "grant", "convertible", "blended"])).min(1, "Select at least one instrument"),
  ticketMin: z.coerce.number().min(0, "Enter the minimum ticket size"),
  ticketMax: z.coerce.number().min(1, "Enter the maximum ticket size"),
  aumBand: z.enum(["under_1m", "1m_10m", "10m_100m", "over_100m"], { message: "Select AUM band" }),
  geographyNational: z.boolean().default(true),
  geographyProvinces: z.array(z.enum(PROVINCES)).optional(),

  // Preferences
  bbbeePreference: z.boolean().default(false),
  impactFocus: z.boolean().default(false),
  youthFocus: z.boolean().default(false),
  womenFocus: z.boolean().default(false),
  ruralFocus: z.boolean().default(false),
  description: text(1000, "Add a brief description of your investment mandate"),
}).superRefine((d, ctx) => {
  if (d.ticketMax <= d.ticketMin)
    ctx.addIssue({ code: "custom", path: ["ticketMax"], message: "Maximum must be greater than minimum ticket size" });
  if (!d.geographyNational && (!d.geographyProvinces || d.geographyProvinces.length === 0))
    ctx.addIssue({ code: "custom", path: ["geographyProvinces"], message: "Select at least one province if not funding nationally" });
});
export type InvestorDetails = z.infer<typeof investorDetailsSchema>;

// ─── Incubator / NGO / NPO track ────────────────────────────────────────────
export const orgOnboardSchema = z.object({
  // Contact person
  contactName: text(80, "Add the contact person's full name"),
  contactIdNumber: idNumberSchema,
  contactRole: text(60, "Add their role (e.g. Programme Manager)"),
  contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
  contactPhone: phoneSchema,

  // Organisation
  orgType: z.enum(["incubator", "accelerator", "ngo", "npo", "cbo"], { message: "Choose an organisation type" }),
  orgName: text(120, "Add the organisation name"),
  tradingName: optText(120),
  website: urlSchema,
  orgEmail: z.string().trim().toLowerCase().email("Enter a valid organisation email"),
  orgPhone: phoneSchema,
  province: z.enum(PROVINCES),
  town: text(60, "Add the town or city"),
  physicalAddress: text(200, "Add the physical address"),

  // Registration
  cipcNumber: z.string().trim().optional(),
  npoNumber: z.string().trim().optional(),
  taxNumber: z.string().trim().max(20).optional(),
  pboStatus: z.boolean().default(false),
  section18aStatus: z.boolean().default(false),

  // Profile
  sectors: z.array(z.string()).min(1, "Select at least one sector or cause area"),
  description: text(1000, "Describe your organisation's mission and programmes"),
  foundedYear: z.coerce.number().min(1900).max(new Date().getFullYear()),
  beneficiaryGroups: z.array(z.string()).min(1, "Select at least one beneficiary group"),
  annualBudgetBand: z.enum(["under_500k", "500k_2m", "2m_10m", "over_10m"], { message: "Select a budget band" }),

  // Incubator-specific
  programmeType: optText(120),
  cohortSize: z.coerce.number().min(1).max(500).optional(),
  equityModel: z.enum(["none", "equity_for_services", "revenue_share", "direct_investment"]).optional(),
}).superRefine((d, ctx) => {
  const needsCipc = d.orgType === "incubator" || d.orgType === "accelerator";
  const needsNpo = d.orgType === "ngo" || d.orgType === "npo" || d.orgType === "cbo";
  if (needsCipc && !d.cipcNumber?.trim()) {
    ctx.addIssue({ code: "custom", path: ["cipcNumber"], message: "Incubators and accelerators require a CIPC number" });
  }
  if (needsNpo && !d.npoNumber?.trim()) {
    ctx.addIssue({ code: "custom", path: ["npoNumber"], message: "NGOs and NPOs require an NPO registration number" });
  }
  if (d.npoNumber && !npoSchema.safeParse(d.npoNumber).success) {
    ctx.addIssue({ code: "custom", path: ["npoNumber"], message: "NPO numbers look like 123-456 or 123/456" });
  }
  // nosemgrep: regex_dos
  if (d.cipcNumber && !CIPC_PATTERN.test(d.cipcNumber)) {
    ctx.addIssue({ code: "custom", path: ["cipcNumber"], message: "CIPC numbers look like 2024/123456/07" });
  }
});
export type OrgOnboard = z.infer<typeof orgOnboardSchema>;
