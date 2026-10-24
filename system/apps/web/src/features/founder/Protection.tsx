// Fraud Protection — suspicious messages, bank detail changes, safety tips.
import { shortDate } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, CheckCircle2, Flag, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface FraudMessage {
  id: string; kind: string; sender: string; senderAddress: string; body: string;
  riskFlags: string[]; status: string; receivedOn: string;
  watchStatus: string | null; watchReports: number;
}
interface DetailChange {
  id: string; bank: string; accountName: string; accountLast4: string | null; changedAt: string | null;
}
interface ProtectionData {
  messages: FraudMessage[];
  detailChanges: DetailChange[];
  tips: string[];
}

export default function Protection() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "protection"], queryFn: () => api<ProtectionData>("/founder/protection") });

  const report = useMutation({
    mutationFn: (messageId: string) => api<{ message: string }>("/founder/protection/report", { body: { messageId } }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder", "protection"] }); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Try again."),
  });

  if (!q.data) return <><FounderHead title="Fraud protection" /><Spinner /></>;
  const d = q.data;
  const openMessages = d.messages.filter((m) => m.status === "open");
  const reportedMessages = d.messages.filter((m) => m.status === "reported");

  return (
    <>
      <FounderHead
        title="Fraud protection"
        sub="Scam warnings, holds on changed bank details, and a fingerprint on every document."
      />

      {/* Summary banner */}
      {openMessages.length > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-destructive">
              {openMessages.length} unverified {openMessages.length === 1 ? "message" : "messages"} need your attention.
            </p>
            <p className="text-muted-foreground mt-0.5">
              Check before you pay anyone or share any banking details.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-lg border border-good/30 bg-good/5 p-4">
          <ShieldCheck className="h-4 w-4 text-good shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-good">No suspicious messages right now.</p>
        </div>
      )}

      {/* Suspicious messages */}
      {d.messages.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Suspicious messages</CardTitle>
            <CardDescription>Messages from senders ProofPocket could not verify.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-2">
            {d.messages.map((m, i) => (
              <div key={m.id}>
                {i > 0 && <Separator />}
                <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{m.sender}</span>
                      {m.senderAddress && (
                        <span className="text-xs text-muted-foreground font-mono">{m.senderAddress}</span>
                      )}
                      {m.watchStatus === "confirmed" && (
                        <Badge variant="destructive" className="text-[10px]">Known scam</Badge>
                      )}
                      {m.watchStatus === "watch" && m.watchReports > 1 && (
                        <Badge variant="warning" className="text-[10px]">{m.watchReports} reports</Badge>
                      )}
                      {m.status === "reported" && (
                        <Badge variant="outline" className="text-[10px]">Reported</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">{m.body}</p>
                    {m.riskFlags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.riskFlags.map((f) => (
                          <Badge key={f} variant="destructive" className="text-[10px]">
                            <AlertTriangle className="h-2.5 w-2.5 mr-1" />{f}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">{shortDate(m.receivedOn)}</p>
                  </div>
                  {m.status === "open" && (
                    <Button
                      size="sm" variant="outline"
                      className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5"
                      onClick={() => report.mutate(m.id)}
                    >
                      <Flag className="h-3.5 w-3.5" />
                      Report as scam
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Bank detail changes */}
      {d.detailChanges.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bank detail history</CardTitle>
            <CardDescription>
              ProofPocket puts a 24-hour hold on any change to your payment details. If you see a change you didn't make, contact your adviser immediately.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account name</TableHead>
                  <TableHead className="hidden sm:table-cell">Last 4</TableHead>
                  <TableHead>Changed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.detailChanges.map((dc, i) => (
                  <TableRow key={dc.id}>
                    <TableCell className="text-sm">{dc.bank}</TableCell>
                    <TableCell className="text-sm">{dc.accountName}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm font-mono text-muted-foreground">
                      {dc.accountLast4 ? `···${dc.accountLast4}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {dc.changedAt ? shortDate(dc.changedAt.slice(0, 10)) : "—"}
                      {i === 0 && <Badge variant="success" className="ml-2 text-[10px]">Current</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Safety tips */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Safety tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 pt-0">
          {d.tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2.5 text-sm">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-good mt-0.5" />
              <span className="text-muted-foreground">{tip}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
