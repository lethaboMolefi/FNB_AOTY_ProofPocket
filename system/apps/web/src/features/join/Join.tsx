/**
 * Join ProofPocket (v2/app.js vJoin, extended). Three tracks:
 *  - Founder: Details → Documents → Join (creates the business straight away).
 *  - Funder, and incubator / NGO: an application. It grants nothing until a ProofPocket admin approves it.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AREAS, BUSINESS_TYPES, BUSINESS_TYPE_KEYS, DOCS, PROVINCES, SECTORS,
  emailSchema, investorFieldsSchema, joinDetailsSchema, joinDocsFor, orgFieldsSchema, passwordFor, shortDate, shortFingerprint,
  type DocType, type JoinDetails, type Me, type PortalApplicationKind,
} from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ArrowRight, Building2, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, Plus, Upload, User, Users, X, XCircle,
} from "lucide-react";
import { cloneElement, isValidElement, useEffect, useId, useState, type ReactElement, type ReactNode } from "react";
import { useFieldArray, useForm, type FieldErrors, type FieldValues, type UseFormReturn } from "react-hook-form";
import { Link, Navigate } from "react-router-dom";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { selectClass } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FilePick } from "../../components/FilePick";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { AUTH_MODE, useAuth } from "../../lib/auth";
import { HOME_FOR, meKey, useMe } from "../../lib/me";
import { AuthPageShell, PasswordField } from "../auth/SignIn";
import type { DocumentsResponse } from "../founder/types";

// ─── options ────────────────────────────────────────────────────────────────

type Track = "founder" | "funder" | "support_org";
const ALL_SECTORS_FLAT: string[] = [...new Set(Object.values(SECTORS).flat())];

const INVESTOR_TYPES = [
  { value: "vc", label: "Venture capital" }, { value: "angel", label: "Angel investor" }, { value: "pe", label: "Private equity" },
  { value: "dfi", label: "Development finance institution" }, { value: "corporate_csi", label: "Corporate CSI or ESD fund" },
  { value: "bank", label: "Bank" }, { value: "family_office", label: "Family office" }, { value: "grant_maker", label: "Grant maker or foundation" },
  { value: "individual", label: "Individual investor" },
] as const;
const ORG_TYPES = [
  { value: "incubator", label: "Business incubator" }, { value: "accelerator", label: "Accelerator" }, { value: "ngo", label: "NGO" },
  { value: "npo", label: "NPO or NPC" }, { value: "cbo", label: "Community-based organisation" },
] as const;
const STAGES = [
  { value: "idea", label: "Idea, no revenue yet" }, { value: "seed", label: "Seed" }, { value: "early", label: "Early revenue" },
  { value: "growth", label: "Growth" }, { value: "expansion", label: "Expansion" },
];
const INSTRUMENTS = [
  { value: "grant", label: "Grant" }, { value: "debt", label: "Loan" }, { value: "equity", label: "Equity" },
  { value: "convertible", label: "Convertible note" }, { value: "blended", label: "Blended finance" },
];
const AUM_BANDS = [
  { value: "under_1m", label: "Under R1 million" }, { value: "1m_10m", label: "R1 million to R10 million" },
  { value: "10m_100m", label: "R10 million to R100 million" }, { value: "over_100m", label: "Over R100 million" },
];
const BUDGET_BANDS = [
  { value: "under_500k", label: "Under R500 000" }, { value: "500k_2m", label: "R500 000 to R2 million" },
  { value: "2m_10m", label: "R2 million to R10 million" }, { value: "over_10m", label: "Over R10 million" },
];
const BENEFICIARY_GROUPS = ["Youth (18–35)", "Women", "People with disabilities", "Rural communities", "Township entrepreneurs", "Students and graduates", "Informal traders"];

// ─── form helpers ───────────────────────────────────────────────────────────

/** react-hook-form keeps nested errors nested (account.email, coFounders.0.idNumber). */
function errAt(errors: FieldErrors, path: string): string | undefined {
  const e = path.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], errors) as { message?: string } | undefined;
  return e?.message;
}

/** A label tied to its single control (Input, Textarea or select). */
function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactElement; className?: string }) {
  const id = useId();
  const note = error || hint ? `${id}-note` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium leading-none text-foreground">{label}</label>
      {isValidElement(children) ? cloneElement(children as ReactElement<Record<string, unknown>>, { id, "aria-invalid": !!error || undefined, "aria-describedby": note }) : children}
      {(error || hint) && <p id={note} className={cn("text-xs", error ? "text-bad" : "text-muted-foreground")}>{error ?? hint}</p>}
    </div>
  );
}

/** Pick several: toggle buttons in a labelled group. */
function MultiToggle({ legend, options, value, onChange, error }: {
  legend: string; options: readonly { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; error?: string;
}) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1.5 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={value.includes(o.value)} onClick={() => toggle(o.value)}
            className={cn("min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              value.includes(o.value) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-foreground hover:border-primary/50")}>
            {o.label}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-bad">{error}</p>}
    </fieldset>
  );
}

