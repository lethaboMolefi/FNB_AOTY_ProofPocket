// Privacy & sharing — control who can see your business.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Spinner, useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

type Sharing = "none" | "summary" | "full";

interface PrivacyData {
  sharing: Sharing;
  explanation: { none: string; summary: string; full: string };
}

const OPTIONS: { value: Sharing; title: string; tagline: string }[] = [
  { value: "none",    title: "Hidden",       tagline: "No funder or adviser access" },
  { value: "summary", title: "Summary",      tagline: "Name, sector, score and badge only" },
  { value: "full",    title: "Full access",  tagline: "Books, documents and everything — best for funding" },
];

export default function Privacy() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["founder", "privacy"], queryFn: () => api<PrivacyData>("/founder/privacy") });
  const [selected, setSelected] = useState<Sharing | null>(null);

  const save = useMutation({
    mutationFn: () => api<{ message: string }>("/founder/privacy", {
      method: "PUT", body: { sharing: selected ?? q.data?.sharing },
    }),
    onSuccess: (r) => { toast(r.message); void qc.invalidateQueries({ queryKey: ["founder", "privacy"] }); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Try again."),
  });

  if (!q.data) return <><FounderHead title="Privacy & sharing" /><Spinner /></>;
  const d = q.data;
  const current = selected ?? d.sharing;

  return (
    <>
      <FounderHead
        title="Privacy & sharing"
        sub="You decide who sees what. You can change this at any time."
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Who can see your business?</CardTitle>
          <CardDescription>Funders and advisers only see what you allow.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {OPTIONS.map((opt) => {
            const isSelected = current === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                className={cn(
                  "w-full rounded-lg border p-4 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-foreground/30 hover:bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{opt.title}</span>
                      {d.sharing === opt.value && (
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">current</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.tagline}</p>
                    <p className="text-sm text-foreground/70 mt-1.5">{d.explanation[opt.value]}</p>
                  </div>
                  <div className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isSelected ? "border-primary bg-primary" : "border-border",
                  )}>
                    {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                  </div>
                </div>
              </button>
            );
          })}

          <div className="flex justify-end pt-1">
            <Button onClick={() => save.mutate()} disabled={save.isPending || current === d.sharing}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save preference
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <Info className="h-4 w-4 mt-0.5 shrink-0 text-foreground/60" />
        <p>
          Your documents are always private — only your adviser and the ProofPocket checker see them.
          This setting only controls what funders see in their company pipeline.
        </p>
      </div>
    </>
  );
}
