// Setting your own password: forced after a temporary one (before anything else), or from an admin's profile.
// The server checks the rules (12+ characters, not common, not your email name) and that it isn't the old one,
// then the person signs in again with the new password, so the temporary one is never used again.
import { passwordFor } from "@proofpocket/shared";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrength } from "@/components/ui/password-strength";
import { PageHeader } from "../../components/PageHeader";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { meKey, useMe } from "../../lib/me";
import { AuthPageShell, PasswordField } from "./SignIn";

export function ChangePasswordForm({ temporary, onDone }: { temporary: boolean; onDone: () => void }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const email = useMe().data?.email ?? "";
  const [f, setF] = useState({ current: "", password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const rule = passwordFor(email).safeParse(f.password);
    if (!rule.success) { setErr(rule.error.issues[0]!.message); return; }
    if (f.password !== f.confirm) { setErr("The two new passwords don't match."); return; }
    setBusy(true);
    try {
      await api("/auth/password", { body: { current: f.current, password: f.password } });
      // Sign in again with the new password: the old (temporary) one no longer works.
      await auth.signIn(email, f.password);
      await qc.invalidateQueries({ queryKey: meKey });
      onDone();
    } catch (x) {
      setErr(x instanceof ApiError ? x.message : "Couldn't change your password. Try again.");
    } finally { setBusy(false); }
  };
  return (
    <form className="space-y-4" onSubmit={submit} noValidate>
      <PasswordField label={temporary ? "Temporary password" : "Current password"} autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <div className="space-y-2">
        <PasswordField label="New password (at least 12 characters)" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <PasswordStrength password={f.password} email={email} />
      </div>
      <PasswordField label="New password again" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
      {err && <Callout tone="bad" role="alert">{err}</Callout>}
      <Button type="submit" disabled={busy || !f.current || !f.password}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Set new password</Button>
    </form>
  );
}

/** First sign-in with a temporary password: nothing else is reachable until this is done. */
export default function ChangePassword() {
  const me = useMe();
  const nav = useNavigate();
  const toast = useToast();
  if (me.isPending) return <Spinner />;
  if (!me.data?.mustChangePassword) return <Navigate to="/" replace />;
  return (
    <AuthPageShell toSignIn>
      <PageHeader title="Set your own password" sub="You signed in with a temporary password. Choose your own before you continue; the temporary one stops working." />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">New password</CardTitle>
          <CardDescription>At least 12 characters. A short sentence works well. Don't use your email name.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm temporary onDone={() => { toast("Password changed"); nav("/", { replace: true }); }} />
        </CardContent>
      </Card>
    </AuthPageShell>
  );
}

/** A suspended account, or a temporary password that expired. Signing in again won't help, so say what to do. */
export function AccountStatus() {
  const me = useMe();
  const auth = useAuth();
  const code = me.error instanceof ApiError ? me.error.code : "";
  if (me.isPending) return <Spinner />;
  if (code !== "account_suspended" && code !== "temp_password_expired") return <Navigate to="/" replace />;
  return (
    <AuthPageShell toSignIn>
      <PageHeader title={code === "account_suspended" ? "Your account is suspended" : "Your temporary password has expired"}
        sub={code === "account_suspended"
          ? "A ProofPocket admin suspended this account. We emailed you the reason. Reply to that email if you think it's a mistake."
          : "Temporary passwords work for 7 days. Ask ProofPocket for a new one, then sign in with it."} />
      <Button variant="outline" className="self-start" onClick={() => void auth.signOut()}>Sign out</Button>
    </AuthPageShell>
  );
}