function WizardProgress({ step, total, label }: { step: number; total: number; label: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">Step {step} of {total}</span>
      </div>
      <Progress value={(step / total) * 100} className="h-1.5" aria-label={`Step ${step} of ${total}`} />
    </div>
  );
}

const failMessage = (x: unknown) =>
  x instanceof ApiError ? x.message
  : AUTH_MODE === "firebase" && (x as { code?: string }).code === "auth/email-already-in-use" ? "There's already an account with this email. Sign in instead."
  : "Something went wrong. Try again.";

// ─── the new sign-in (all tracks, when signed out) ──────────────────────────

const accountSchema = z.object({ email: emailSchema, password: z.string(), confirm: z.string() }).superRefine((v, ctx) => {
  const p = passwordFor(v.email).safeParse(v.password);
  if (!p.success) ctx.addIssue({ code: "custom", path: ["password"], message: p.error.issues[0]!.message });
  if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "The two passwords don't match." });
});
type Account = z.infer<typeof accountSchema>;

/** Already signed in (e.g. with Google) but not joined: say which email this uses, and allow a different one. */
function SignedInAs() {
  const auth = useAuth();
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your account</CardTitle>
        <CardDescription>You're signing up as <b className="text-foreground">{auth.email ?? "this account"}</b>. You'll sign in with it.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" size="sm" onClick={() => void auth.signOut()}>Use a different email</Button>
      </CardContent>
    </Card>
  );
}

function AccountCard<T extends FieldValues>({ form }: { form: UseFormReturn<T> }) {
  const e = form.formState.errors;
  const reg = (k: string) => form.register(k as never);
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Your account</CardTitle>
        <CardDescription>You'll sign in with this email and password.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Email" error={errAt(e, "account.email")}><Input type="email" autoComplete="username" inputMode="email" autoCapitalize="none" {...reg("account.email")} /></Field>
        <PasswordField label="Password (at least 12 characters)" autoComplete="new-password" error={errAt(e, "account.password")} {...reg("account.password")} />
        <PasswordField label="Type it again" autoComplete="new-password" error={errAt(e, "account.confirm")} {...reg("account.confirm")} />
      </CardContent>
    </Card>
  );
}

// ─── track chooser ──────────────────────────────────────────────────────────

function TrackChooser({ onSelect }: { onSelect: (t: Track) => void }) {
  const tracks: { track: Track; icon: ReactNode; title: string; desc: string; badge?: string }[] = [
    { track: "founder", icon: <User className="h-6 w-6" />, title: "Business founder", badge: "Most people",
      desc: "Start or grow your business. Build a verified record that funders and buyers can trust." },
    { track: "funder", icon: <Building2 className="h-6 w-6" />, title: "Funder or investor",
      desc: "A fund, DFI, corporate CSI or ESD programme, grant maker or investor funding South African businesses." },
    { track: "support_org", icon: <Users className="h-6 w-6" />, title: "Incubator, NGO or NPO",
      desc: "An incubator, accelerator, NGO, NPO or community organisation supporting founders." },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Choose what fits you. Funders and support organisations are checked by ProofPocket before their portal opens.</p>
      <div className="grid gap-3">
        {tracks.map(({ track, icon, title, desc, badge }) => (
          <button key={track} type="button" onClick={() => onSelect(track)}
            className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 text-left transition-all hover:border-primary/60 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-primary">{icon}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2"><span className="font-semibold">{title}</span>{badge && <Badge variant="success" className="text-[10px]">{badge}</Badge>}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{desc}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 self-center text-muted-foreground group-hover:text-primary" />
          </button>
        ))}
      </div>
      <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/sign-in" className="font-medium text-primary hover:underline">Sign in</Link></p>
    </div>
  );
}

// ─── founder track ──────────────────────────────────────────────────────────

type FounderForm = JoinDetails & { account?: Account };

