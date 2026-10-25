// Join wizard: Details → Documents → Join (v2/app.js vJoin). Creating the account is part of Details.
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AREAS, BUSINESS_TYPES, BUSINESS_TYPE_KEYS, DOCS, PROVINCES, SECTORS, joinDetailsSchema, joinDocsFor, passwordFor, emailSchema,
  shortFingerprint, type DocType, type JoinDetails, type Me,
} from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate } from "react-router-dom";
import { z } from "zod";
import { FilePick } from "../../components/FilePick";
import { Notice, PageHead, Pill, Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { AUTH_MODE, useAuth } from "../../lib/auth";
import { HOME_FOR, meKey, useMe } from "../../lib/me";
import { AuthPageShell, PasswordField } from "../auth/SignIn";
import type { DocumentsResponse } from "../founder/types";

const accountSchema = z.object({ email: emailSchema, password: z.string(), confirm: z.string() }).superRefine((v, ctx) => {
  const p = passwordFor(v.email).safeParse(v.password);
  if (!p.success) ctx.addIssue({ code: "custom", path: ["password"], message: p.error.issues[0]!.message });
  if (v.password !== v.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "The two passwords don't match." });
});

type Form = JoinDetails & { account?: z.infer<typeof accountSchema> };

function Steps({ step }: { step: number }) {
  const ws = (n: number, t: string) => <span className={`ws ${step === n ? "on" : step > n ? "done" : ""}`}><b>{step > n ? "✓" : n}</b>{t}</span>;
  return <div className="wizard-steps" aria-label={`Step ${step} of 3`}>{ws(1, "Details")}{ws(2, "Documents")}{ws(3, "Join")}</div>;
}

function Explainer() {
  return (
    <aside className="panel stack">
      <h2>Starter or Verified?</h2>
      <div className="li"><div className="li-main"><b>Starter</b><span className="small">Books, stock, payments, cash flow, the registration guide, and sharing posts from your own accounts.</span></div></div>
      <div className="li"><div className="li-main"><b>Verified</b><span className="small">Everything in Starter, plus the badge, the public directory, funder matching, buyer introductions and tenders.</span></div></div>
      <p className="hint">Both are free.</p>
    </aside>
  );
}

