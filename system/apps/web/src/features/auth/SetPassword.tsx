// Choose your password: the last step of joining with email only (after Join ProofPocket, or after sending an
// application). Until it's done, ProofPocket shows nothing else. Then you sign in with it from now on.
import { passwordFor } from "@proofpocket/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordStrength } from "@/components/ui/password-strength";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { AuthPageShell, PasswordField } from "./SignIn";

export function ChoosePasswordCard({ onDone }: { onDone: () => void }) {
  const auth = useAuth();
  const qc = useQueryClient();
  const email = auth.email ?? "";
  const [f, setF] = useState({ password: "", confirm: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    const rule = passwordFor(email).safeParse(f.password);
    if (!rule.success) { setErr(rule.error.issues[0]!.message); return; }
    if (f.password !== f.confirm) { setErr("The two passwords don't match."); return; }
    setBusy(true);
    try {
      await api("/auth/password/first", { body: { password: f.password } });
      // A new password ends the old sign-in session (Firebase), so sign in again with it.
      await auth.signIn(email, f.password);
      await qc.invalidateQueries();
      onDone();
    } catch (x) { setErr(x instanceof ApiError ? x.message : "Couldn't save your password. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary"><KeyRound className="h-5 w-5" aria-hidden="true" /></span>
        <CardTitle as="h1" className="text-xl font-bold tracking-tight">Choose your password</CardTitle>
        <CardDescription>You'll sign in to ProofPocket with <b className="text-foreground">{email}</b> and this password from now on.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div className="space-y-2">
            <PasswordField label="Password (at least 12 characters)" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <PasswordStrength password={f.password} email={email} />
          </div>
          <PasswordField label="Type it again" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
          <Button type="submit" disabled={busy || !f.password}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Save password</Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SetPassword() {
  const nav = useNavigate();
  const toast = useToast();
  const auth = useAuth();
  const q = useQuery({ queryKey: ["password-later"], queryFn: () => api<{ pending: boolean }>("/auth/password/later"), enabled: auth.status === "signedIn" });
  if (auth.status === "signedOut") return <Navigate to="/sign-in" replace />;
  if (!q.data) return <Spinner />;
  if (!q.data.pending) return <Navigate to="/" replace />;
  return (
    <AuthPageShell toSignIn>
      <ChoosePasswordCard onDone={() => { toast("Password saved"); nav("/", { replace: true }); }} />
    </AuthPageShell>
  );
}
