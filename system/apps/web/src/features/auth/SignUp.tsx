// Sign-up: email + password, then a 6-digit code ProofPocket emails to confirm the address. Or Continue with Google.
import { zodResolver } from "@hookform/resolvers/zod";
import { emailSchema, passwordFor } from "@proofpocket/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordStrength } from "@/components/ui/password-strength";
import { ApiError } from "../../lib/api";
import { AUTH_MODE, useAuth } from "../../lib/auth";
import { AuthShell, GoogleIcon } from "./AuthShell";
import { EmailCodeConfirm } from "./EmailCode";

type Step = "form" | "verify";

const signUpFormSchema = z.object({ email: emailSchema, password: passwordFor() });
type SignUpForm = z.infer<typeof signUpFormSchema>;

const firebaseMessage = (code: string) =>
  code === "auth/email-already-in-use" ? "There's already an account with this email. Sign in instead."
  : code === "auth/weak-password" ? "Use at least 12 characters for your password. A short sentence works well."
  : "Something went wrong. Try again.";

export default function SignUp() {
  const auth = useAuth();
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleErr, setGoogleErr] = useState("");
  const form = useForm<SignUpForm>({ resolver: zodResolver(signUpFormSchema) });

  // ---- Step 1: create the sign-in. Then confirm the email with the code ProofPocket emails (step 2). ----
  const submitForm = form.handleSubmit(async ({ email, password }) => {
    setErr(""); setLoading(true);
    try {
      await auth.signUp(email, password);
      // Local sign-ins are confirmed already (development and the demo); new Firebase sign-ins get the code.
      if (AUTH_MODE === "firebase") setStep("verify");
      else nav("/join", { replace: true });
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : firebaseMessage((x as { code?: string }).code ?? ""));
    } finally {
      setLoading(false);
    }
  });

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

  // ---- Step 2: the 6-digit code ProofPocket emailed ----
  if (step === "verify") {
    return (
      <AuthShell>
        <EmailCodeConfirm heading="h1" onConfirmed={() => nav("/join", { replace: true })} />
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
