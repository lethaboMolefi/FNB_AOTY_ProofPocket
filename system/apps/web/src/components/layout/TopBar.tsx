import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { LogOut, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "../../lib/auth";
import { list } from "../../lib/outbox";
import { useOnline } from "../../lib/pwa";
import { BrandMark } from "../ui";

export function TopBar({ home, who, right }: { home: string; who?: ReactNode; right?: ReactNode }) {
  const { status, signOut } = useAuth();
  const online = useOnline();
  // Offline items stay on this phone, kept for this account only, until it signs in again and they're sent.
  const out = async () => {
    const n = (await list()).length;
    if (n && !window.confirm(`${n} ${n === 1 ? "entry hasn't" : "entries haven't"} been sent yet. They stay on this phone and send when you sign in again. Sign out anyway?`)) return;
    await signOut();
  };
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex max-w-[1440px] items-center gap-3 px-4 h-14">

        {/* Brand */}
        <Link
          to={home}
          className="flex items-center gap-2.5 text-foreground no-underline shrink-0"
          aria-label="ProofPocket home"
        >
          <BrandMark />
          <span className="font-display text-lg font-[750] tracking-tight hidden sm:block">
            ProofPocket
          </span>
        </Link>

        {/* Breadcrumb / business name (slot from shell) */}
        {who && (
          <>
            <Separator orientation="vertical" className="h-5 hidden sm:block" />
            {who}
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Status pills */}
        {import.meta.env.DEV && (
          <Badge variant="warning" className="text-[10px] hidden sm:flex">Example data</Badge>
        )}
        {!online && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <WifiOff className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Offline</span>
          </span>
        )}

        {/* Sign out */}
        {/* Right slot, e.g. the notification bell */}
        {right}

        {status === "signedIn" && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-1.5"
            onClick={() => void out()}
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </Button>
        )}
      </div>
    </header>
  );
}
