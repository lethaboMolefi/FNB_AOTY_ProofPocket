import type { Role } from "@proofpocket/shared";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spinner } from "../components/ui";
import { ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";
import { HOME_FOR, useMe } from "../lib/me";

/** Works out where the signed-in person should be: sign-in, Join, the PIN step or their portal. */
function useDestination(): { wait: true } | { wait: false; to: string | null; role?: Role } {
  const { status } = useAuth();
  const me = useMe();
  if (status === "loading") return { wait: true };
  if (status === "signedOut") return { wait: false, to: "/sign-in" };
  if (me.isPending) return { wait: true };
  if (me.error) {
    if (me.error instanceof ApiError && me.error.code === "no_account") return { wait: false, to: "/join" };
    // A suspended account, or a temporary password that has expired: say so (signing in again won't help).
    if (me.error instanceof ApiError && (me.error.code === "account_suspended" || me.error.code === "temp_password_expired")) return { wait: false, to: "/account-status" };
    return { wait: false, to: "/sign-in" };
  }
  // A temporary password is changed before anything else, Google Authenticator included.
  if (me.data.mustChangePassword) return { wait: false, to: "/change-password" };
  if (me.data.needsOtp) return { wait: false, to: "/verify" };
  if (me.data.role === "founder" && (!me.data.company || !me.data.company.joined)) return { wait: false, to: "/join" };
  return { wait: false, to: null, role: me.data.role };
}

/** "/" (and the installed app's start URL) sends each role to its own portal. */
export function RoleHome() {
  const d = useDestination();
  if (d.wait) return <Spinner />;
  return <Navigate to={d.to ?? HOME_FOR[d.role!]} replace />;
}

/** Each role sees only its own portal. The API enforces the same rule on every route. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const d = useDestination();
  const loc = useLocation();
  if (d.wait) return <Spinner />;
  if (d.to) return <Navigate to={d.to} replace state={{ from: loc.pathname }} />;
  if (!roles.includes(d.role!)) return <Navigate to={HOME_FOR[d.role!]} replace />;
  return <>{children}</>;
}

/** Funders must set their requirements before anything else (v2: funderSetup gate). */
export function RequireFunderSetup({ children }: { children: ReactNode }) {
  const me = useMe();
  const loc = useLocation();
  if (me.data?.org && !me.data.org.setupDone && !loc.pathname.endsWith("/setup")) return <Navigate to="/funder/setup" replace />;
  return <>{children}</>;
}
