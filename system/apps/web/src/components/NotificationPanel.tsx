/**
 * Notification bell for the founder TopBar.
 * Shows a badge with unread count. Clicking opens a slide-out panel.
 * Handles both informational items and urgent action alerts.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, AlertTriangle, ArrowRight, Bell, CheckCircle2, Info, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Notification {
  id: string;
  /** "info" = informational/dismissible, "warn" = action needed, "bad" = urgent */
  tone?: "info" | "warn" | "bad";
  title: string;
  body: string;
  /** Internal route — renders a button/link inside the item. */
  href?: string;
  hrefLabel?: string;
  /** External link (opens in new tab). */
  external?: boolean;
  /** If true this item cannot be dismissed — stays until resolved. */
  persistent?: boolean;
}

interface NotificationPanelProps {
  notifications: Notification[];
}

export function NotificationPanel({ notifications }: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = notifications.filter((n) => !dismissed.has(n.id));
  const count = visible.length;

  const dismiss = (id: string) => setDismissed((prev) => new Set([...prev, id]));
  const dismissAll = () =>
    setDismissed(new Set(notifications.filter((n) => !n.persistent).map((n) => n.id)));

  return (
    <>
      {/* ── Bell button ── */}
      <button
        type="button"
        aria-label={count > 0 ? `${count} notification${count !== 1 ? "s" : ""}` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {/* ── Backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[1px]"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Slide-out panel ── */}
      <div
        role="dialog"
        aria-label="Notifications"
        aria-modal="true"
        className={cn(
          "fixed top-0 right-0 z-40 flex h-full w-full max-w-sm flex-col bg-background shadow-xl transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+12px)]">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm text-foreground">Notifications</span>
            {count > 0 && (
              <Badge variant="secondary" className="text-[10px]">{count}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {visible.some((n) => !n.persistent) && count > 1 && (
              <button
                type="button"
                onClick={dismissAll}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              aria-label="Close notifications"
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto">
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center px-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground/60" />
              </div>
              <p className="text-sm font-medium text-foreground">You're all caught up</p>
              <p className="text-xs text-muted-foreground">New tips and alerts will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {visible.map((n) => {
                const tone = n.tone ?? "info";
                const Icon = tone === "bad" ? AlertCircle : tone === "warn" ? AlertTriangle : Info;
                const iconClass =
                  tone === "bad" ? "text-destructive" : tone === "warn" ? "text-warn" : "text-primary";
                const bgClass =
                  tone === "bad"
                    ? "bg-destructive/10"
                    : tone === "warn"
                    ? "bg-warn-soft/60"
                    : "bg-primary/10";

                return (
                  <div key={n.id} className="px-4 py-4 group">
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", bgClass)}>
                        <Icon className={cn("h-3.5 w-3.5", iconClass)} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-sm font-semibold text-foreground leading-snug">{n.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">{n.body}</p>
                        {n.href && (
                          n.external ? (
                            <a
                              href={n.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary underline underline-offset-2 pt-0.5 hover:text-primary/80 transition-colors"
                            >
                              {n.hrefLabel ?? "Read more"}
                              <ArrowRight className="h-3 w-3" />
                            </a>
                          ) : (
                            <Button size="sm" variant={tone === "bad" ? "destructive" : "outline"} asChild className="h-7 text-xs mt-0.5">
                              <Link to={n.href} onClick={() => setOpen(false)}>
                                {n.hrefLabel ?? "View"}
                              </Link>
                            </Button>
                          )
                        )}
                      </div>
                      {!n.persistent && (
                        <button
                          type="button"
                          aria-label={`Dismiss: ${n.title}`}
                          onClick={() => dismiss(n.id)}
                          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)]">
          <p className="text-[11px] text-muted-foreground text-center">
            ProofPocket will never ask for your password or a code by phone or message.
          </p>
        </div>
      </div>
    </>
  );
}