function Details({ signedOut, onDone }: { signedOut: boolean; onDone: () => void }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const options = useQuery({ queryKey: ["join-options"], queryFn: () => api<{ incubators: { id: string; name: string }[] }>("/join/options") });
  const schema = signedOut ? joinDetailsSchema.and(z.object({ account: accountSchema })) : joinDetailsSchema;
  const form = useForm<Form>({
    resolver: zodResolver(schema as never),
    defaultValues: { businessType: "beauty", sector: SECTORS.beauty[0], province: "Gauteng", area: "township", incubatorId: null, registered: false },
  });
  const type = form.watch("businessType");
  const registered = form.watch("registered");
  useEffect(() => { if (!SECTORS[type].includes(form.getValues("sector"))) form.setValue("sector", SECTORS[type][0]!); }, [type, form]);

  const e = form.formState.errors;
  const submit = form.handleSubmit(async ({ account, ...d }) => {
    setErr("");
    try {
      if (account) await auth.signUp(account.email, account.password);
      await api("/join", { body: { ...d, incubatorId: d.incubatorId || null } });
      await qc.invalidateQueries({ queryKey: meKey });
      onDone();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : AUTH_MODE === "firebase" && (x as { code?: string }).code === "auth/email-already-in-use"
        ? "There's already an account with this email. Sign in instead." : "Something went wrong. Try again.");
    }
  });
  const fieldErr = (m?: string) => m && <p className="err">{m}</p>;

  return (
    <form className="panel stack" onSubmit={submit} noValidate>
      <h2>About you and your business</h2>
      {signedOut && (
        <fieldset className="form-grid">
          <legend className="label mb-2">Your account</legend>
          <label className="field"><span>Email</span><input type="email" autoComplete="username" autoCapitalize="none" {...form.register("account.email")} />{fieldErr(e.account?.email?.message)}</label>
          <PasswordField label="Password (at least 12 characters)" autoComplete="new-password" error={e.account?.password?.message} {...form.register("account.password")} />
          <PasswordField label="Type it again" autoComplete="new-password" error={e.account?.confirm?.message} {...form.register("account.confirm")} />
        </fieldset>
      )}
      <div className="form-grid">
        <label className="field"><span>Your name</span><input type="text" autoComplete="name" {...form.register("founderName")} />{fieldErr(e.founderName?.message)}</label>
        <label className="field"><span>Business name</span><input type="text" {...form.register("businessName")} />{fieldErr(e.businessName?.message)}</label>
        <label className="field"><span>Type of business</span>
          <select {...form.register("businessType")}>{BUSINESS_TYPE_KEYS.map((k) => <option key={k} value={k}>{BUSINESS_TYPES[k].label}</option>)}</select>
        </label>
        <label className="field"><span>Sector</span>
          <select {...form.register("sector")}>{SECTORS[type].map((s) => <option key={s}>{s}</option>)}</select>
        </label>
        <label className="field"><span>Town or township</span><input type="text" {...form.register("town")} />{fieldErr(e.town?.message)}</label>
        <label className="field"><span>Province</span><select {...form.register("province")}>{PROVINCES.map((p) => <option key={p}>{p}</option>)}</select></label>
        <label className="field"><span>Area</span><select {...form.register("area")}>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Incubator or NGO supporting you</span>
          <select {...form.register("incubatorId", { setValueAs: (v) => v || null })}>
            <option value="">None yet</option>
            {options.data?.incubators.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="stack" style={{ gap: 6 }}>
        <legend className="small muted font-semibold">Is the business registered with CIPC?</legend>
        <div className="row">
          <label className="radio-card"><input type="radio" checked={!registered} onChange={() => form.setValue("registered", false)} /><span><b>Not yet</b><span className="hint">Start as a Starter. We'll guide you through registering.</span></span></label>
          <label className="radio-card"><input type="radio" checked={registered} onChange={() => form.setValue("registered", true)} /><span><b>Yes</b><span className="hint">Upload your documents to get verified.</span></span></label>
        </div>
      </fieldset>
      {registered && (
        <div className="form-grid">
          <label className="field"><span>Registered name</span><input type="text" {...form.register("legalName")} /></label>
          <label className="field"><span>CIPC number</span><input type="text" className="mono" placeholder="2024/123456/07" {...form.register("cipcNumber")} />{fieldErr(e.cipcNumber?.message)}</label>
        </div>
      )}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row between">
        <span className="hint">Takes about five minutes.{signedOut && <> Already have an account? <Link to="/sign-in">Sign in</Link></>}</span>
        <button className="btn primary" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Saving…" : "Continue"}</button>
      </div>
    </form>
  );
}

