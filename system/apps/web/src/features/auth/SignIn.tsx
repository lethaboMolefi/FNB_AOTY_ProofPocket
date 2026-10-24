import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema } from "@proofpocket/shared";
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import type { z } from "zod";
import { BrandMark, Notice } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { AUTH_MODE, useAuth } from "../../lib/auth";

export function AuthPageShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <main id="main" className={`mx-auto flex min-h-screen flex-col gap-5 px-4 pb-10 pt-[calc(env(safe-area-inset-top,0px)+32px)] ${wide ? "max-w-[1100px]" : "max-w-md"}`}>
      <Link to="/" className="flex items-center gap-2.5 text-ink no-underline"><BrandMark /><span className="font-display text-xl font-[750] tracking-tight">ProofPocket</span></Link>
      {children}
    </main>
  );
}

/**
 * Password field with its own label and a show/hide button (people type long passwords on small phones).
 * The button sits outside the label so the field's accessible name is just the label text.
 */
export const PasswordField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }>(
  function PasswordField({ label, error, ...props }, ref) {
    const [show, setShow] = useState(false);
    const id = useId();
    return (
      <div className="field">
        <label htmlFor={id}><span className="text-[.82rem] font-semibold text-muted">{label}</span></label>
        <div className="flex gap-2">
          <input id={id} ref={ref} {...props} type={show ? "text" : "password"} spellCheck={false} autoCapitalize="none" aria-invalid={!!error || undefined} />
          <button type="button" className="btn shrink-0" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}>{show ? "Hide" : "Show"}</button>
        </div>
        {error && <p className="err">{error}</p>}
      </div>
    );
  });

const firebaseMessage = (code: string) =>
  code === "auth/too-many-requests" ? "Too many tries. For your safety, wait a few minutes and try again."
  : "That email and password don't match. Check them and try again.";

export default function SignIn() {
  const auth = useAuth();
  const nav = useNavigate();
  const [err, setErr] = useState("");
  const [note, setNote] = useState("");
  const form = useForm<z.infer<typeof signInSchema>>({ resolver: zodResolver(signInSchema) });

  const submit = form.handleSubmit(async ({ email, password }) => {
    setErr(""); setNote("");
    try {
      await auth.signIn(email, password);
      nav("/", { replace: true });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : firebaseMessage((e as { code?: string }).code ?? ""));
    }
  });

  const forgot = async () => {
    const email = form.getValues("email");
    if (!email) { setErr("Enter your email first, then choose Forgot password."); return; }
    try { await auth.resetPassword(email); } catch (e) { if (e instanceof ApiError) { setErr(e.message); return; } }
    // Same message whether or not the account exists.
    setNote("If there's an account for that email, we've sent a link to reset the password.");
  };

  return (
    <AuthPageShell>
      <div><h1>Sign in</h1><p className="muted mt-1.5">Your books, payments and proof, in one place.</p></div>
      <form className="panel flex flex-col gap-3" onSubmit={submit} noValidate>
        <label className="field"><span>Email</span>
          <input type="email" autoComplete="username" inputMode="email" autoCapitalize="none" {...form.register("email")} />
        </label>
        {form.formState.errors.email && <p className="err">{form.formState.errors.email.message}</p>}
        <PasswordField label="Password" autoComplete="current-password" error={form.formState.errors.password?.message} {...form.register("password")} />
        {err && <p className="err" role="alert">{err}</p>}
        {note && <p className="small" role="status">{note}</p>}
        <button className="btn primary" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Signing in…" : "Sign in"}</button>
        {AUTH_MODE === "firebase" && <button className="btn ghost self-start" type="button" onClick={() => void forgot()}>Forgot password?</button>}
      </form>
      <Notice tone="info" icon="2">
        <span className="small"><b>Two-step sign-in keeps your money safe.</b> After your password, enter the code from the Google Authenticator app on your phone, so a stolen password isn't enough. It's always on for funders, advisers and admins, and founders can set it up in Business settings.</span>
      </Notice>
      <Notice tone="warn" icon="!"><span className="small">ProofPocket will never phone you or message you to ask for your password or a code.</span></Notice>
      <p className="small">New here? <Link to="/join">Join ProofPocket</Link></p>
    </AuthPageShell>
  );
}