function FounderDetails({ signedOut, onDone }: { signedOut: boolean; onDone: () => void }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const [showCoFounders, setShowCoFounders] = useState(false);
  const options = useQuery({ queryKey: ["join-options"], queryFn: () => api<{ incubators: { id: string; name: string }[] }>("/join/options") });
  const schema = signedOut ? joinDetailsSchema.and(z.object({ account: accountSchema })) : joinDetailsSchema;
  const form = useForm<FounderForm>({
    resolver: zodResolver(schema as never),
    defaultValues: { businessType: "beauty", sector: SECTORS.beauty[0], province: "Gauteng", area: "township", incubatorId: null, registered: false, coFounders: [] },
  });
  const cofounders = useFieldArray({ control: form.control, name: "coFounders" as never });
  const type = form.watch("businessType");
  const registered = form.watch("registered");
  useEffect(() => {
    if (!SECTORS[type].includes(form.getValues("sector"))) form.setValue("sector", SECTORS[type][0]!);
  }, [type, form]);
  const e = form.formState.errors;
  const reg = (k: string) => form.register(k as never);

  const submit = form.handleSubmit(async ({ account, ...d }) => {
    setErr("");
    try {
      if (account) await auth.signUp(account.email, account.password);
      await api("/join", { body: { ...d, incubatorId: d.incubatorId || null } });
      await qc.invalidateQueries({ queryKey: meKey });
      onDone();
    } catch (x) { setErr(failMessage(x)); }
  });

  return (
    <form className="space-y-6" onSubmit={submit} noValidate>
      <WizardProgress step={1} total={3} label="About you and your business" />
      {signedOut ? <AccountCard form={form} /> : <SignedInAs />}

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">About you</CardTitle>
          <CardDescription>Your ID number is encrypted and only you and ProofPocket's checker can see it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name" error={errAt(e, "founderName")}><Input autoComplete="name" {...reg("founderName")} /></Field>
          <Field label="SA ID number" error={errAt(e, "idNumber")} hint="The 13 digits on your ID book or card"><Input inputMode="numeric" maxLength={13} autoComplete="off" {...reg("idNumber")} /></Field>
          <Field label="Cellphone number" error={errAt(e, "phone")} hint="e.g. 082 123 4567"><Input type="tel" autoComplete="tel" {...reg("phone")} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">Your business</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name" error={errAt(e, "businessName")}><Input {...reg("businessName")} /></Field>
          <Field label="Type of business" error={errAt(e, "businessType")}>
            <select className={selectClass} {...reg("businessType")}>{BUSINESS_TYPE_KEYS.map((k) => <option key={k} value={k}>{BUSINESS_TYPES[k].label}</option>)}</select>
          </Field>
          <Field label="Sector" error={errAt(e, "sector")}>
            <select className={selectClass} {...reg("sector")}>{SECTORS[type].map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </Field>
          <Field label="Town or township" error={errAt(e, "town")}><Input {...reg("town")} /></Field>
          <Field label="Province" error={errAt(e, "province")}>
            <select className={selectClass} {...reg("province")}>{PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
          </Field>
          <Field label="Area" error={errAt(e, "area")}>
            <select className={selectClass} {...reg("area")}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <Field label="Incubator or NGO supporting you" className="sm:col-span-2">
            <select className={selectClass} value={form.watch("incubatorId") ?? ""} onChange={(ev) => form.setValue("incubatorId", ev.target.value || null)}>
              <option value="">None yet</option>
              {options.data?.incubators.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">Is the business registered with CIPC?</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Is the business registered with CIPC?</legend>
            {([[false, "Not yet", "Start as a Starter. We'll guide you through registering."], [true, "Yes", "Upload your documents to get the Verified badge."]] as const).map(([v, title, desc]) => (
              <label key={title} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                registered === v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                <input type="radio" name="registered" className="mt-0.5 h-4 w-4 accent-[var(--accent)]" checked={registered === v} onChange={() => form.setValue("registered", v)} />
                <span><span className="block text-sm font-medium">{title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span></span>
              </label>
            ))}
          </fieldset>
          {registered && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Registered company name" error={errAt(e, "legalName")}><Input {...reg("legalName")} /></Field>
              <Field label="CIPC number" error={errAt(e, "cipcNumber")} hint="Looks like 2024/123456/07"><Input className="font-mono" {...reg("cipcNumber")} /></Field>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
          <div className="space-y-1.5">
            <CardTitle className="text-base">Co-founders and directors</CardTitle>
            <CardDescription>Optional. Add business partners or co-directors.</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" aria-expanded={showCoFounders} onClick={() => setShowCoFounders((v) => !v)}>
            {showCoFounders ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{cofounders.fields.length ? `${cofounders.fields.length} added` : "Add"}
          </Button>
        </CardHeader>
        {showCoFounders && (
          <CardContent className="space-y-4">
            {cofounders.fields.map((f, i) => (
              <fieldset key={f.id} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <legend className="text-sm font-medium">Co-founder {i + 1}</legend>
                  <button type="button" aria-label={`Remove co-founder ${i + 1}`} onClick={() => cofounders.remove(i)} className="rounded p-1 text-muted-foreground hover:text-bad"><X className="h-4 w-4" /></button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" error={errAt(e, `coFounders.${i}.fullName`)}><Input {...reg(`coFounders.${i}.fullName`)} /></Field>
                  <Field label="SA ID number" error={errAt(e, `coFounders.${i}.idNumber`)}><Input inputMode="numeric" maxLength={13} autoComplete="off" {...reg(`coFounders.${i}.idNumber`)} /></Field>
                  <Field label="Role" error={errAt(e, `coFounders.${i}.role`)}><Input placeholder="e.g. Director" {...reg(`coFounders.${i}.role`)} /></Field>
                  <Field label="Email" error={errAt(e, `coFounders.${i}.email`)}><Input type="email" autoCapitalize="none" {...reg(`coFounders.${i}.email`)} /></Field>
                  <Field label="Cellphone number" error={errAt(e, `coFounders.${i}.phone`)}><Input type="tel" {...reg(`coFounders.${i}.phone`)} /></Field>
                  <Field label="Shareholding % (optional)" error={errAt(e, `coFounders.${i}.shareholding`)}><Input type="number" min={1} max={99} {...reg(`coFounders.${i}.shareholding`)} /></Field>
                </div>
              </fieldset>
            ))}
            {cofounders.fields.length < 5 && (
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => cofounders.append({ fullName: "", idNumber: "", role: "", email: "", phone: "" } as never)}>
                <Plus className="h-4 w-4" />Add a co-founder or director
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {err && <Callout tone="bad" role="alert">{err}</Callout>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">Takes about five minutes.</p>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Saving…</> : <>Continue <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </div>
    </form>
  );
}

const OPTIONAL_DOCS: Record<"registered" | "starter", { key: DocType; why: string }[]> = {
  registered: [
    { key: "tax", why: "Needed for tenders and most funders." },
    { key: "bbbee", why: "Government and corporate buyers ask for it. An affidavit is enough for a small business." },
    { key: "bplan", why: "Most funders ask for one." },
    { key: "fin", why: "Funders use it to see how the business is doing." },
    { key: "csd", why: "Needed to sell to government." },
  ],
  starter: [
    { key: "bbbee", why: "You can get a sworn affidavit as a sole proprietor. Buyers and funders ask for it." },
    { key: "tax", why: "Register on SARS eFiling and upload the notice. Most formal markets need it." },
  ],
};

function DocRow({ doc, docType, hint, required, onAttach, onError }: {
  doc: DocumentsResponse["documents"][number] | undefined; docType: DocType; hint: string; required: boolean;
  onAttach: (k: DocType, fileId: string) => void; onError: (m: string) => void;
}) {
  const uploaded = !!doc && doc.state !== "missing";
  return (
    <div className={cn(required && "upload", "flex items-start justify-between gap-4 rounded-lg border p-4 transition-colors", uploaded ? "border-good/40 bg-good-soft/40" : "border-border")}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {uploaded ? <CheckCircle2 className="h-4 w-4 shrink-0 text-good" /> : <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />}
          <b className="text-sm">{DOCS[docType].name}</b>
          {!required && !uploaded && DOCS[docType].pts > 0 && <Badge variant="secondary" className="text-[10px]">+{DOCS[docType].pts} points</Badge>}
        </div>
        {uploaded && doc.sha256
          ? <><div className="ml-6 mt-1 text-xs">{doc.fileName}</div><div className="fp ml-6 font-mono text-xs text-muted-foreground">Fingerprint {shortFingerprint(doc.sha256)}</div></>
          : <p className="ml-6 mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <FilePick label={uploaded ? "Replace" : "Upload"} primary={required && !uploaded} onUploaded={(f) => onAttach(docType, f.fileId)} onError={onError} />
    </div>
  );
}

const REQUIRED_HINT: Partial<Record<DocType, string>> = {
  id: "A clear copy of your green ID book or smart ID card. PDF or photo, up to 5 MB.",
  cipc: "The registration certificate from CIPC. PDF preferred.",
  bank: "A confirmation letter for the business bank account, usually downloadable from your banking app.",
  addr: "A utility bill, lease, or a letter from your landlord or ward councillor showing where you trade.",
};

function FounderDocuments({ data, onBack, onNext }: { data: DocumentsResponse; onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const registered = data.company.registered;
  const need = joinDocsFor(registered);
  const doc = (k: DocType) => data.documents.find((d) => d.docType === k);
  const attach = async (k: DocType, fileId: string) => {
    setErr("");
    try { await api("/founder/documents", { body: { docType: k, fileId } }); await qc.invalidateQueries({ queryKey: ["founder-documents"] }); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Try again."); }
  };
  const next = () => {
    const miss = need.filter((k) => !doc(k) || doc(k)!.state === "missing");
    if (miss.length) { setErr(`Attach: ${miss.map((k) => DOCS[k].name).join(", ")}.`); return; }
    onNext();
  };
  return (
    <div className="space-y-6">
      <WizardProgress step={2} total={3} label="Your documents" />
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{registered ? "Documents that prove you're a registered business" : "Confirm who you are"}</CardTitle>
          <CardDescription>{registered
            ? "All four are checked by your adviser or a ProofPocket checker. Each file gets a fingerprint."
            : "Starters show an ID and proof of address so nobody can sign up as you. You'll add business documents later."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {need.map((k) => <DocRow key={k} doc={doc(k)} docType={k} required hint={REQUIRED_HINT[k] ?? "PDF or photo, up to 5 MB"} onAttach={(t, f) => void attach(t, f)} onError={setErr} />)}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">More documents (optional)</CardTitle>
          <CardDescription>Not needed to join. Each one raises your readiness score and opens more opportunities. Add them now or later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {OPTIONAL_DOCS[registered ? "registered" : "starter"].map(({ key, why }) => <DocRow key={key} doc={doc(key)} docType={key} required={false} hint={why} onAttach={(t, f) => void attach(t, f)} onError={setErr} />)}
        </CardContent>
      </Card>
      {err && <Callout tone="bad" role="alert">{err}</Callout>}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</Button>
        <Button onClick={next}>Continue <ArrowRight className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

const Item = ({ label, children }: { label: string; children: ReactNode }) => (
  <div><span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span><div className="mt-1 font-medium">{children}</div></div>
);

function FounderConfirm({ data, onBack, onJoined }: { data: DocumentsResponse; onBack: () => void; onJoined: () => void }) {
  const { data: me } = useMe();
  const toast = useToast();
  const qc = useQueryClient();
  const options = useQuery({ queryKey: ["join-options"], queryFn: () => api<{ incubators: { id: string; name: string }[] }>("/join/options") });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const need = joinDocsFor(data.company.registered);
  const c = data.company;
  const join = useMutation({
    mutationFn: () => api<{ message: string }>("/join/complete", { body: { agree: true } }),
    onSuccess: async (r) => {
      toast(r.message);
      onJoined();
      // The cached account must say "joined" before the founder routes check it.
      qc.setQueryData<Me>(meKey, (m) => (m?.company ? { ...m, company: { ...m.company, joined: true } } : m));
      await qc.invalidateQueries({ queryKey: meKey });
    },
  });
  return (
    <div className="space-y-6">
      <WizardProgress step={3} total={3} label="Check and join" />
      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">Check and join</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Business">{c.name}{c.cipcNumber && <span className="ml-2 font-mono text-xs text-muted-foreground">{c.cipcNumber}</span>}</Item>
            <Item label="Owner">{me?.displayName}</Item>
            <Item label="Supported by">{options.data?.incubators.find((n) => n.id === c.incubatorId)?.name ?? "None yet"}</Item>
            <Item label="Account">{c.registered ? <Badge variant="success">Verified, once documents are checked</Badge> : <Badge variant="secondary">Starter</Badge>}</Item>
          </div>
          <Separator />
          <ul className="space-y-2">{need.map((k) => (
            <li key={k} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-good" />{DOCS[k].name}<Badge variant="success" className="text-[10px]">Attached</Badge></li>
          ))}</ul>
          <Separator />
          <label className="flex cursor-pointer items-start gap-3">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={agree} onChange={(ev) => { setAgree(ev.target.checked); setErr(""); }} />
            <span className="text-sm leading-relaxed">These documents belong to me and this business. I agree that my chosen incubator can see my records, and that verified funders see only what I allow under Privacy &amp; sharing. I've read the <a href="/privacy-notice" target="_blank" rel="noopener" className="font-medium text-primary hover:underline">privacy notice</a>.</span>
          </label>
          {(err || join.error) && <Callout tone="bad" role="alert">{err || (join.error as ApiError).message}</Callout>}
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</Button>
        <Button disabled={join.isPending} onClick={() => (agree ? join.mutate() : setErr("Tick the box to confirm before joining."))}>
          {join.isPending ? <><Loader2 className="h-4 w-4 animate-spin" />Joining…</> : "Join ProofPocket"}
        </Button>
      </div>
    </div>
  );
}

// ─── funder and support-organisation applications ──────────────────────────

const funderStep1 = investorFieldsSchema.pick({
  repName: true, repIdNumber: true, repRole: true, repEmail: true, repPhone: true, orgName: true, entityType: true,
  website: true, email: true, phone: true, province: true, town: true, physicalAddress: true, cipcNumber: true,
});
const orgStep1 = orgFieldsSchema.pick({
  contactName: true, contactIdNumber: true, contactRole: true, contactEmail: true, contactPhone: true, orgType: true, orgName: true,
  website: true, orgEmail: true, orgPhone: true, province: true, town: true, physicalAddress: true, cipcNumber: true, npoNumber: true,
});
type Step1 = Record<string, unknown> & { account?: Account };

/** Step 1: the person and the organisation (plus the new sign-in when signed out). */
function ApplicationStep1({ kind, signedOut, initial, onNext }: { kind: PortalApplicationKind; signedOut: boolean; initial: Step1; onNext: (d: Step1) => void }) {
  const base = kind === "funder" ? funderStep1 : orgStep1;
  const schema = signedOut ? base.and(z.object({ account: accountSchema })) : base;
  const form = useForm<Step1>({ resolver: zodResolver(schema as never), defaultValues: initial });
  const e = form.formState.errors;
  const reg = (k: string) => form.register(k as never);
  const p = kind === "funder" ? { name: "repName", id: "repIdNumber", role: "repRole", email: "repEmail", phone: "repPhone", orgEmail: "email", orgPhone: "phone" }
    : { name: "contactName", id: "contactIdNumber", role: "contactRole", email: "contactEmail", phone: "contactPhone", orgEmail: "orgEmail", orgPhone: "orgPhone" };
  const orgType = form.watch("orgType") as string | undefined;
  const npo = orgType === "ngo" || orgType === "npo" || orgType === "cbo";
  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onNext)} noValidate>
      <WizardProgress step={1} total={2} label="You and your organisation" />
      {signedOut ? <AccountCard form={form} /> : <SignedInAs />}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Contact person</CardTitle>
          <CardDescription>The person applying. ProofPocket calls this number to check the application. The ID number is encrypted.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errAt(e, p.name)}><Input autoComplete="name" {...reg(p.name)} /></Field>
          <Field label="SA ID number" error={errAt(e, p.id)} hint="13 digits"><Input inputMode="numeric" maxLength={13} autoComplete="off" {...reg(p.id)} /></Field>
          <Field label="Your role" error={errAt(e, p.role)}><Input placeholder={kind === "funder" ? "e.g. Investment manager" : "e.g. Programme manager"} {...reg(p.role)} /></Field>
          <Field label="Your work email" error={errAt(e, p.email)}><Input type="email" autoCapitalize="none" {...reg(p.email)} /></Field>
          <Field label="Your cellphone number" error={errAt(e, p.phone)}><Input type="tel" autoComplete="tel" {...reg(p.phone)} /></Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-4"><CardTitle className="text-base">Organisation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {kind === "funder"
              ? <Field label="Type of funder" error={errAt(e, "entityType")}><select className={selectClass} defaultValue="" {...reg("entityType")}><option value="" disabled>Choose…</option>{INVESTOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>
              : <Field label="Type of organisation" error={errAt(e, "orgType")}><select className={selectClass} defaultValue="" {...reg("orgType")}><option value="" disabled>Choose…</option>{ORG_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></Field>}
            <Field label="Organisation name" error={errAt(e, "orgName")}><Input {...reg("orgName")} /></Field>
            <Field label="Website" error={errAt(e, "website")}><Input type="url" placeholder="https://" {...reg("website")} /></Field>
            <Field label="Organisation email" error={errAt(e, p.orgEmail)}><Input type="email" autoCapitalize="none" {...reg(p.orgEmail)} /></Field>
            <Field label="Organisation phone" error={errAt(e, p.orgPhone)} hint="A landline is fine"><Input type="tel" {...reg(p.orgPhone)} /></Field>
            <Field label="Province" error={errAt(e, "province")}><select className={selectClass} defaultValue="" {...reg("province")}><option value="" disabled>Choose…</option>{PROVINCES.map((x) => <option key={x} value={x}>{x}</option>)}</select></Field>
            <Field label="Town or city" error={errAt(e, "town")}><Input {...reg("town")} /></Field>
            {kind === "support_org" && npo
              ? <Field label="NPO number" error={errAt(e, "npoNumber")} hint="Looks like 123-456"><Input {...reg("npoNumber")} /></Field>
              : <Field label={kind === "funder" ? "CIPC number (if registered)" : "CIPC number"} error={errAt(e, "cipcNumber")} hint="Looks like 2024/123456/07"><Input className="font-mono" {...reg("cipcNumber")} /></Field>}
          </div>
          <Field label="Physical address" error={errAt(e, "physicalAddress")}><Textarea rows={2} {...reg("physicalAddress")} /></Field>
        </CardContent>
      </Card>
      <div className="flex justify-end"><Button type="submit">Continue <ArrowRight className="h-4 w-4" /></Button></div>
    </form>
  );
}

const funderStep2 = investorFieldsSchema.pick({ sectors: true, stages: true, instruments: true, ticketMin: true, ticketMax: true, aumBand: true, description: true });
const orgStep2 = orgFieldsSchema.pick({ sectors: true, beneficiaryGroups: true, foundedYear: true, annualBudgetBand: true, description: true });

/** Step 2: what they fund or how they support founders; then the application is sent. */
function ApplicationStep2({ kind, initial, busy, onBack, onSend }: { kind: PortalApplicationKind; initial: Step1; busy: boolean; onBack: () => void; onSend: (d: Record<string, unknown>) => void }) {
  const form = useForm<Record<string, unknown>>({
    resolver: zodResolver((kind === "funder" ? funderStep2 : orgStep2) as never),
    defaultValues: { sectors: [], stages: [], instruments: [], beneficiaryGroups: [], foundedYear: new Date().getFullYear(), ...initial },
  });
  const e = form.formState.errors;
  const reg = (k: string) => form.register(k as never);
  const list = (k: string) => (form.watch(k) as string[] | undefined) ?? [];
  const set = (k: string) => (v: string[]) => form.setValue(k, v, { shouldValidate: form.formState.isSubmitted });
  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSend)} noValidate>
      <WizardProgress step={2} total={2} label={kind === "funder" ? "What you fund" : "How you support founders"} />
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">{kind === "funder" ? "What you fund" : "Your programmes"}</CardTitle>
          <CardDescription>{kind === "funder" ? "Founders see this when they look at your programmes." : "Founders see this when they choose who supports them."}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <MultiToggle legend={kind === "funder" ? "Sectors you fund" : "Sectors or causes you support"} options={ALL_SECTORS_FLAT.map((s) => ({ value: s, label: s }))} value={list("sectors")} onChange={set("sectors")} error={errAt(e, "sectors")} />
          {kind === "funder" ? <>
            <MultiToggle legend="Business stages" options={STAGES} value={list("stages")} onChange={set("stages")} error={errAt(e, "stages")} />
            <MultiToggle legend="How you fund" options={INSTRUMENTS} value={list("instruments")} onChange={set("instruments")} error={errAt(e, "instruments")} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Smallest amount (R)" error={errAt(e, "ticketMin")}><Input type="number" min={0} inputMode="numeric" {...reg("ticketMin")} /></Field>
              <Field label="Largest amount (R)" error={errAt(e, "ticketMax")}><Input type="number" min={1} inputMode="numeric" {...reg("ticketMax")} /></Field>
              <Field label="Funds under management" error={errAt(e, "aumBand")}><select className={selectClass} defaultValue="" {...reg("aumBand")}><option value="" disabled>Choose…</option>{AUM_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></Field>
            </div>
          </> : <>
            <MultiToggle legend="Who you support" options={BENEFICIARY_GROUPS.map((g) => ({ value: g, label: g }))} value={list("beneficiaryGroups")} onChange={set("beneficiaryGroups")} error={errAt(e, "beneficiaryGroups")} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Year started" error={errAt(e, "foundedYear")}><Input type="number" min={1900} max={new Date().getFullYear()} {...reg("foundedYear")} /></Field>
              <Field label="Yearly budget" error={errAt(e, "annualBudgetBand")}><select className={selectClass} defaultValue="" {...reg("annualBudgetBand")}><option value="" disabled>Choose…</option>{BUDGET_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}</select></Field>
            </div>
          </>}
          <Field label={kind === "funder" ? "Describe what you fund" : "Your mission and programmes"} error={errAt(e, "description")}><Textarea rows={4} maxLength={1000} {...reg("description")} /></Field>
        </CardContent>
      </Card>
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</Button>
        <Button type="submit" disabled={busy}>{busy ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : "Send application"}</Button>
      </div>
    </form>
  );
}

function ApplicationTrack({ kind, signedOut, onBack }: { kind: PortalApplicationKind; signedOut: boolean; onBack: () => void }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [first, setFirst] = useState<Step1>({});
  const [pending, setPending] = useState<Record<string, unknown> | null>(null);
  const [verify, setVerify] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const send = async (details: Record<string, unknown>) => {
    setErr(""); setBusy(true);
    try {
      await api("/join/applications", { body: { kind, details } });
      await qc.invalidateQueries({ queryKey: ["join-application"] });
    } catch (x) {
      if (x instanceof ApiError && x.code === "verify_email") { setPending(details); setVerify(auth.email); }
      else setErr(failMessage(x));
    } finally { setBusy(false); }
  };
  const submit = async (rest: Record<string, unknown>) => {
    const { account, ...d1 } = first;
    setErr("");
    if (account) {
      setBusy(true);
      try { await auth.signUp(account.email, account.password); }
      catch (x) { setBusy(false); setErr(failMessage(x)); return; }
      setFirst(d1);
    }
    await send({ ...d1, ...rest });
  };

  if (verify !== null) {
    return (
      <Card>
        <CardHeader><CardTitle className="text-base">Confirm your email address</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">We sent a link to <b>{verify}</b>. Open it, then come back here and send your application.</p>
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
          <Button disabled={busy} onClick={() => void auth.refresh().then(() => send(pending!))}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}I've confirmed it. Send application</Button>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-3.5 w-3.5" />Choose again</button>
      {step === 1 && <ApplicationStep1 kind={kind} signedOut={signedOut} initial={first} onNext={(d) => { setFirst(d); setStep(2); }} />}
      {step === 2 && <ApplicationStep2 kind={kind} initial={first} busy={busy} onBack={() => setStep(1)} onSend={(d) => void submit(d)} />}
      {err && <Callout tone="bad" role="alert">{err}</Callout>}
    </div>
  );
}

interface MyApplication { kind: PortalApplicationKind; orgName: string; status: "pending" | "approved" | "rejected"; reason: string | null; sentOn: string }

/** What an applicant sees each time they sign in, until (and after) a decision. */
function ApplicationStatus({ a }: { a: MyApplication }) {
  const auth = useAuth();
  const portal = a.kind === "funder" ? "funder portal" : "support organisation portal";
  return (
    <Card>
      <CardContent className="space-y-4 pt-6 text-center">
        <span className={cn("mx-auto flex h-14 w-14 items-center justify-center rounded-full", a.status === "rejected" ? "bg-bad-soft text-bad" : "bg-accent-soft text-primary")}>
          {a.status === "rejected" ? <XCircle className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
        </span>
        {a.status === "rejected" ? <>
          <h2 className="text-lg font-semibold">We couldn't approve this application</h2>
          <p className="text-sm text-muted-foreground">The {portal} for <b className="text-foreground">{a.orgName}</b> wasn't approved.</p>
          {a.reason && <Callout tone="bad" className="text-left"><b>The reason:</b> {a.reason}</Callout>}
          <p className="text-sm text-muted-foreground">If something can be fixed, reply to the email we sent you and we'll look at it again.</p>
        </> : <>
          <h2 className="text-lg font-semibold">We're checking your application</h2>
          <p className="text-sm text-muted-foreground">You applied for a {portal} for <b className="text-foreground">{a.orgName}</b> on {shortDate(String(a.sentOn).slice(0, 10))}. ProofPocket will call you to confirm the details, usually within 2–3 business days, and email you once it's decided.</p>
        </>}
        <Button variant="outline" onClick={() => void auth.signOut()}>Sign out</Button>
      </CardContent>
    </Card>
  );
}

// ─── side panel ─────────────────────────────────────────────────────────────

function Aside({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      <ul className="space-y-2 text-sm text-muted-foreground">
        {items.map((t) => <li key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /><span>{t}</span></li>)}
      </ul>
    </div>
  );
}

function JoinSidebar({ track }: { track: Track | null }) {
  if (track === "funder") return <div className="space-y-4">
    <Aside title="How funders are checked" items={["Send this application", "ProofPocket calls the contact person and checks the registration", "You hear back by email, usually within 2–3 business days", "Once approved, set your programme requirements and see Verified businesses"]} />
    <Callout tone="info">ProofPocket never charges funders or founders a fee. If anyone asks you to pay to be listed, report it.</Callout>
  </div>;
  if (track === "support_org") return <div className="space-y-4">
    <Aside title="How organisations are checked" items={["Send this application", "ProofPocket calls the contact person and checks the CIPC or NPO number", "You hear back by email, usually within 2–3 business days", "Once approved, founders can choose you and you check their documents"]} />
    <Aside title="What you get" items={["A cohort board of the businesses you support", "Document checks for your founders", "A list of businesses that need attention", "Support requests from your founders"]} />
  </div>;
  return <div className="space-y-4">
    <Aside title="Starter or Verified?" items={["Starter: books, stock, payments, cash flow, the registration guide and sharing posts from your own accounts", "Verified: everything in Starter, plus the badge, the public directory, funder matching, buyer introductions and tenders", "Both are free"]} />
    <Callout tone="info">ProofPocket never holds or moves your money. Clients pay you directly.</Callout>
  </div>;
}

// ─── page ───────────────────────────────────────────────────────────────────

const TITLES: Record<Track | "choose", string> = {
  choose: "Join ProofPocket", founder: "Start your business record", funder: "Apply for a funder portal", support_org: "Apply for a support organisation portal",
};

export default function Join() {
  const auth = useAuth();
  const me = useMe();
  const signedOut = auth.status === "signedOut";
  const noAccount = me.error instanceof ApiError && me.error.code === "no_account";
  const unjoined = me.data?.role === "founder" && me.data.company && !me.data.company.joined;
  const docs = useQuery({ queryKey: ["founder-documents"], queryFn: () => api<DocumentsResponse>("/founder/documents"), enabled: !!unjoined });
  const mine = useQuery({ queryKey: ["join-application"], queryFn: () => api<{ application: MyApplication | null }>("/join/application"), enabled: noAccount });
  const [chosen, setChosen] = useState<Track | null>(null);
  const [founderStep, setFounderStep] = useState<1 | 2 | 3 | null>(null);
  const [joined, setJoined] = useState(false);

  if (joined) return <Navigate to="/app/start" replace />;
  if (auth.status === "loading" || (auth.status === "signedIn" && me.isPending) || (noAccount && mine.isPending)) return <Spinner />;
  if (me.data && !unjoined) return <Navigate to={HOME_FOR[me.data.role]} replace />;
  if (me.data?.needsOtp) return <Navigate to="/verify" replace />;

  const application = mine.data?.application ?? null;
  const track: Track | null = unjoined ? "founder" : chosen;
  // A founder who comes back before finishing starts at Documents.
  const step = founderStep ?? (unjoined ? 2 : 1);

  return (
    <AuthPageShell wide toSignIn>
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{application ? "Your application" : TITLES[track ?? "choose"]}</h1>
        {!application && !track && <p className="text-sm text-muted-foreground">Anyone can start. Registered businesses that pass the document check get the Verified badge, which funders, buyers and customers look for.</p>}
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <div className="w-full min-w-0 lg:flex-1">
          {application ? <ApplicationStatus a={application} />
            : !track ? <TrackChooser onSelect={setChosen} />
            : track === "founder" ? <>
                {step === 1 && (signedOut || noAccount || unjoined) && <FounderDetails signedOut={signedOut} onDone={() => setFounderStep(2)} />}
                {step === 2 && docs.data && <FounderDocuments data={docs.data} onBack={() => setFounderStep(1)} onNext={() => setFounderStep(3)} />}
                {step === 3 && docs.data && <FounderConfirm data={docs.data} onBack={() => setFounderStep(2)} onJoined={() => setJoined(true)} />}
                {step > 1 && !docs.data && <Spinner />}
              </>
            : <ApplicationTrack kind={track} signedOut={signedOut} onBack={() => setChosen(null)} />}
        </div>
        <aside className="w-full lg:sticky lg:top-8 lg:w-80 lg:shrink-0 lg:self-start"><JoinSidebar track={application ? application.kind : track} /></aside>
      </div>
      {!application && track !== "funder" && track !== "support_org" && <Callout tone="info">Once you've joined, set up <b>Google Authenticator</b> in Business settings so nobody can use a stolen password to get in.</Callout>}
    </AuthPageShell>
  );
}
