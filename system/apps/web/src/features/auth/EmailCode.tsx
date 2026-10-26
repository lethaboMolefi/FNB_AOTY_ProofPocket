// Confirm your email: ProofPocket emails a 6-digit code (from its own address) and you type it here. Used on Sign up
// and on Join for anyone whose email isn't confirmed yet. Google sign-ins never see this.
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { ApiError, api } from "../../lib/api";
import { useAuth } from "../../lib/auth";

export function EmailCodeConfirm({ onConfirmed, heading = "h2" }: { onConfirmed: () => void; heading?: "h1" | "h2" }) {
  const auth = useAuth();
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const asked = useRef(false);

  const send = async (resend: boolean) => {
    setErr("");
    try {
      const r = await api<{ sent: boolean; confirmed: boolean; message: string }>("/auth/email-code/send", { body: { resend } });
      if (r.confirmed) { await auth.refresh(); onConfirmed(); return; }
      setNote(r.message);
      if (r.sent) setWait(30);
    } catch (x) { setErr(x instanceof ApiError ? x.message : "Couldn't send the code. Try again."); }
  };
  useEffect(() => { if (!asked.current) { asked.current = true; void send(false); } });
  useEffect(() => {
    if (!wait) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr("");
    if (!/^\d{6}$/.test(code)) { setErr("Enter the 6-digit code from the email."); return; }
    setBusy(true);
    try {
      await api("/auth/email-code/verify", { body: { code } });
      await auth.refresh();
      onConfirmed();
    } catch (x) { setErr(x instanceof ApiError ? x.message : "That didn't work. Try again."); }
    finally { setBusy(false); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-primary"><MailCheck className="h-5 w-5" aria-hidden="true" /></span>
        <CardTitle as={heading} className="text-xl font-bold tracking-tight">Confirm your email</CardTitle>
        <CardDescription>We emailed a 6-digit code to <b className="text-foreground">{auth.email}</b>. Enter it here. It works for 10 minutes. Check your spam folder if you can't see it.</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-3" onSubmit={submit} noValidate>
          <TextField label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            className="max-w-xs [&_input]:h-12 [&_input]:text-center [&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[.4em]"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          {note && !err && <p className="text-xs text-muted-foreground" role="status">{note}</p>}
          {err && <Callout tone="bad" role="alert">{err}</Callout>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy || code.length !== 6}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Confirm email</Button>
            <Button type="button" variant="outline" disabled={wait > 0} onClick={() => void send(true)}>{wait ? `Send a new code (${wait}s)` : "Send a new code"}</Button>
            <Button type="button" variant="ghost" onClick={() => void auth.signOut()}>Use a different email</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
