// Sign-up: email + password, then email OTP confirmation. Minimal information to create an account.
import { zodResolver } from "@hookform/resolvers/zod";
import { emailSchema, passwordFor } from "@proofpocket/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/ui/password-strength";
import { ApiError, api } from "../../lib/api";
import { AUTH_MODE, useAuth } from "../../lib/auth";
import { AuthShell, GoogleIcon } from "./AuthShell";

type Step = "form" | "verify";

const signUpFormSchema = z.object({ email: emailSchema, password: passwordFor() });
type SignUpForm = z.infer<typeof signUpFormSchema>;

const otpSchema = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });

const firebaseMessage = (code: string) =>
  code === "auth/email-already-in-use" ? "There's already an account with this email. Sign in instead."
  : code === "auth/weak-password" ? "Use at least 12 characters for your password. A short sentence works well."
  : "Something went wrong. Try again.";

export default function SignUp() {
  const auth = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpErr, setOtpErr] = useState("");
  const [resendDisabled, setResendDisabled] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleErr, setGoogleErr] = useState("");
  const form = useForm<SignUpForm>({ resolver: zodResolver(signUpFormSchema) });
  const otpForm = useForm<z.infer<typeof otpSchema>>({ resolver: zodResolver(otpSchema) });

  // ---- Step 1: submit email + password, then send OTP ----
  const submitForm = form.handleSubmit(async ({ email: e, password: p }) => {
    setErr(""); setLoading(true);
    try {
      setEmail(e); setPassword(p);
      if (AUTH_MODE === "local") {
        // Send the email OTP code for email confirmation.
        await api("/auth/email-otp/send", { body: { email: e } });
        setStep("verify");
      } else {
        // Firebase: create the account, which sends a verification email.
        await auth.signUp(e, p);
        setStep("verify");
      }
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : firebaseMessage((x as { code?: string }).code ?? ""));
    } finally {
      setLoading(false);
    }
  });

  // ---- Step 2: verify the OTP code, then create the account (local) ----
  const verifyOtp = otpForm.handleSubmit(async ({ code }) => {
    setOtpErr(""); setOtpLoading(true);
    try {
      if (AUTH_MODE === "local") {
        // Verify the email OTP, then create the local account.
        await api("/auth/email-otp/verify", { body: { email, code } });
        await auth.signUp(email, password);
        nav("/join", { replace: true });
      }
      // Firebase: the verification link in the email handles it; just navigate.
      nav("/join", { replace: true });
    } catch (x) {
      setOtpErr(x instanceof ApiError ? x.message : "That code isn't right. Check it and try again.");
    } finally {
      setOtpLoading(false);
    }
  });

  const resendCode = async () => {
    setOtpErr(""); setResendDisabled(true);
    try {
      await api("/auth/email-otp/send", { body: { email } });
    } catch {
      // Silently retry — the first send may still be valid.
    }
    setTimeout(() => setResendDisabled(false), 30_000);
  };

  const googleSignUp = async () => {
    setGoogleErr(""); setGoogleLoading(true);
    try {
      await auth.signInWithGoogle();
      nav("/join", { replace: true });
    } catch (e) {
      setGoogleErr(e instanceof ApiError ? e.message : "Google sign-in didn't work. Try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  // ---- Step 2 UI: Firebase shows "check your email", local shows OTP entry ----
  if (step === "verify" && AUTH_MODE === "firebase") {
    return (
      <AuthShell>
        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-shadcn-accent">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle as="h1" className="text-2xl font-bold tracking-tight">Check your email</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              We sent a verification link to <b>{email}</b>. Click it to confirm your email, then continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full" onClick={() => nav("/join", { replace: true })}>
              I've verified my email — continue
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setStep("form")}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  if (step === "verify") {
    return (
      <AuthShell>
        <Card className="border-border shadow-lg">
          <CardHeader className="space-y-3 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-shadcn-accent">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <CardTitle as="h1" className="text-2xl font-bold tracking-tight">Confirm your email</CardTitle>
            <CardDescription className="text-base text-muted-foreground">
              We sent a 6-digit code to <b>{email}</b>. Enter it below to verify your email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-4" onSubmit={verifyOtp} noValidate>
              <div className="space-y-2">
                <Label htmlFor="otp-code">6-digit code</Label>
                <Input id="otp-code" type="text" inputMode="numeric" autoComplete="one-time-code"
                  placeholder="000000" maxLength={6}
                  className="text-center text-xl tracking-[.4em] font-mono"
                  {...otpForm.register("code")} />
                {otpForm.formState.errors.code && <p className="err">{otpForm.formState.errors.code.message}</p>}
              </div>
              {otpErr && <p className="err" role="alert">{otpErr}</p>}
              <Button type="submit" className="w-full" disabled={otpLoading || otpForm.formState.isSubmitting}>
                {otpLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Verifying…</> : "Verify and create account"}
              </Button>
            </form>
            <div className="flex items-center justify-between text-sm">
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setStep("form")}>
                <ArrowLeft className="inline h-4 w-4" /> Back
              </button>
              <button type="button" className="font-medium text-primary hover:underline disabled:opacity-50"
                onClick={() => void resendCode()} disabled={resendDisabled}>
                {resendDisabled ? "Resend in 30s" : "Resend code"}
              </button>
            </div>
          </CardContent>
        </Card>
      </AuthShell>
    );
  }

  // ---- Step 1: the form ----
  return (
    <AuthShell>
      <Card className="border-border shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <CardTitle as="h1" className="text-2xl font-bold tracking-tight">Create your account</CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Join ProofPocket and start building proof that funders and buyers trust.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Google sign-up */}
          {AUTH_MODE === "firebase" && (
            <>
              <Button type="button" variant="outline" className="w-full" onClick={() => void googleSignUp()} disabled={googleLoading}>
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
          <form className="space-y-4" onSubmit={submitForm} noValidate>
            <div className="space-y-2">
              <Label htmlFor="sign-up-email">Email</Label>
              <Input id="sign-up-email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none"
                placeholder="you@example.com" aria-invalid={!!form.formState.errors.email || undefined}
                {...form.register("email")} />
              {form.formState.errors.email && <p className="err">{form.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sign-up-password">Password</Label>
              <PasswordInput id="sign-up-password" autoComplete="new-password"
                error={form.formState.errors.password?.message} {...form.register("password")} />
              <PasswordStrength password={form.watch("password") ?? ""} email={form.watch("email")} />
            </div>
            {err && <p className="err" role="alert">{err}</p>}
            <Button type="submit" className="w-full" disabled={loading || form.formState.isSubmitting}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending code…</> : "Create account"}
            </Button>
          </form>

          {/* Sign in link */}
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/sign-in" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

/** shadcn-style password input with show/hide toggle (shared with sign-in). */
function PasswordInput({ error, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} spellCheck={false} autoCapitalize="none"
        aria-invalid={!!error || undefined} {...props} className="pr-10" />
      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} tabIndex={-1}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
      {error && <p className="err mt-1">{error}</p>}
    </div>
  );
}
