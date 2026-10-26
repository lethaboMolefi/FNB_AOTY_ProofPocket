// Founder layout: the shared AppShell with the founder's pages, the notification bell and the founder's prompts.
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { TwoFactorPrompt } from "../../features/auth/TwoFactor";
import { PrivacyNoticePrompt } from "../../features/founder/PrivacyNoticePrompt";
import { FOUNDER_TABS, founderNavFor } from "../../app/nav";
import { api } from "../../lib/api";
import { useMe } from "../../lib/me";
import { InstallHint } from "../../lib/pwa";
import { NotificationPanel, type Notification } from "../NotificationPanel";
import { AppShell } from "./AppShell";
import { Badge } from "../ui/badge";

type Notices = { starter: boolean; proofsToCheck: number; fraudOpen: number };

/** The bell's items, from the founder's own data only (urgent first). */
function founderNotifications(n: Notices | undefined, twoFactorOn: boolean, verified: boolean): Notification[] {
  const out: Notification[] = [];
  if (n?.fraudOpen) out.push({ id: "fraud", tone: "bad", persistent: true, href: "/app/protection", hrefLabel: "Review",
    title: `${n.fraudOpen} possible ${n.fraudOpen === 1 ? "scam needs" : "scams need"} your attention`, body: "Check before you pay anyone." });
  if (n?.proofsToCheck) out.push({ id: "proofs", tone: "warn", persistent: true, href: "/app/payments", hrefLabel: "Check",
    title: `${n.proofsToCheck} ${n.proofsToCheck > 1 ? "clients say they have" : "client says they have"} paid`, body: "Check your banking app, then confirm so it goes into your books." });
  if (!twoFactorOn) out.push({ id: "two-factor", tone: "warn", href: "/app/settings", hrefLabel: "Set up",
    title: "Protect your account with Google Authenticator", body: "With two-step sign-in, a stolen password can't be used to get in or change where clients pay you." });
  if (!verified) out.push({ id: "starter", href: "/app/start", hrefLabel: "Continue",
    title: "You're on a Starter account", body: "Finish the registration steps to get verified, so funders and buyers can find you." });
  return out;
}

export function FounderShell() {
  const { data: me } = useMe();
  const nav = founderNavFor(me?.company?.businessType);
  const pathname = useLocation().pathname;
  const onHome = pathname === "/app/home" || pathname === "/app";
  // Same query as Home, so the bell and Home share one request.
  const notices = useQuery({ queryKey: ["founder", "home"], queryFn: () => api<{ notices: Notices }>("/founder/home"), enabled: !!me?.company?.joined, staleTime: 30_000 });
  const notifications = founderNotifications(notices.data?.notices, !!me?.twoFactor.enabled, !!me?.company?.verified);

  return (
    <AppShell
      base="/app"
      groups={nav}
      tabs={FOUNDER_TABS}
      right={<NotificationPanel notifications={notifications} />}
      who={me?.company && (
        <div className="hidden items-center gap-2 sm:flex">
          <span className="max-w-[180px] truncate text-sm font-semibold text-foreground">{me.company.name}</span>
          {me.company.verified
            ? <Badge variant="success" className="shrink-0 text-[10px]">Verified</Badge>
            : <Badge variant="secondary" className="shrink-0 text-[10px]">Starter</Badge>}
        </div>
      )}
      note="ProofPocket never holds or moves money. Clients pay you directly."
      before={<><PrivacyNoticePrompt />{onHome && <TwoFactorPrompt />}<InstallHint /></>}
    />
  );
}
