// Two-step sign-in with Google Authenticator only. Required for funder, adviser and admin accounts; founders choose it.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { ToneBadge } from "../../components/ToneBadge";
import { useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { meKey, useMe } from "../../lib/me";

/** The 6-digit code box. */
export function CodeInput({ value, onChange, label = "6-digit code from Google Authenticator" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <TextField label={label} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="max-w-xs [&_input]:h-12 [&_input]:text-center [&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[.4em]"
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />
  );
}

/** "ABCD EFGH …" so the key is easier to type in by hand. */
const grouped = (s: string) => s.match(/.{1,4}/g)?.join(" ") ?? s;

/** Scan the QR code (or type the key) in Google Authenticator, then enter the first code. */
export function AuthenticatorSetup({ onDone }: { onDone: () => void | Promise<void> }) {
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const started = useRef(false);
  const start = useMutation({
    mutationFn: () => api<{ secret: string; otpauthUri: string }>("/auth/totp/setup", { body: {} }),
    onSuccess: async (s) => {
      setSetup(s);
      // Loaded only here, to keep the first download small.
      const QR = await import("qrcode");
      setQr(await QR.toDataURL(s.otpauthUri, { margin: 1, width: 220, color: { dark: "#181C27", light: "#FFFFFF" } }));
    },
  });
  const activate = useMutation({ mutationFn: () => api("/auth/totp/activate", { body: { code } }), onSuccess: () => onDone() });
  useEffect(() => { if (!started.current) { started.current = true; start.mutate(); } }, [start]);
  const err = (activate.error ?? start.error) as ApiError | null;

  return (
    <div className="space-y-4">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
        <li>Install <b>Google Authenticator</b> from the Play Store or App Store.</li>
        <li>In the app, tap <b>+</b>, then <b>Scan a QR code</b>, and scan this code. If you're on the same phone, choose <b>Enter a setup key</b> and type the key below.</li>
        <li>Enter the 6-digit code the app shows for ProofPocket.</li>
      </ol>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex h-[196px] w-[196px] items-center justify-center rounded-lg border border-border bg-white p-2" aria-label="QR code for Google Authenticator">{qr ? <img src={qr} alt="QR code to scan with Google Authenticator" width={180} height={180} /> : <span className="text-xs text-muted-foreground">Loading…</span>}</div>
        {setup && (
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Setup key</p>
            <p className="break-all font-mono text-sm" data-testid="totp-secret">{grouped(setup.secret)}</p>
            <p className="text-xs text-muted-foreground">Key type: time based. Keep this private.</p>
          </div>
        )}
      </div>
      <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); activate.mutate(); }}>
        <CodeInput value={code} onChange={setCode} />
        {err && <Callout tone="bad" role="alert">{err.message}</Callout>}
        <Button type="submit" disabled={code.length !== 6 || activate.isPending || !setup}>Turn on two-step sign-in</Button>
      </form>
    </div>
  );
}

/** Business settings: set up or remove Google Authenticator. */
export function TwoFactorCard() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<"idle" | "setup" | "off">("idle");
  const [code, setCode] = useState("");
  const off = useMutation({
    mutationFn: () => api("/auth/totp/disable", { body: { code } }),
    onSuccess: async () => { setMode("idle"); setCode(""); await qc.invalidateQueries({ queryKey: meKey }); toast("Two-step sign-in is off"); },
  });
  const tf = me?.twoFactor;
  if (!tf) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1.5">
          <CardTitle className="text-base">Two-step sign-in</CardTitle>
          <CardDescription>After your password, ProofPocket asks for the 6-digit code in the Google Authenticator app on your phone. Someone who steals or guesses your password still can't get in, see your books or change where clients pay you.</CardDescription>
        </div>
        {tf.enabled ? <ToneBadge tone="good">On · Google Authenticator</ToneBadge> : <ToneBadge tone="warn">Off</ToneBadge>}
      </CardHeader>
      <CardContent className="space-y-3">
        {tf.required ? <p className="text-sm">Always on for funder, adviser and admin accounts.</p>
          : mode === "setup" ? <AuthenticatorSetup onDone={async () => { setMode("idle"); await qc.invalidateQueries({ queryKey: meKey }); toast("Two-step sign-in is on"); }} />
          : mode === "off" ? (
            <form className="space-y-3" noValidate onSubmit={(e) => { e.preventDefault(); off.mutate(); }}>
              <CodeInput value={code} onChange={setCode} />
              {off.error && <Callout tone="bad" role="alert">{(off.error as ApiError).message}</Callout>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="destructive" disabled={code.length !== 6 || off.isPending}>Turn off</Button>
                <Button type="button" variant="ghost" onClick={() => setMode("idle")}>Cancel</Button>
              </div>
            </form>
          ) : tf.enabled
            ? <Button variant="outline" onClick={() => setMode("off")}>Turn off two-step sign-in</Button>
            : <Button onClick={() => setMode("setup")}>Set up Google Authenticator</Button>}
        {tf.enabled && <p className="text-xs text-muted-foreground">Lost your phone? Contact ProofPocket: an admin can reset it after checking who you are.</p>}
      </CardContent>
    </Card>
  );
}

/** Home prompt for founders who haven't turned it on yet. */
export function TwoFactorPrompt() {
  const { data: me } = useMe();
  if (!me || me.role !== "founder" || me.twoFactor.enabled) return null;
  return (
    <Callout tone="warn" action={<Button size="sm" asChild><Link to="/app/settings">Set up</Link></Button>}>
      <b>Protect your account with Google Authenticator.</b> With two-step sign-in, a stolen password can't be used to get in or change where clients pay you.
    </Callout>
  );
}
