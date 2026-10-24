// Turning two-step sign-in on or off (founders). Staff accounts always have it on.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Notice, Pill, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { meKey, useMe } from "../../lib/me";

export function TwoFactorCard() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const tf = me?.twoFactor;

  const send = useMutation({
    mutationFn: () => api<{ sentTo: string }>("/auth/otp/request", { body: { purpose: "two_factor" } }),
    onSuccess: (r) => setSentTo(r.sentTo),
  });
  const change = useMutation({
    mutationFn: (enabled: boolean) => api("/auth/two-factor", { body: { enabled, code } }),
    onSuccess: async (_r, enabled) => {
      setCode(""); setSentTo(null);
      await qc.invalidateQueries({ queryKey: meKey });
      toast(enabled ? "Two-step sign-in is on" : "Two-step sign-in is off");
    },
  });
  if (!tf) return null;
  const err = (change.error ?? send.error) as ApiError | null;

  return (
    <section className="panel flex flex-col gap-3" aria-labelledby="tf-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="tf-title" className="!mb-0">Two-step sign-in</h2>
        {tf.enabled ? <Pill tone="good">On</Pill> : <Pill tone="warn">Off</Pill>}
      </div>
      <p className="small muted">Each time you sign in, ProofPocket emails you a 6-digit PIN. Someone who steals or guesses your password still can't get in, see your books or change where clients pay you.</p>
      {tf.required ? (
        <p className="small">Always on for funder, adviser and admin accounts.</p>
      ) : !sentTo ? (
        <button className={`btn self-start ${tf.enabled ? "" : "primary"}`} onClick={() => send.mutate()} disabled={send.isPending}>
          {tf.enabled ? "Turn off two-step sign-in" : "Turn on two-step sign-in"}
        </button>
      ) : (
        <form className="flex flex-col gap-2" noValidate onSubmit={(e) => { e.preventDefault(); change.mutate(!tf.enabled); }}>
          <label className="field"><span>PIN sent to {sentTo}</span>
            <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="mono tracking-[.3em]"
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className={`btn ${tf.enabled ? "danger" : "primary"}`} type="submit" disabled={code.length !== 6 || change.isPending}>{tf.enabled ? "Turn off" : "Turn on"}</button>
            <button className="btn ghost" type="button" onClick={() => send.mutate()}>Send a new PIN</button>
          </div>
        </form>
      )}
      {err && <p className="err" role="alert">{err.message}</p>}
    </section>
  );
}

/** Home prompt for founders who haven't turned it on yet. */
export function TwoFactorPrompt() {
  const { data: me } = useMe();
  if (!me || me.role !== "founder" || me.twoFactor.enabled) return null;
  return (
    <Notice tone="warn" icon="2" action={<Link className="btn sm primary ml-auto" to="/app/settings">Turn on</Link>}>
      <b>Protect your account with two-step sign-in.</b> <span className="small">We'll email you a PIN when you sign in, so a stolen password can't be used to change where clients pay you.</span>
    </Notice>
  );
}