function Documents({ data, onBack, onNext }: { data: DocumentsResponse; onBack: () => void; onNext: () => void }) {
  const qc = useQueryClient();
  const [err, setErr] = useState("");
  const need = joinDocsFor(data.company.registered);
  const doc = (k: DocType) => data.documents.find((d) => d.docType === k)!;
  const attach = async (k: DocType, fileId: string) => {
    setErr("");
    try { await api("/founder/documents", { body: { docType: k, fileId } }); await qc.invalidateQueries({ queryKey: ["founder-documents"] }); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Try again."); }
  };
  const next = () => {
    const miss = need.filter((k) => doc(k).state === "missing");
    if (miss.length) { setErr(`Attach: ${miss.map((k) => DOCS[k].name).join(", ")}.`); return; }
    onNext();
  };
  return (
    <div className="panel stack">
      <h2>{data.company.registered ? "Documents that prove you're a registered business" : "Confirm who you are"}</h2>
      <p className="small muted">{data.company.registered
        ? "All four are checked by your adviser or a ProofPocket checker. Each file gets a fingerprint."
        : "Starters show an ID and proof of address so nobody can sign up as you. You'll add business documents later."}</p>
      {need.map((k) => {
        const d = doc(k);
        return (
          <div key={k} className="upload">
            <div className="min-w-0">
              <b>{DOCS[k].name}</b>
              {d.state !== "missing" && d.sha256
                ? <><div className="small">{d.fileName}</div><div className="fp">Fingerprint {shortFingerprint(d.sha256)}</div></>
                : <div className="hint">PDF or photo, up to 5 MB</div>}
            </div>
            <FilePick label={d.state === "missing" ? "Upload" : "Replace"} primary={d.state === "missing"} onUploaded={(f) => attach(k, f.fileId)} onError={setErr} />
          </div>
        );
      })}
      {err && <p className="err" role="alert">{err}</p>}
      <div className="row between"><button className="btn" onClick={onBack}>Back</button><button className="btn primary" onClick={next}>Continue</button></div>
    </div>
  );
}

function Confirm({ data, onBack, onJoined }: { data: DocumentsResponse; onBack: () => void; onJoined: () => void }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const options = useQuery({ queryKey: ["join-options"], queryFn: () => api<{ incubators: { id: string; name: string }[] }>("/join/options") });
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
  const need = joinDocsFor(data.company.registered);
  const c = data.company;
  return (
    <div className="panel stack">
      <h2>Check and join</h2>
      <div className="grid-2">
        <div className="stack small">
          <div><span className="label">Business</span><div><b>{c.name}</b>{c.cipcNumber && <> · <span className="mono">{c.cipcNumber}</span></>}</div></div>
          <div><span className="label">Owner</span><div>{me?.displayName}</div></div>
          <div><span className="label">Supported by</span><div>{options.data?.incubators.find((n) => n.id === c.incubatorId)?.name ?? "None yet"}</div></div>
          <div><span className="label">Account</span><div>{c.registered ? "Verified, once documents are checked" : "Starter"}</div></div>
        </div>
        <div>{need.map((k) => <div key={k} className="li"><span className="small">{DOCS[k].name}</span><Pill tone="good">Attached</Pill></div>)}</div>
      </div>
      <label className="check items-start"><input type="checkbox" className="mt-1" checked={agree} onChange={(e) => { setAgree(e.target.checked); setErr(""); }} />
        <span>These documents belong to me and this business. I agree that my chosen incubator can see my records, and that verified funders see only what I allow under Privacy &amp; sharing. I've read the <a href="/privacy-notice" target="_blank" rel="noopener">privacy notice</a>.</span>
      </label>
      {(err || join.error) && <p className="err" role="alert">{err || (join.error as ApiError).message}</p>}
      <div className="row between">
        <button className="btn" onClick={onBack}>Back</button>
        <button className="btn primary" disabled={join.isPending} onClick={() => (agree ? join.mutate() : setErr("Tick the box to confirm before joining."))}>Join ProofPocket</button>
      </div>
    </div>
  );
}

export default function Join() {
  const auth = useAuth();
  const me = useMe();
  const signedOut = auth.status === "signedOut";
  const noAccount = me.error instanceof ApiError && me.error.code === "no_account";
  const unjoined = me.data?.role === "founder" && me.data.company && !me.data.company.joined;
  const docs = useQuery({ queryKey: ["founder-documents"], queryFn: () => api<DocumentsResponse>("/founder/documents"), enabled: !!unjoined });
  // A founder who comes back before finishing starts at Documents.
  const [chosen, setStep] = useState<1 | 2 | 3 | null>(null);
  const step = chosen ?? (unjoined ? 2 : 1);
  const [joined, setJoined] = useState(false);

  if (joined) return <Navigate to="/app/start" replace />;
  if (auth.status === "loading" || (auth.status === "signedIn" && me.isPending)) return <Spinner />;
  if (me.data && !unjoined) return <Navigate to={HOME_FOR[me.data.role]} replace />;
  if (me.data?.needsOtp) return <Navigate to="/verify" replace />;

  return (
    <AuthPageShell wide>
      <PageHead label="Join ProofPocket" title="Start your business record"
        sub="Anyone can start. Registered businesses that pass the document check get the Verified badge, which funders, buyers and customers look for." />
      <Steps step={step} />
      <div className="grid-3">
        <div className="span-2 stack">
          {step === 1 && (signedOut || noAccount || unjoined) && <Details signedOut={signedOut} onDone={() => setStep(2)} />}
          {step === 2 && docs.data && <Documents data={docs.data} onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && docs.data && <Confirm data={docs.data} onBack={() => setStep(2)} onJoined={() => setJoined(true)} />}
          {step > 1 && !docs.data && <Spinner />}
        </div>
        <Explainer />
      </div>
      <Notice tone="info" icon="2"><span className="small">Once you've joined, set up <b>Google Authenticator</b> in Business settings so nobody can use a stolen password to get in.</span></Notice>
    </AuthPageShell>
  );
}
