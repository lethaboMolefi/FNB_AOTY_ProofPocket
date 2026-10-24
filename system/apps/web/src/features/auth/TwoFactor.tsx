// Two-step sign-in with Google Authenticator only. Required for funder, adviser and admin accounts; founders choose it.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Notice, Pill, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { meKey, useMe } from "../../lib/me";

/** The 6-digit code box. */
export function CodeInput({ value, onChange, label = "6-digit code from Google Authenticator" }: { value: string; onChange: (v: string) => void; label?: string }) {
  return (
    <label className="field"><span>{label}</span>
      <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="mono text-center text-xl tracking-[.4em]"
        value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))} />
    </label>
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
    <div className="stack">
      <ol className="small stack" style={{ gap: 6, paddingLeft: 18, listStyle: "decimal" }}>
        <li>Install <b>Google Authenticator</b> from the Play Store or App Store.</li>
        <li>In the app, tap <b>+</b>, then <b>Scan a QR code</b>, and scan this code. If you're on the same phone, choose <b>Enter a setup key</b> and type the key below.</li>
        <li>Enter the 6-digit code the app shows for ProofPocket.</li>
      </ol>
      <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
        <div className="qrbox" aria-label="QR code for Google Authenticator">{qr ? <img src={qr} alt="QR code to scan with Google Authenticator" width={180} height={180} /> : <span className="hint">Loading…</span>}</div>
        {setup && (
          <div className="stack" style={{ gap: 4, minWidth: 0 }}>
            <span className="label">Setup key</span>
            <span className="mono break-all" data-testid="totp-secret">{grouped(setup.secret)}</span>
            <span className="hint">Key type: time based. Keep this private.</span>
          </div>
        )}
      </div>
      <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); activate.mutate(); }}>
        <CodeInput value={code} onChange={setCode} />
        {err && <p className="err" role="alert">{err.message}</p>}
        <button className="btn primary self-start" type="submit" disabled={code.length !== 6 || activate.isPending || !setup}>Turn on two-step sign-in</button>
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
    <section className="panel stack" aria-labelledby="tf-title">
      <div className="row between">
        <h2 id="tf-title" className="!mb-0">Two-step sign-in</h2>
        {tf.enabled ? <Pill tone="good">On · Google Authenticator</Pill> : <Pill tone="warn">Off</Pill>}
      </div>
      <p className="small muted">After your password, ProofPocket asks for the 6-digit code in the Google Authenticator app on your phone. Someone who steals or guesses your password still can't get in, see your books or change where clients pay you.</p>
      {tf.required ? <p className="small">Always on for funder, adviser and admin accounts.</p>
        : mode === "setup" ? <AuthenticatorSetup onDone={async () => { setMode("idle"); await qc.invalidateQueries({ queryKey: meKey }); toast("Two-step sign-in is on"); }} />
        : mode === "off" ? (
          <form className="stack" noValidate onSubmit={(e) => { e.preventDefault(); off.mutate(); }}>
            <CodeInput value={code} onChange={setCode} />
            {off.error && <p className="err" role="alert">{(off.error as ApiError).message}</p>}
            <div className="row">
              <button className="btn danger" type="submit" disabled={code.length !== 6 || off.isPending}>Turn off</button>
              <button className="btn ghost" type="button" onClick={() => setMode("idle")}>Cancel</button>
            </div>
          </form>
        ) : tf.enabled
          ? <button className="btn self-start" onClick={() => setMode("off")}>Turn off two-step sign-in</button>
          : <button className="btn primary self-start" onClick={() => setMode("setup")}>Set up Google Authenticator</button>}
      {tf.enabled && <p className="hint">Lost your phone? Contact ProofPocket: an admin can reset it after checking who you are.</p>}
    </section>
  );
}

/** Home prompt for founders who haven't turned it on yet. */
export function TwoFactorPrompt() {
  const { data: me } = useMe();
  if (!me || me.role !== "founder" || me.twoFactor.enabled) return null;
  return (
    <Notice tone="warn" icon="2" action={<Link className="btn sm primary ml-auto" to="/app/settings">Set up</Link>}>
      <b>Protect your account with Google Authenticator.</b> <span className="small">With two-step sign-in, a stolen password can't be used to get in or change where clients pay you.</span>
    </Notice>
  );
}
