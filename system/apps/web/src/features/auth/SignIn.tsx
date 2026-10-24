import { zodResolver } from "@hookform/resolvers/zod";
import { signInSchema } from "@proofpocket/shared";
import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BrandMark, Notice } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { AUTH_MODE, useAuth } from "../../lib/auth";
import { AuthShell, GoogleIcon } from "./AuthShell";

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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleErr, setGoogleErr] = useState("");
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

  const googleSignIn = async () => {
    setGoogleErr(""); setGoogleLoading(true);
    try {
      await auth.signInWithGoogle();
      nav("/", { replace: true });
    } catch (e) {
      setGoogleErr(e instanceof ApiError ? e.message : "Google sign-in didn't work. Try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell>
      <Card className="border-border shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Sign in to access your business profile, books, and proof.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google sign-in */}
          {AUTH_MODE === "firebase" && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => void googleSignIn()}
                disabled={googleLoading}
              >
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
              </Button>
              {googleErr && <p className="err text-center" role="alert">{googleErr}</p>}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>
            </>
          )}

          {/* Email + password form */}
          <form className="space-y-4" onSubmit={submit} noValidate>
            <div className="space-y-2">
              <Label htmlFor="sign-in-email">Email</Label>
              <Input id="sign-in-email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none"
                placeholder="you@example.com" aria-invalid={!!form.formState.errors.email || undefined}
                {...form.register("email")} />
              {form.formState.errors.email && <p className="err">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sign-in-password">Password</Label>
                {AUTH_MODE === "firebase" && (
                  <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => void forgot()}>
                    Forgot password?
                  </button>
                )}
              </div>
              <PasswordInput id="sign-in-password" autoComplete="current-password"
                error={form.formState.errors.password?.message} {...form.register("password")} />
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            {note && <p className="text-sm text-muted-foreground" role="status">{note}</p>}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : "Sign in"}
            </Button>
          </form>

          {/* Create account link */}
          <div className="text-center text-sm text-muted-foreground">
            New to ProofPocket?{" "}
            <Link to="/sign-up" className="font-medium text-primary hover:underline">
              Create an account
            </Link>
          </div>
        </CardContent>
      </Card>
{/* 
      <Notice tone="info" icon="2">
        <span className="small"><b>Two-step sign-in keeps your money safe.</b> After your password, enter the code from the Google Authenticator app on your phone, so a stolen password isn't enough. It's always on for funders, advisers and admins, and founders can set it up in Business settings.</span>
      </Notice> */}
    </AuthShell>
  );
}

/** shadcn-style password input with show/hide toggle. */
const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { error?: string }>(
  function PasswordInput({ error, ...props }, ref) {
    const [show, setShow] = useState(false);
    const id = useId();
    return (
      <div className="relative">
        <Input ref={ref} type={show ? "text" : "password"} spellCheck={false} autoCapitalize="none"
          aria-invalid={!!error || undefined} {...props} className="pr-10" />
        <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
        {error && <p className="err mt-1">{error}</p>}
      </div>
    );
  });
