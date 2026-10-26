// The step after the password: the Google Authenticator code, or setting it up first (required accounts).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "../../components/PageHeader";
import { Spinner } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { meKey, useMe } from "../../lib/me";
import { AuthPageShell } from "./SignIn";
import { AuthenticatorSetup, CodeInput } from "./TwoFactor";

export default function VerifyPin() {
  const { status, signOut } = useAuth();
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [code, setCode] = useState("");
  const done = async () => { await qc.invalidateQueries({ queryKey: meKey }); nav("/", { replace: true }); };
  const verify = useMutation({ mutationFn: () => api("/auth/totp/verify", { body: { code } }), onSuccess: done });

  if (status === "signedOut") return <Navigate to="/sign-in" replace />;
  if (me.isPending) return <Spinner />;
  // Signed in but no account yet: there's no code to enter; finish joining first.
  if (me.error instanceof ApiError && me.error.code === "no_account") return <Navigate to="/join" replace />;
  if (me.data && !me.data.needsOtp) return <Navigate to="/" replace />;
  const settingUp = me.data && !me.data.twoFactor.enabled;

  return (
    <AuthPageShell toSignIn>
      {settingUp ? (
        <>
          <PageHeader title="Set up two-step sign-in" sub="Funder, adviser and admin accounts use Google Authenticator to keep founders' records safe. It takes a minute, once." />
          <Card><CardContent className="pt-6"><AuthenticatorSetup onDone={done} /></CardContent></Card>
        </>
      ) : (
        <>
          <PageHeader title="Enter your code" sub="Open Google Authenticator on your phone and enter the 6-digit code shown for ProofPocket." />
          <Card>
            <CardContent className="pt-6">
              <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); verify.mutate(); }}>
                <CodeInput value={code} onChange={setCode} label="Code" />
                {verify.error && <Callout tone="bad" role="alert">{(verify.error as ApiError).message}</Callout>}
                <Button type="submit" className="w-full" disabled={code.length !== 6 || verify.isPending}>Continue</Button>
              </form>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Lost your phone? Contact ProofPocket: an admin can reset it after checking who you are.</p>
        </>
      )}
      <Callout tone="warn">ProofPocket will never phone you or message you to ask for your password or a code.</Callout>
      <Button variant="outline" className="self-start" onClick={() => void signOut()}>Use a different account</Button>
    </AuthPageShell>
  );
}
