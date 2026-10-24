/**
 * Join ProofPocket — role-selection wizard.
 * Three tracks: Founder · Investor · Incubator / NGO
 * Each track is 2 steps: (1) Details  (2) Documents + submit.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AREAS, BUSINESS_TYPES, BUSINESS_TYPE_KEYS, DOCS, PROVINCES, SECTORS,
  coFounderSchema, investorDetailsSchema, joinCompleteSchema, joinDetailsSchema,
  joinDocsFor, orgOnboardSchema, passwordFor, emailSchema, shortFingerprint,
  type CoFounder, type DocType, type InvestorDetails, type JoinDetails, type Me, type OrgOnboard,
} from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link, Navigate } from "react-router-dom";
import { z } from "zod";
import {
  AlertCircle, ArrowLeft, ArrowRight, Building2, CheckCircle2, ChevronDown, ChevronUp,
  Loader2, Plus, Trash2, Upload, User, Users, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { FilePick } from "../../components/FilePick";
import { Spinner } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { AUTH_MODE, useAuth } from "../../lib/auth";
import { HOME_FOR, meKey, useMe } from "../../lib/me";
import { AuthPageShell, PasswordField } from "../auth/SignIn";
import type { DocumentsResponse } from "../founder/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

type Role = "founder" | "investor" | "org";
type FounderStep = 1 | 2 | 3;

const ALL_SECTORS_FLAT: string[] = Object.values(SECTORS).flat();

const INVESTOR_TYPES = [
  { value: "vc", label: "Venture Capital (VC)" },
  { value: "angel", label: "Angel Investor" },
  { value: "pe", label: "Private Equity" },
  { value: "dfi", label: "Development Finance Institution (DFI)" },
  { value: "corporate_csi", label: "Corporate CSI / ESD Fund" },
  { value: "bank", label: "Bank" },
  { value: "family_office", label: "Family Office" },
  { value: "grant_maker", label: "Grant Maker / Foundation" },
  { value: "individual", label: "Individual Investor" },
] as const;

const ORG_TYPES = [
  { value: "incubator", label: "Business Incubator" },
  { value: "accelerator", label: "Accelerator" },
  { value: "ngo", label: "NGO" },
  { value: "npo", label: "NPO / NPC" },
  { value: "cbo", label: "Community-Based Organisation (CBO)" },
] as const;

const STAGES_OPTIONS = [
  { value: "idea", label: "Idea / Pre-revenue" },
  { value: "seed", label: "Seed (early MVP)" },
  { value: "early", label: "Early revenue" },
  { value: "growth", label: "Growth" },
  { value: "expansion", label: "Expansion" },
];

const INSTRUMENT_OPTIONS = [
  { value: "equity", label: "Equity" },
  { value: "debt", label: "Debt / Loan" },
  { value: "grant", label: "Grant" },
  { value: "convertible", label: "Convertible Note" },
  { value: "blended", label: "Blended Finance" },
];

const AUM_BANDS = [
  { value: "under_1m", label: "Under R1 million" },
  { value: "1m_10m", label: "R1m – R10m" },
  { value: "10m_100m", label: "R10m – R100m" },
  { value: "over_100m", label: "Over R100m" },
];

const BUDGET_BANDS = [
  { value: "under_500k", label: "Under R500 000" },
  { value: "500k_2m", label: "R500k – R2m" },
  { value: "2m_10m", label: "R2m – R10m" },
  { value: "over_10m", label: "Over R10m" },
];

const BENEFICIARY_GROUPS = [
  "Youth (18–35)", "Women", "People with disabilities", "Rural communities",
  "Township entrepreneurs", "Students / graduates", "Informal traders", "Children",
];

/** Reusable form field wrapper */
function Field({ label, error, children, hint }: { label: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

/** Multi-select toggle buttons */
function MultiToggle({ options, value, onChange, error }: {
  options: readonly { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  error?: string;
}) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              value.includes(o.value)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary/50"
            }`}>
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{error}</p>}
    </div>
  );
}

/** Step progress bar shown at the top of each track */
function WizardProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">Step {step} of {total}</span>
      </div>
      <Progress value={(step / total) * 100} className="h-1.5" />
    </div>
  );
}

// ─── Role selector ────────────────────────────────────────────────────────────

function RoleSelector({ onSelect }: { onSelect: (r: Role) => void }) {
  const roles: { role: Role; icon: React.ReactNode; title: string; desc: string; badge?: string }[] = [
    {
      role: "founder",
      icon: <User className="h-6 w-6" />,
      title: "Business Founder",
      desc: "Start or grow your business. Build a verified record that funders and buyers can trust.",
      badge: "Most common",
    },
    {
      role: "investor",
      icon: <Building2 className="h-6 w-6" />,
      title: "Investor / Funder",
      desc: "A VC, angel, DFI, corporate CSI fund, or grant maker looking to fund South African businesses.",
    },
    {
      role: "org",
      icon: <Users className="h-6 w-6" />,
      title: "Incubator / NGO / NPO",
      desc: "An incubator, accelerator, NGO, NPO, or community organisation supporting founders.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Who are you joining as?</h1>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Choose the option that best describes you. Each path collects what's relevant to your role.
        </p>
      </div>
      <div className="grid gap-3">
        {roles.map(({ role, icon, title, desc, badge }) => (
          <button key={role} type="button" onClick={() => onSelect(role)}
            className="group relative flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary group-hover:bg-primary/12 transition-colors">
              {icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">{title}</span>
                {badge && <Badge variant="success" className="text-[10px]">{badge}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">{desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 self-center text-muted-foreground/40 group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Already have an account? <Link to="/sign-in" className="text-primary hover:underline font-medium">Sign in</Link>
      </p>
    </div>
  );
}

// ─── Founder track ────────────────────────────────────────────────────────────

const accountSchema = z.object({
  email: emailSchema,
  password: z.string(),
  confirm: z.string(),
}).superRefine((v, ctx) => {
  const p = passwordFor(v.email).safeParse(v.password);
  if (!p.success) ctx.addIssue({ code: "custom", path: ["password"], message: p.error.issues[0]!.message });
  if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "The two passwords don't match." });
});

type FounderForm = JoinDetails & { account?: z.infer<typeof accountSchema> };

function FounderDetails({ signedOut, onDone }: { signedOut: boolean; onDone: () => void }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [showCoFounders, setShowCoFounders] = useState(false);
  const options = useQuery({ queryKey: ["join-options"], queryFn: () => api<{ incubators: { id: string; name: string }[] }>("/join/options") });
  const schema = signedOut ? joinDetailsSchema.and(z.object({ account: accountSchema })) : joinDetailsSchema;
  const form = useForm<FounderForm>({
    resolver: zodResolver(schema as never),
    defaultValues: {
      businessType: "beauty", sector: SECTORS.beauty[0], province: "Gauteng",
      area: "township", incubatorId: null, registered: false, coFounders: [],
    },
  });
  const { fields: coFounderFields, append, remove } = useFieldArray({ control: form.control, name: "coFounders" as never });
  const cfFields = coFounderFields as { id: string }[];
  const type = form.watch("businessType");
  const registered = form.watch("registered");
  useEffect(() => {
    if (!SECTORS[type].includes(form.getValues("sector"))) form.setValue("sector", SECTORS[type][0]!);
  }, [type, form]);

  const e = form.formState.errors as Record<string, { message?: string }>;

  const submit = form.handleSubmit(async ({ account, ...d }) => {
    setErr("");
    try {
      if (account) await auth.signUp(account.email, account.password);
      await api("/join", { body: { ...d, incubatorId: d.incubatorId || null } });
      await qc.invalidateQueries({ queryKey: meKey });
      onDone();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message :
        AUTH_MODE === "firebase" && (x as { code?: string }).code === "auth/email-already-in-use"
          ? "There's already an account with this email. Sign in instead."
          : "Something went wrong. Try again.");
    }
  });

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <WizardProgress step={1} total={3} label="Your details" />

      {/* Account (signed-out only) */}
      {signedOut && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Create your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Email address" error={e["account.email"]?.message}>
              <Input type="email" autoComplete="username" autoCapitalize="none" placeholder="you@example.com" {...form.register("account.email")} />
            </Field>
            <Field label="Password (at least 10 characters)" error={e["account.password"]?.message}>
              <PasswordField label="Password" autoComplete="new-password" error={e["account.password"]?.message} {...form.register("account.password")} />
            </Field>
            <Field label="Confirm password" error={e["account.confirm"]?.message}>
              <PasswordField label="Confirm password" autoComplete="new-password" error={e["account.confirm"]?.message} {...form.register("account.confirm")} />
            </Field>
          </CardContent>
        </Card>
      )}

      {/* Personal details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">About you</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Your full name" error={e.founderName?.message}>
              <Input type="text" autoComplete="name" placeholder="Zanele Mokoena" {...form.register("founderName")} />
            </Field>
            <Field label="SA ID number" error={e.idNumber?.message} hint="Your 13-digit South African ID number">
              <Input type="text" inputMode="numeric" maxLength={13} placeholder="0001010000000" {...form.register("idNumber")} />
            </Field>
            <Field label="Mobile number" error={e.phone?.message} hint="e.g. 0821234567">
              <Input type="tel" autoComplete="tel" placeholder="0821234567" {...form.register("phone")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Business details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Your business</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Business name" error={e.businessName?.message}>
              <Input type="text" placeholder="Zanele's Salon" {...form.register("businessName")} />
            </Field>
            <Field label="Type of business" error={e.businessType?.message}>
              <Select value={form.watch("businessType")} onValueChange={(v) => form.setValue("businessType", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUSINESS_TYPE_KEYS.map((k) => <SelectItem key={k} value={k}>{BUSINESS_TYPES[k].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sector" error={e.sector?.message}>
              <Select value={form.watch("sector")} onValueChange={(v) => form.setValue("sector", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTORS[type].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Town or township" error={e.town?.message}>
              <Input type="text" placeholder="Soweto" {...form.register("town")} />
            </Field>
            <Field label="Province" error={e.province?.message}>
              <Select value={form.watch("province")} onValueChange={(v) => form.setValue("province", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Area type" error={e.area?.message}>
              <Select value={form.watch("area")} onValueChange={(v) => form.setValue("area", v as never)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(AREAS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Incubator or NGO supporting you" error={e.incubatorId?.message}>
              <Select value={form.watch("incubatorId") ?? "none"} onValueChange={(v) => form.setValue("incubatorId", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue placeholder="None yet" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None yet</SelectItem>
                  {options.data?.incubators.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* CIPC registration */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Business registration</CardTitle>
          <CardDescription>Is your business registered with CIPC?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={registered ? "yes" : "no"} onValueChange={(v) => form.setValue("registered", v === "yes")}
            className="grid gap-3 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${!registered ? "border-primary bg-primary/4" : "border-border hover:border-primary/40"}`}>
              <RadioGroupItem value="no" className="mt-0.5" />
              <div>
                <div className="font-medium text-sm">Not yet</div>
                <div className="text-xs text-muted-foreground mt-0.5">Start as a Starter. We'll guide you through registering.</div>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${registered ? "border-primary bg-primary/4" : "border-border hover:border-primary/40"}`}>
              <RadioGroupItem value="yes" className="mt-0.5" />
              <div>
                <div className="font-medium text-sm">Yes, registered</div>
                <div className="text-xs text-muted-foreground mt-0.5">Upload your documents to get the Verified badge.</div>
              </div>
            </label>
          </RadioGroup>
          {registered && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Registered company name" error={e.legalName?.message}>
                <Input type="text" placeholder="Zanele's Salon (Pty) Ltd" {...form.register("legalName")} />
              </Field>
              <Field label="CIPC registration number" error={e.cipcNumber?.message} hint="Format: 2024/123456/07">
                <Input type="text" className="font-mono" placeholder="2024/123456/07" {...form.register("cipcNumber")} />
              </Field>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Co-founders */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Co-founders / Directors</CardTitle>
              <CardDescription className="mt-1">Do you have business partners or co-directors?</CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowCoFounders((v) => !v)}>
              {showCoFounders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {cfFields.length > 0 ? `${cfFields.length} added` : "Add"}
            </Button>
          </div>
        </CardHeader>
        {showCoFounders && (
          <CardContent className="space-y-4">
            {cfFields.map((field, i) => (
              <div key={field.id} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Co-founder {i + 1}</span>
                  <button type="button" onClick={() => remove(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" error={(e as Record<string, { message?: string }>)[`coFounders.${i}.fullName`]?.message}>
                    <Input type="text" placeholder="Thabo Nkosi" {...form.register(`coFounders.${i}.fullName` as never)} />
                  </Field>
                  <Field label="SA ID number" error={(e as Record<string, { message?: string }>)[`coFounders.${i}.idNumber`]?.message}>
                    <Input type="text" inputMode="numeric" maxLength={13} placeholder="0001010000000" {...form.register(`coFounders.${i}.idNumber` as never)} />
                  </Field>
                  <Field label="Role" error={(e as Record<string, { message?: string }>)[`coFounders.${i}.role`]?.message}>
                    <Input type="text" placeholder="Technical Lead" {...form.register(`coFounders.${i}.role` as never)} />
                  </Field>
                  <Field label="Email" error={(e as Record<string, { message?: string }>)[`coFounders.${i}.email`]?.message}>
                    <Input type="email" placeholder="thabo@example.com" {...form.register(`coFounders.${i}.email` as never)} />
                  </Field>
                  <Field label="Phone" error={(e as Record<string, { message?: string }>)[`coFounders.${i}.phone`]?.message}>
                    <Input type="tel" placeholder="0821234567" {...form.register(`coFounders.${i}.phone` as never)} />
                  </Field>
                  <Field label="Shareholding %" error={(e as Record<string, { message?: string }>)[`coFounders.${i}.shareholding`]?.message} hint="Optional">
                    <Input type="number" min={1} max={99} placeholder="30" {...form.register(`coFounders.${i}.shareholding` as never)} />
                  </Field>
                </div>
              </div>
            ))}
            {cfFields.length < 5 && (
              <Button type="button" variant="outline" className="w-full" size="sm"
                onClick={() => append({ fullName: "", idNumber: "", role: "", email: "", phone: "" } as never)}>
                <Plus className="h-4 w-4" /> Add co-founder / director
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          {err}
        </div>
      )}

      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted-foreground">Takes about 5 minutes.</p>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <>Continue <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </div>
    </form>
  );
}

function FounderDocuments({ data, onBack, onNext }: { data: DocumentsResponse; onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const registered = data.company.registered;
  const required = joinDocsFor(registered); // cipc+id+bank+addr or id+addr
  const doc = (k: DocType) => data.documents.find((d) => d.docType === k);

  // Optional docs — shown to everyone, not blocking
  const optionalDocs: { key: DocType; why: string }[] = registered
    ? [
        { key: "tax",   why: "Increases your readiness score by 15 pts. Required for tenders and most funders." },
        { key: "bbbee", why: "Required by government buyers and most corporate procurement. An affidavit is enough for small businesses." },
        { key: "bplan", why: "Adds 10 pts to your readiness score. Most funders ask for it — upload it now while you have it ready." },
        { key: "fin",   why: "Highest-value document: 15 pts. Funders use it to assess your financial health." },
        { key: "csd",   why: "Required to sell to government departments and state-owned entities." },
      ]
    : [
        { key: "bbbee", why: "You can get a sworn affidavit as a sole proprietor. Buyers and funders ask for it." },
        { key: "tax",   why: "Register on SARS eFiling and upload your tax registration notice. Required for most formal markets." },
      ];

  const attach = async (k: DocType, fileId: string) => {
    setErr("");
    try {
      await api("/founder/documents", { body: { docType: k, fileId } });
      await qc.invalidateQueries({ queryKey: ["founder-documents"] });
    } catch (x) { setErr(x instanceof ApiError ? x.message : "Try again."); }
  };

  const next = () => {
    const miss = required.filter((k) => doc(k)?.state === "missing");
    if (miss.length) { setErr(`Please upload: ${miss.map((k) => DOCS[k].name).join(", ")}.`); return; }
    onNext();
  };

  // Reusable upload row
  const DocRow = ({ k, hint }: { k: DocType; hint?: string }) => {
    const d = doc(k);
    const uploaded = d && d.state !== "missing";
    return (
      <div className={`flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors ${uploaded ? "border-good/40 bg-good-soft/30" : "border-border"}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {uploaded
              ? <CheckCircle2 className="h-4 w-4 text-good shrink-0" />
              : <Upload className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className="font-medium text-sm">{DOCS[k].name}</span>
            {uploaded && <Badge variant="success" className="text-[10px]">Uploaded</Badge>}
          </div>
          {uploaded && d.sha256
            ? <p className="mt-1 text-xs text-muted-foreground ml-6">{d.fileName} · Fingerprint {shortFingerprint(d.sha256)}</p>
            : <p className="mt-1 text-xs text-muted-foreground ml-6">{hint ?? "PDF or photo, up to 5 MB"}</p>}
        </div>
        <FilePick label={uploaded ? "Replace" : "Upload"} primary={!uploaded} onUploaded={(f) => attach(k, f.fileId)} onError={setErr} />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <WizardProgress step={2} total={3} label="Your documents" />

      {/* ── Required documents ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Required documents</CardTitle>
          <CardDescription>
            {registered
              ? "These four documents are checked by a ProofPocket adviser. Each file gets a unique fingerprint to prevent fraud."
              : "Upload your ID and proof of address so nobody can sign up as you."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* ID selfie — first and most important */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-medium text-sm">ID selfie</span>
                    <Badge className="ml-2 text-[10px]">Required</Badge>
                  </div>
                  <FilePick label={doc("id")?.state !== "missing" ? "Replace" : "Upload photo"} primary={doc("id")?.state === "missing"} accept="image/*" onUploaded={(f) => attach("id", f.fileId)} onError={setErr} />
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  A photo of <strong>you holding your ID book or card next to your face</strong> — both your face and the ID must be clearly visible. Use good lighting. No sunglasses or face coverings.
                </p>
                {doc("id") && doc("id")!.state !== "missing" && doc("id")!.sha256 && (
                  <p className="mt-1 text-xs text-good">{doc("id")!.fileName} · Fingerprint {shortFingerprint(doc("id")!.sha256!)}</p>
                )}
              </div>
            </div>
          </div>

          {/* SA ID copy (separate from selfie) */}
          <DocRow k="id" hint="A clear copy of your green ID book, smart ID card, or passport. PDF or photo." />

          {registered && <DocRow k="cipc" hint="The certificate you received from CIPC when registering your company. PDF preferred." />}
          {registered && <DocRow k="bank" hint="A confirmation letter from your business bank account. Usually downloadable from your banking app." />}
          <DocRow k="addr" hint="A utility bill, lease agreement, or a letter from your landlord or ward councillor showing your trading address." />
        </CardContent>
      </Card>

      {/* ── Optional documents — value-driven ── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Additional documents <span className="text-xs font-normal text-muted-foreground ml-1">(optional — upload now or later)</span></CardTitle>
          <CardDescription>
            These are not required to join, but each one increases your readiness score and opens more opportunities. Upload as many as you have ready.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {optionalDocs.map(({ key, why }) => (
            <div key={key} className={`rounded-lg border p-4 transition-colors ${doc(key)?.state !== "missing" ? "border-good/40 bg-good-soft/30" : "border-border"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {doc(key)?.state !== "missing"
                      ? <CheckCircle2 className="h-4 w-4 text-good shrink-0" />
                      : <Upload className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span className="font-medium text-sm">{DOCS[key].name}</span>
                    {doc(key)?.state !== "missing"
                      ? <Badge variant="success" className="text-[10px]">Uploaded</Badge>
                      : DOCS[key].pts > 0 && <Badge variant="secondary" className="text-[10px]">+{DOCS[key].pts} pts</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground ml-6">{why}</p>
                  {doc(key)?.sha256 && (
                    <p className="mt-1 text-xs text-muted-foreground ml-6">{doc(key)!.fileName} · Fingerprint {shortFingerprint(doc(key)!.sha256!)}</p>
                  )}
                </div>
                <FilePick label={doc(key)?.state !== "missing" ? "Replace" : "Upload"} onUploaded={(f) => attach(key, f.fileId)} onError={setErr} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {err && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{err}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button onClick={next}>Continue <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function FounderConfirm({ data, onBack, onJoined }: { data: DocumentsResponse; onBack: () => void; onJoined: () => void }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const options = useQuery({ queryKey: ["join-options"], queryFn: () => api<{ incubators: { id: string; name: string }[] }>("/join/options") });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const need = joinDocsFor(data.company.registered);
  const c = data.company;

  const join = useMutation({
    mutationFn: () => api<{ message: string }>("/join/complete", { body: { agree: true } }),
    onSuccess: async (r) => {
      qc.setQueryData<Me>(meKey, (m) => (m?.company ? { ...m, company: { ...m.company, joined: true } } : m));
      await qc.invalidateQueries({ queryKey: meKey });
      onJoined();
    },
  });

  return (
    <div className="space-y-6">
      <WizardProgress step={3} total={3} label="Review and join" />
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Check your details</CardTitle>
          <CardDescription>Review everything before you submit.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business</span><div className="mt-1 font-medium">{c.name}{c.cipcNumber && <span className="ml-2 font-mono text-xs text-muted-foreground">{c.cipcNumber}</span>}</div></div>
            <div><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Owner</span><div className="mt-1 font-medium">{me?.displayName}</div></div>
            <div><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supported by</span><div className="mt-1">{options.data?.incubators.find((n) => n.id === c.incubatorId)?.name ?? "None yet"}</div></div>
            <div><span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account type</span><div className="mt-1">{c.registered ? <Badge variant="success">Verified (pending document check)</Badge> : <Badge variant="secondary">Starter</Badge>}</div></div>
          </div>
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Documents</p>
            {need.map((k) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-good" />
                <span>{DOCS[k].name}</span>
                <Badge variant="success" className="text-[10px]">Attached</Badge>
              </div>
            ))}
          </div>
          <Separator />
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border" checked={agree}
              onChange={(e) => { setAgree(e.target.checked); setErr(""); }} />
            <span className="text-sm text-foreground leading-relaxed">
              These documents belong to me and this business. I agree that my chosen incubator can see my records, and that verified funders see only what I allow under Privacy &amp; sharing.
            </span>
          </label>
          {(err || join.error) && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              {err || (join.error as ApiError)?.message}
            </div>
          )}
        </CardContent>
      </Card>
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button disabled={join.isPending} onClick={() => agree ? join.mutate() : setErr("Tick the box to confirm before joining.")}>
          {join.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Joining…</> : "Join ProofPocket"}
        </Button>
      </div>
    </div>
  );
}

// ─── Investor track ───────────────────────────────────────────────────────────

function InvestorTrack({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<Partial<InvestorDetails>>({});
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Card className="text-center py-8">
        <CardContent className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle>Application received</CardTitle>
          <CardDescription className="max-w-sm mx-auto">
            Thank you. Our team will contact you within 2–3 business days to complete verification and activate your funder portal.
          </CardDescription>
          <Link to="/sign-in"><Button variant="outline">Back to sign in</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to role selection
      </button>
      {step === 1 && <InvestorStep1 initial={formData} onNext={(d) => { setFormData(d); setStep(2); }} />}
      {step === 2 && <InvestorStep2 initial={formData} onBack={() => setStep(1)} onDone={() => setDone(true)} />}
    </div>
  );
}

function InvestorStep1({ initial, onNext }: { initial: Partial<InvestorDetails>; onNext: (d: Partial<InvestorDetails>) => void }) {
  const step1Schema = z.object({
    repName: z.string().trim().min(1, "Add the representative's full name").max(80),
    repIdNumber: z.string().trim().regex(/^\d{13}$/, "SA ID numbers are 13 digits"),
    repRole: z.string().trim().min(1, "Add the representative's role").max(60),
    repEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
    repPhone: z.string().trim().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Enter a valid South African phone number"),
    orgName: z.string().trim().min(1, "Add the organisation name").max(120),
    entityType: z.enum(["vc", "angel", "pe", "dfi", "corporate_csi", "bank", "family_office", "grant_maker", "individual"], { message: "Choose an investor type" }),
    website: z.string().trim().url("Enter a valid website URL").max(255),
    email: z.string().trim().toLowerCase().email("Enter a valid organisation email"),
    phone: z.string().trim().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Enter a valid South African phone number"),
    province: z.enum(PROVINCES),
    town: z.string().trim().min(1, "Add the town or city").max(60),
    physicalAddress: z.string().trim().min(1, "Add the physical address").max(200),
  });
  const form = useForm({ resolver: zodResolver(step1Schema), defaultValues: initial as never });
  const e = form.formState.errors as Record<string, { message?: string }>;
  const submit = form.handleSubmit((d) => onNext(d as Partial<InvestorDetails>));

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <WizardProgress step={1} total={2} label="Organisation details" />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Your details</CardTitle>
          <CardDescription>The person completing this application</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={e.repName?.message}><Input placeholder="Sipho Dlamini" {...form.register("repName")} /></Field>
            <Field label="SA ID number" error={e.repIdNumber?.message} hint="13 digits"><Input inputMode="numeric" maxLength={13} placeholder="0001010000000" {...form.register("repIdNumber")} /></Field>
            <Field label="Your role" error={e.repRole?.message}><Input placeholder="Investment Manager" {...form.register("repRole")} /></Field>
            <Field label="Your email" error={e.repEmail?.message}><Input type="email" placeholder="sipho@example.co.za" {...form.register("repEmail")} /></Field>
            <Field label="Your phone" error={e.repPhone?.message}><Input type="tel" placeholder="0821234567" {...form.register("repPhone")} /></Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organisation name" error={e.orgName?.message}><Input placeholder="ABC Ventures" {...form.register("orgName")} /></Field>
            <Field label="Investor / funder type" error={e.entityType?.message}>
              <Select value={((form.watch("entityType" as never) as unknown) as string) ?? ""} onValueChange={(v) => form.setValue("entityType" as never, v as never)}>
                <SelectTrigger><SelectValue placeholder="Choose type" /></SelectTrigger>
                <SelectContent>{INVESTOR_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Website" error={e.website?.message}><Input type="url" placeholder="https://example.co.za" {...form.register("website")} /></Field>
            <Field label="Organisation email" error={e.email?.message}><Input type="email" placeholder="info@example.co.za" {...form.register("email")} /></Field>
            <Field label="Organisation phone" error={e.phone?.message}><Input type="tel" placeholder="0111234567" {...form.register("phone")} /></Field>
            <Field label="Province" error={e.province?.message}>
              <Select value={((form.watch("province" as never) as unknown) as string) ?? ""} onValueChange={(v) => form.setValue("province" as never, v as never)}>
                <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                <SelectContent>{PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Town / city" error={e.town?.message}><Input placeholder="Johannesburg" {...form.register("town")} /></Field>
          </div>
          <Field label="Physical address" error={e.physicalAddress?.message}>
            <Textarea placeholder="123 Main Street, Sandton, Johannesburg, 2196" {...form.register("physicalAddress")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}

function InvestorStep2({ initial, onBack, onDone }: { initial: Partial<InvestorDetails>; onBack: () => void; onDone: () => void }) {
  const step2Schema = z.object({
    sectors: z.array(z.string()).min(1, "Select at least one sector"),
    stages: z.array(z.enum(["idea", "seed", "early", "growth", "expansion"])).min(1, "Select at least one stage"),
    instruments: z.array(z.enum(["equity", "debt", "grant", "convertible", "blended"])).min(1, "Select at least one instrument"),
    ticketMin: z.coerce.number().min(0, "Enter the minimum ticket size"),
    ticketMax: z.coerce.number().min(1, "Enter the maximum ticket size"),
    aumBand: z.enum(["under_1m", "1m_10m", "10m_100m", "over_100m"], { message: "Select AUM band" }),
    description: z.string().trim().min(1, "Add a brief description of your investment mandate").max(1000),
  });
  const form = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { sectors: [], stages: [], instruments: [], ticketMin: 0, ticketMax: 0, ...initial } as never,
  });
  const e = form.formState.errors as Record<string, { message?: string }>;
  const [submitErr, setSubmitErr] = useState("");

  const submit = form.handleSubmit(async (d) => {
    setSubmitErr("");
    try {
      await api("/join/investor", { body: { ...initial, ...d } });
      onDone();
    } catch (x) { setSubmitErr(x instanceof ApiError ? x.message : "Something went wrong. Try again."); }
  });

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <WizardProgress step={2} total={2} label="Investment mandate" />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Investment mandate</CardTitle>
          <CardDescription>Tell founders what you fund so we can match you to the right businesses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Sectors you invest in" error={e.sectors?.message}>
            <MultiToggle
              options={ALL_SECTORS_FLAT.map((s) => ({ value: s, label: s }))}
              value={((form.watch("sectors" as never) as unknown as string[]) ?? [])}
              onChange={(v) => form.setValue("sectors" as never, v as never)}
              error={e.sectors?.message}
            />
          </Field>
          <Field label="Business stages" error={e.stages?.message}>
            <MultiToggle options={STAGES_OPTIONS} value={((form.watch("stages" as never) as unknown as string[]) ?? [])} onChange={(v) => form.setValue("stages" as never, v as never)} />
          </Field>
          <Field label="Funding instruments" error={e.instruments?.message}>
            <MultiToggle options={INSTRUMENT_OPTIONS} value={((form.watch("instruments" as never) as unknown as string[]) ?? [])} onChange={(v) => form.setValue("instruments" as never, v as never)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Min ticket size (ZAR)" error={e.ticketMin?.message}>
              <Input type="number" min={0} placeholder="50000" {...form.register("ticketMin")} />
            </Field>
            <Field label="Max ticket size (ZAR)" error={e.ticketMax?.message}>
              <Input type="number" min={0} placeholder="2000000" {...form.register("ticketMax")} />
            </Field>
            <Field label="Assets under management" error={e.aumBand?.message}>
              <Select value={((form.watch("aumBand" as never) as unknown) as string) ?? ""} onValueChange={(v) => form.setValue("aumBand" as never, v as never)}>
                <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                <SelectContent>{AUM_BANDS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Investment mandate description" error={e.description?.message}
            hint="Describe your focus, typical deal terms, and what you look for in founders.">
            <Textarea rows={4} placeholder="We invest in early-stage township and rural businesses in the tech and agri-processing sectors…" {...form.register("description")} />
          </Field>
        </CardContent>
      </Card>

      {submitErr && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{submitErr}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit application"}
        </Button>
      </div>
    </form>
  );
}

// ─── Org (Incubator / NGO) track ──────────────────────────────────────────────

function OrgTrack({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<Partial<OrgOnboard>>({});
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Card className="text-center py-8">
        <CardContent className="space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-good-soft text-good">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <CardTitle>Application received</CardTitle>
          <CardDescription className="max-w-sm mx-auto">
            Thank you. Our team will call the number you provided within 2–3 business days to verify your organisation before activating your portal.
          </CardDescription>
          <Link to="/sign-in"><Button variant="outline">Back to sign in</Button></Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to role selection
      </button>
      {step === 1 && <OrgStep1 initial={formData} onNext={(d) => { setFormData(d); setStep(2); }} />}
      {step === 2 && <OrgStep2 initial={formData} onBack={() => setStep(1)} onDone={() => setDone(true)} />}
    </div>
  );
}

function OrgStep1({ initial, onNext }: { initial: Partial<OrgOnboard>; onNext: (d: Partial<OrgOnboard>) => void }) {
  const step1Schema = z.object({
    contactName: z.string().trim().min(1, "Add the contact person's full name").max(80),
    contactIdNumber: z.string().trim().regex(/^\d{13}$/, "SA ID numbers are 13 digits"),
    contactRole: z.string().trim().min(1, "Add their role").max(60),
    contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address"),
    contactPhone: z.string().trim().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Enter a valid South African phone number"),
    orgType: z.enum(["incubator", "accelerator", "ngo", "npo", "cbo"], { message: "Choose an organisation type" }),
    orgName: z.string().trim().min(1, "Add the organisation name").max(120),
    website: z.string().trim().url("Enter a valid website URL").max(255),
    orgEmail: z.string().trim().toLowerCase().email("Enter a valid organisation email"),
    orgPhone: z.string().trim().regex(/^(\+27|0)[6-8][0-9]{8}$/, "Enter a valid South African phone number"),
    province: z.enum(PROVINCES),
    town: z.string().trim().min(1, "Add the town or city").max(60),
    physicalAddress: z.string().trim().min(1, "Add the physical address").max(200),
    cipcNumber: z.string().trim().optional(),
    npoNumber: z.string().trim().optional(),
  });
  const form = useForm({ resolver: zodResolver(step1Schema), defaultValues: initial as never });
  const e = form.formState.errors as Record<string, { message?: string }>;
  const orgType = (form.watch("orgType" as never) as unknown) as string | undefined;
  const isNgo = orgType === "ngo" || orgType === "npo" || orgType === "cbo";
  const submit = form.handleSubmit((d) => onNext(d as Partial<OrgOnboard>));

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <WizardProgress step={1} total={2} label="Organisation details" />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Contact person</CardTitle>
          <CardDescription>The person completing this application — we will call this number to verify your organisation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" error={e.contactName?.message}><Input placeholder="Nomsa Khumalo" {...form.register("contactName")} /></Field>
            <Field label="SA ID number" error={e.contactIdNumber?.message} hint="13 digits"><Input inputMode="numeric" maxLength={13} placeholder="0001010000000" {...form.register("contactIdNumber")} /></Field>
            <Field label="Your role" error={e.contactRole?.message}><Input placeholder="Programme Manager" {...form.register("contactRole")} /></Field>
            <Field label="Your email" error={e.contactEmail?.message}><Input type="email" placeholder="nomsa@example.org" {...form.register("contactEmail")} /></Field>
            <Field label="Your phone" error={e.contactPhone?.message} hint="We will call this number">
              <Input type="tel" placeholder="0821234567" {...form.register("contactPhone")} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Organisation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Organisation type" error={e.orgType?.message}>
              <Select value={((form.watch("orgType" as never) as unknown) as string) ?? ""} onValueChange={(v) => form.setValue("orgType" as never, v as never)}>
                <SelectTrigger><SelectValue placeholder="Choose type" /></SelectTrigger>
                <SelectContent>{ORG_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Organisation name" error={e.orgName?.message}><Input placeholder="Soweto Business Hub" {...form.register("orgName")} /></Field>
            <Field label="Website" error={e.website?.message}><Input type="url" placeholder="https://example.org.za" {...form.register("website")} /></Field>
            <Field label="Organisation email" error={e.orgEmail?.message}><Input type="email" placeholder="info@example.org.za" {...form.register("orgEmail")} /></Field>
            <Field label="Organisation phone" error={e.orgPhone?.message}><Input type="tel" placeholder="0111234567" {...form.register("orgPhone")} /></Field>
            <Field label="Province" error={e.province?.message}>
              <Select value={((form.watch("province" as never) as unknown) as string) ?? ""} onValueChange={(v) => form.setValue("province" as never, v as never)}>
                <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                <SelectContent>{PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Town / city" error={e.town?.message}><Input placeholder="Cape Town" {...form.register("town")} /></Field>
          </div>
          <Field label="Physical address" error={e.physicalAddress?.message}>
            <Textarea placeholder="23 Main Road, Khayelitsha, Cape Town, 7784" {...form.register("physicalAddress")} />
          </Field>
          <Separator />
          {isNgo ? (
            <Field label="NPO registration number" error={e.npoNumber?.message} hint="Format: 123-456 (from DSD NPO Directorate)">
              <Input placeholder="123-456" {...form.register("npoNumber")} />
            </Field>
          ) : (
            <Field label="CIPC registration number" error={e.cipcNumber?.message} hint="Format: 2024/123456/07">
              <Input className="font-mono" placeholder="2024/123456/07" {...form.register("cipcNumber")} />
            </Field>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={form.formState.isSubmitting}>Continue <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </form>
  );
}

function OrgStep2({ initial, onBack, onDone }: { initial: Partial<OrgOnboard>; onBack: () => void; onDone: () => void }) {
  const step2Schema = z.object({
    sectors: z.array(z.string()).min(1, "Select at least one sector or cause area"),
    description: z.string().trim().min(1, "Describe your organisation's mission and programmes").max(1000),
    foundedYear: z.coerce.number().min(1900).max(new Date().getFullYear()),
    beneficiaryGroups: z.array(z.string()).min(1, "Select at least one beneficiary group"),
    annualBudgetBand: z.enum(["under_500k", "500k_2m", "2m_10m", "over_10m"], { message: "Select a budget band" }),
  });
  const form = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { sectors: [], beneficiaryGroups: [], foundedYear: new Date().getFullYear(), ...initial } as never,
  });
  const e = form.formState.errors as Record<string, { message?: string }>;
  const [submitErr, setSubmitErr] = useState("");

  const submit = form.handleSubmit(async (d) => {
    setSubmitErr("");
    try {
      await api("/join/org", { body: { ...initial, ...d } });
      onDone();
    } catch (x) { setSubmitErr(x instanceof ApiError ? x.message : "Something went wrong. Try again."); }
  });

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <WizardProgress step={2} total={2} label="Programme profile" />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Programme profile</CardTitle>
          <CardDescription>This helps match you with relevant founders and funders.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Sectors / cause areas" error={e.sectors?.message}>
            <MultiToggle
              options={ALL_SECTORS_FLAT.map((s) => ({ value: s, label: s }))}
              value={((form.watch("sectors" as never) as unknown as string[]) ?? [])}
              onChange={(v) => form.setValue("sectors" as never, v as never)}
            />
          </Field>
          <Field label="Beneficiary groups" error={e.beneficiaryGroups?.message}>
            <MultiToggle
              options={BENEFICIARY_GROUPS.map((g) => ({ value: g, label: g }))}
              value={((form.watch("beneficiaryGroups" as never) as unknown as string[]) ?? [])}
              onChange={(v) => form.setValue("beneficiaryGroups" as never, v as never)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Year founded" error={e.foundedYear?.message}>
              <Input type="number" min={1900} max={new Date().getFullYear()} placeholder="2018" {...form.register("foundedYear")} />
            </Field>
            <Field label="Annual budget band" error={e.annualBudgetBand?.message}>
              <Select value={((form.watch("annualBudgetBand" as never) as unknown) as string) ?? ""} onValueChange={(v) => form.setValue("annualBudgetBand" as never, v as never)}>
                <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                <SelectContent>{BUDGET_BANDS.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Mission and programmes" error={e.description?.message}
            hint="Describe your mission, who you support, and what services you offer.">
            <Textarea rows={4} placeholder="We support township entrepreneurs in Gauteng with business mentorship, workspace, and access to funding…" {...form.register("description")} />
          </Field>
        </CardContent>
      </Card>

      {submitErr && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{submitErr}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Submitting…</> : "Submit application"}
        </Button>
      </div>
    </form>
  );
}

// ─── Sidebar content per state ───────────────────────────────────────────────

function JoinSidebar({ role, founderStep }: { role: Role | null; founderStep: number }) {
  if (!role) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Why ProofPocket?</h3>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            {[
              "Verified badge funders and buyers look for",
              "Live books, cash flow and stock from your phone",
              "Fraud protection on every payment",
              "Direct connections to funders, buyers and incubators",
              "All your documents in one trusted place",
            ].map((text) => (
              <li key={text} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-good mt-0.5" />
                <span>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2">
          <h3 className="font-semibold text-foreground">Free for founders</h3>
          <p className="text-sm text-muted-foreground">
            ProofPocket is free to join and use. There are no hidden fees, and we never hold or move your money.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Safe from fraud</p>
          <p>We verify every funder and incubator on the platform. If anyone asks you to pay upfront fees, that is a scam — report it immediately.</p>
        </div>
      </div>
    );
  }

  if (role === "founder") {
    const steps = [
      { n: 1, label: "Your details", desc: "About you and your business" },
      { n: 2, label: "Documents", desc: "Upload your ID and proof" },
      { n: 3, label: "Review and join", desc: "Check and confirm" },
    ];
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="font-semibold text-foreground">Your progress</h3>
          <ol className="space-y-3">
            {steps.map(({ n, label, desc }) => (
              <li key={n} className="flex items-start gap-3">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5 ${
                  founderStep > n ? "bg-good text-white" :
                  founderStep === n ? "bg-primary text-primary-foreground" :
                  "bg-secondary text-muted-foreground"
                }`}>
                  {founderStep > n ? "✓" : n}
                </div>
                <div>
                  <div className={`text-sm font-medium ${founderStep === n ? "text-foreground" : "text-muted-foreground"}`}>{label}</div>
                  <div className="text-xs text-muted-foreground">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-foreground">Starter vs Verified</h3>
          <div className="space-y-2 text-sm">
            <div className="rounded-lg bg-secondary/50 p-3">
              <div className="font-medium text-foreground">Starter</div>
              <div className="text-muted-foreground text-xs mt-0.5">Books, stock, payments, cash flow and the registration guide.</div>
            </div>
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <div className="font-medium text-foreground">Verified</div>
              <div className="text-muted-foreground text-xs mt-0.5">Everything in Starter, plus the badge, funder matching, buyer introductions and tenders.</div>
            </div>
            <p className="text-xs text-muted-foreground">Both are free. Register with CIPC to become Verified.</p>
          </div>
        </div>
      </div>
    );
  }

  if (role === "investor") {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-foreground">How funder verification works</h3>
          <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
            <li>Submit your application with organisation and mandate details</li>
            <li>We verify your CIPC registration, FSCA status and representative ID</li>
            <li>Our team contacts you within 2–3 business days</li>
            <li>Once approved, your funder portal is activated</li>
          </ol>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">No upfront fees</p>
          <p>ProofPocket never charges funders upfront fees to list or access deal flow. If you are asked for payment, contact us immediately.</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 space-y-2 text-sm text-muted-foreground">
          <h3 className="font-semibold text-foreground">What you get</h3>
          <ul className="space-y-1.5">
            {[
              "Verified founder profiles with live financial data",
              "B-BBEE, sector and stage filters",
              "Fraud-checked documents and payment history",
              "Direct messaging with shortlisted founders",
            ].map((t) => <li key={t} className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-good mt-0.5" />{t}</li>)}
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h3 className="font-semibold text-foreground">How org verification works</h3>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
          <li>Submit your application with registration and programme details</li>
          <li>We call the phone number you provide to verify your organisation</li>
          <li>We check your CIPC or NPO registration number</li>
          <li>Once approved, your adviser portal is activated</li>
        </ol>
      </div>
      <div className="rounded-xl border border-border bg-card p-5 space-y-2 text-sm text-muted-foreground">
        <h3 className="font-semibold text-foreground">What you get</h3>
        <ul className="space-y-1.5">
          {[
            "A cohort dashboard for your incubatees",
            "Document and readiness tracking per business",
            "Direct messaging with founders",
            "Funder matching for your cohort",
          ].map((t) => <li key={t} className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-good mt-0.5" />{t}</li>)}
        </ul>
      </div>
    </div>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────

export default function Join() {
  const auth = useAuth();
  const me = useMe();
  const signedOut = auth.status === "signedOut";
  const noAccount = me.error instanceof ApiError && me.error.code === "no_account";
  const unjoined = me.data?.role === "founder" && me.data.company && !me.data.company.joined;
  const docs = useQuery({
    queryKey: ["founder-documents"],
    queryFn: () => api<DocumentsResponse>("/founder/documents"),
    enabled: !!unjoined,
  });

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [founderStep, setFounderStep] = useState<FounderStep>(unjoined ? 2 : 1);
  const [joined, setJoined] = useState(false);

  if (joined) return <Navigate to="/app/start" replace />;
  if (auth.status === "loading" || (auth.status === "signedIn" && me.isPending)) return <Spinner />;
  if (me.data && !unjoined) return <Navigate to={HOME_FOR[me.data.role]} replace />;
  if (me.data?.needsOtp) return <Navigate to="/verify" replace />;

  const isReturningFounder = !signedOut && !noAccount && unjoined;
  const activeRole: Role | null = selectedRole ?? (isReturningFounder ? "founder" : null);

  return (
    <AuthPageShell wide>
      {/* Header */}
      <div className="text-center space-y-1 py-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground font-display">ProofPocket</h1>
        <p className="text-muted-foreground text-sm">One business record. Trusted by funders, buyers and the public.</p>
      </div>

      {/* Two-column on desktop, single column on mobile */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">

        {/* ── Main content (left / full on mobile) ── */}
        <div className="w-full min-w-0 lg:flex-1">

          {/* Role selector */}
          {!isReturningFounder && !selectedRole && (
            <RoleSelector onSelect={setSelectedRole} />
          )}

          {/* Founder track */}
          {(selectedRole === "founder" || isReturningFounder) && (
            <>
              {founderStep === 1 && (
                <FounderDetails signedOut={signedOut} onDone={() => setFounderStep(2)} />
              )}
              {founderStep === 2 && docs.data && (
                <FounderDocuments data={docs.data} onBack={() => setFounderStep(1)} onNext={() => setFounderStep(3)} />
              )}
              {founderStep === 3 && docs.data && (
                <FounderConfirm data={docs.data} onBack={() => setFounderStep(2)} onJoined={() => setJoined(true)} />
              )}
              {founderStep > 1 && !docs.data && <Spinner />}
            </>
          )}

          {/* Investor track */}
          {selectedRole === "investor" && (
            <InvestorTrack onBack={() => setSelectedRole(null)} />
          )}

          {/* Org track */}
          {selectedRole === "org" && (
            <OrgTrack onBack={() => setSelectedRole(null)} />
          )}
        </div>

        {/* ── Sidebar (right on desktop, below on mobile) ── */}
        <aside className="w-full lg:w-72 xl:w-80 lg:shrink-0 lg:sticky lg:top-8 lg:self-start">
          <JoinSidebar role={activeRole} founderStep={founderStep} />
        </aside>
      </div>
    </AuthPageShell>
  );
}
