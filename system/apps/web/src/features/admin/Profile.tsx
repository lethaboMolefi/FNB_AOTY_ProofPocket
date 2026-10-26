// An admin's own profile: who they're signed in as, two-step status, and changing their password.
import { KeyRound, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "../../components/PageHeader";
import { ToneBadge } from "../../components/ToneBadge";
import { Spinner, useToast } from "../../components/ui";
import { useMe } from "../../lib/me";
import { ChangePasswordForm } from "../auth/ChangePassword";

export default function Profile() {
  const me = useMe().data;
  const toast = useToast();
  if (!me) return <><PageHeader title="Profile" /><Spinner /></>;
  return (
    <>
      <PageHeader title="Profile" sub="Your own account. Password changes need a fresh sign-in." />
      <div className="grid gap-6 desktop:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />Your account</CardTitle></CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt><dd>{me.displayName}</dd>
              <dt className="text-muted-foreground">Email</dt><dd className="break-all">{me.email}</dd>
              <dt className="text-muted-foreground">Role</dt><dd>Admin</dd>
              <dt className="text-muted-foreground">Two-step sign-in</dt><dd>{me.twoFactor.enabled ? <ToneBadge tone="good">On · Google Authenticator</ToneBadge> : <ToneBadge tone="warn">Not set up</ToneBadge>}</dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />Change password</CardTitle>
            <CardDescription>If you sign in with Continue with Google, this adds a password as a second way in.</CardDescription>
          </CardHeader>
          <CardContent><ChangePasswordForm temporary={false} onDone={() => toast("Password changed")} /></CardContent>
        </Card>
      </div>
    </>
  );
}
