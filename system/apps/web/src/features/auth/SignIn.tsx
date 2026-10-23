import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { BrandMark, Notice } from "../../components/ui";
import { AUTH_MODE, useAuth } from "../../lib/auth";

// The seed's example accounts (apps/api/src/db/seed/data.ts). Shown only in local development.
const EXAMPLE_ACCOUNTS: { group: string; people: [string, string][] }[] = [
  { group: "Founders", people: [
    ["zanele@proofpocket.example", "Nala Nails & Lashes (Starter)"], ["palesa@proofpocket.example", "ReKasi Plastics"],
    ["tumelo@proofpocket.example", "Mabele AgriLink"], ["kabelo@proofpocket.example", "Green Route Waste Services"],
    ["thandi@proofpocket.example", "Mama Tau Catering"], ["sipho@proofpocket.example", "Khanya Solar Installs"],
  ] },
  { group: "Funders & investors", people: [
    ["lesedi@proofpocket.example", "Lesedi Youth Fund"], ["umnotho@proofpocket.example", "Umnotho Seed Partners"],
    ["kopano@proofpocket.example", "Kopano Enterprise Finance"], ["bophelo@proofpocket.example", "Bophelo Community Fund (needs set-up)"],
  ] },
  { group: "Incubators & NGOs", people: [
    ["n.mokoena@proofpocket.example", "N. Mokoena, Ikhaya Incubation Hub"], ["l.dube@proofpocket.example", "L. Dube, Ikhaya Incubation Hub"],
    ["s.pillay@proofpocket.example", "S. Pillay, Township Futures Trust"], ["t.mahlangu@proofpocket.example", "T. Mahlangu, Township Futures Trust"],
  ] },
];

const schema = z.object({
  email: z.string().trim().email("Enter your email address"),
  password: z.string().min(8, "Passwords have at least 8 characters"),
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+32px)]">
      <div className="flex items-center gap-2.5"><BrandMark /><span className="font-display text-xl font-[750] tracking-tight">ProofPocket</span></div>
      {children}
    </main>
  );
}

export default function SignIn() {
  const auth = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [devEmail, setDevEmail] = useState("");
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  const devGo = (email: string) => { auth.devSignIn(email); nav("/", { replace: true }); };

  if (AUTH_MODE === "dev") {
    return (
      <Shell>
        <div><h1>Sign in</h1><p className="muted mt-1.5">Development: choose an example account. Funder, adviser and admin accounts then ask for an email PIN, which is printed in the API log.</p></div>
        {EXAMPLE_ACCOUNTS.map((g) => (
          <section key={g.group} className="panel">
            <h2 className="label !mb-2">{g.group}</h2>
            <div className="flex flex-col gap-2">
              {g.people.map(([email, label]) => (
                <button key={email} className="btn justify-start text-left" onClick={() => devGo(email)}>{label}</button>
              ))}
            </div>
          </section>
        ))}
        <form className="panel flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); if (devEmail.includes("@")) devGo(devEmail.trim()); }}>
          <label className="field"><span>Another account (e.g. the admin checker)</span>
            <input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} autoComplete="email" placeholder="name@example.com" />
          </label>
          <button className="btn" type="submit">Sign in</button>
        </form>
        <p className="small">New here? <Link to="/join">Join ProofPocket</Link></p>
      </Shell>
    );
  }

  const submit = form.handleSubmit(async ({ email, password }) => {
    setErr("");
    try { await auth.signIn(email, password); nav("/", { replace: true }); }
    catch { setErr("That email and password don't match. Check them and try again."); }
  });
  return (
    <Shell>
      <div><h1>Sign in</h1><p className="muted mt-1.5">Your books, payments and proof, in one place.</p></div>
      <form className="panel flex flex-col gap-3" onSubmit={submit} noValidate>
        <label className="field"><span>Email</span><input type="email" autoComplete="email" {...form.register("email")} /></label>
        {form.formState.errors.email && <p className="err">{form.formState.errors.email.message}</p>}
        <label className="field"><span>Password</span><input type="password" autoComplete="current-password" {...form.register("password")} /></label>
        {form.formState.errors.password && <p className="err">{form.formState.errors.password.message}</p>}
        {err && <p className="err" role="alert">{err}</p>}
        <button className="btn primary" type="submit" disabled={form.formState.isSubmitting}>Sign in</button>
      </form>
      <Notice tone="info" icon="i"><span className="small">ProofPocket will never ask for your banking PIN or one-time PIN by phone or message.</span></Notice>
      <p className="small">New here? <Link to="/join">Join ProofPocket</Link></p>
    </Shell>
  );
}

export { Shell as AuthPageShell };
