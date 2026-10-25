// Shown on every founder page when the privacy notice has changed since they agreed (POPIA s18).
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { meKey, useMe } from "../../lib/me";

export function PrivacyNoticePrompt() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const toast = useToast();
  if (!me?.company?.joined || me.company.privacyNoticeCurrent) return null;
  const agree = async () => {
    try { toast((await api<{ message: string }>("/founder/privacy/consent", { body: {} })).message); await qc.invalidateQueries({ queryKey: meKey }); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Try again."); }
  };
  return (
    <Callout tone="info" action={<Button size="sm" className="shrink-0" onClick={() => void agree()}>I agree</Button>}>
      <b>We've updated our privacy notice.</b> Read what changed in the <Link to="/privacy-notice" className="font-medium text-primary hover:underline">privacy notice</Link>, then agree to keep using ProofPocket.
    </Callout>
  );
}
