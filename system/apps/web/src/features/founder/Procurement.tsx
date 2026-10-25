// Procurement — tenders and buyer introductions.
import { R, shortDate } from "@proofpocket/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Building, Calendar, CheckCircle2, Loader2, Tag } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

type TenderAction =
  | { kind: "can_express" }
  | { kind: "verify_first" }
  | { kind: "add_documents"; missing: string[] }
  | { kind: "more_months"; months: number };

interface Tender {
  id: string; title: string; buyerName: string; value: number; closesOn: string;
  sectors: string[]; requiredDocs: string[]; action: TenderAction; myStatus: string | null;
}
interface Buyer {
  id: string; name: string; sectors: string[]; introStatus: string | null;
}
interface ProcurementData {
  score: number; recordMonths: number;
  tenders: Tender[];
  buyers: Buyer[];
}

export default function Procurement() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "procurement"], queryFn: () => api<ProcurementData>("/founder/procurement") });

  const interest = useMutation({
    mutationFn: (tenderId: string) =>
      api<{ message: string }>(`/founder/procurement/tenders/${tenderId}/interest`, { body: {} }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder", "procurement"] }); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Try again."),
  });

  const intro = useMutation({
    mutationFn: (buyerId: string) =>
      api<{ message: string }>(`/founder/procurement/buyers/${buyerId}/intro`, { body: {} }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder", "procurement"] }); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Try again."),
  });

  if (!q.data) return <><FounderHead title="Procurement" /><Spinner /></>;
  const d = q.data;

  return (
    <>
      <FounderHead
        title="Procurement"
        sub="Tenders and supplier opportunities. Buyers see your checked documents so you don't have to prove it from scratch."
      />

      {/* Score summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Readiness score</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{d.score}<span className="text-sm font-normal text-muted-foreground"> /100</span></p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Months of records</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{d.recordMonths}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Open tenders</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{d.tenders.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Buyers</p>
            <p className="text-2xl font-bold tabular-nums mt-1">{d.buyers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tenders */}
      <div>
        <h2 className="text-lg font-semibold tracking-tight mb-3">Open tenders</h2>
        {d.tenders.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No open tenders right now. Check back soon.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {d.tenders.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{t.title}</CardTitle>
                      <CardDescription className="flex items-center gap-1.5 mt-0.5">
                        <Building className="h-3.5 w-3.5" />{t.buyerName}
                      </CardDescription>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold tabular-nums text-foreground">{R(t.value)}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end mt-0.5">
                        <Calendar className="h-3 w-3" />Closes {shortDate(t.closesOn)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  {/* Sectors and required docs */}
                  <div className="flex flex-wrap gap-1">
                    {t.sectors.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">
                        <Tag className="h-2.5 w-2.5 mr-1" />{s}
                      </Badge>
                    ))}
                    {t.requiredDocs.map((doc) => (
                      <Badge key={doc} variant="outline" className="text-[10px]">{doc.toUpperCase()}</Badge>
                    ))}
                  </div>

                  {/* Action */}
                  {t.myStatus === "requested" ? (
                    <div className="flex items-center gap-1.5 text-sm text-good">
                      <CheckCircle2 className="h-4 w-4" />
                      Interest sent — the buyer will be in touch.
                    </div>
                  ) : t.action.kind === "can_express" ? (
                    <Button
                      size="sm"
                      onClick={() => interest.mutate(t.id)}
                      disabled={interest.isPending}
                    >
                      {interest.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Express interest
                    </Button>
                  ) : t.action.kind === "verify_first" ? (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-warn shrink-0" />
                      <span className="text-sm text-muted-foreground">Get Verified first —</span>
                      <Button size="sm" variant="outline" asChild className="h-7">
                        <Link to="/app/start">Complete registration</Link>
                      </Button>
                    </div>
                  ) : t.action.kind === "add_documents" ? (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-warn shrink-0" />
                      <span className="text-sm text-muted-foreground">
                        Missing: {t.action.missing.map((d) => d.toUpperCase()).join(", ")} —
                      </span>
                      <Button size="sm" variant="outline" asChild className="h-7">
                        <Link to="/app/start">Upload</Link>
                      </Button>
                    </div>
                  ) : t.action.kind === "more_months" ? (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <AlertCircle className="h-4 w-4 text-warn shrink-0" />
                      Need {t.action.months} more {t.action.months === 1 ? "month" : "months"} of records.
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Buyers */}
      {d.buyers.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold tracking-tight mb-3">Buyers offering introductions</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.buyers.map((buyer) => (
              <Card key={buyer.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{buyer.name}</p>
                      {buyer.sectors.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">{buyer.sectors.join(", ")}</p>
                      )}
                    </div>
                    {buyer.introStatus === "requested" ? (
                      <Badge variant="success" className="text-[10px] shrink-0">Requested</Badge>
                    ) : (
                      <Button
                        size="sm" variant="outline"
                        onClick={() => intro.mutate(buyer.id)}
                        disabled={intro.isPending}
                        className="shrink-0"
                      >
                        {intro.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Request intro
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
