import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useOnline } from "../../lib/pwa";
import { BrandMark, Pill } from "../ui";

export function TopBar({ home, who }: { home: string; who?: ReactNode }) {
  const { status, signOut } = useAuth();
  const online = useOnline();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface pt-[env(safe-area-inset-top,0px)]">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5">
        <Link to={home} className="flex items-center gap-2.5 text-ink no-underline" aria-label="ProofPocket home">
          <BrandMark />
          <span className="font-display text-xl font-[750] tracking-tight">ProofPocket</span>
        </Link>
        {import.meta.env.DEV && <Pill tone="warn">Example data</Pill>}
        {!online && <Pill tone="plain">Offline</Pill>}
        <div className="ml-auto flex items-center gap-3 small">
          {who}
          {status === "signedIn" && <button className="btn sm" onClick={() => void signOut()}>Sign out</button>}
        </div>
      </div>
    </header>
  );
}
