// The adviser's company drawer: full books, adviser assignment and stage moves (v2: advance, stageback, adviser select).
import { useQueryClient } from "@tanstack/react-query";
import { CompanyDrawer, type Drawer } from "../../components/CompanyDrawer";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/field";
import { ToneBadge } from "../../components/ToneBadge";
import { useToast } from "../../components/ui";
import { ApiError, api } from "../../lib/api";

type AdviserDrawerData = Drawer & { advisers: { id: string; name: string }[]; stages: string[] };

export function AdviserDrawer({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const call = async (path: string, body: object) => {
    try { toast((await api<{ message: string }>(path, { body })).message); void qc.invalidateQueries({ queryKey: ["drawer"] }); void qc.invalidateQueries({ queryKey: ["adviser"] }); }
    catch (e) { toast((e as ApiError).message); }
  };
  return (
    <CompanyDrawer<AdviserDrawerData> path={`/adviser/companies/${companyId}`} onClose={onClose} supportControls={(d) => (
      <div className="space-y-3">
        <NativeSelect label="Adviser" value={d.support.adviserId ?? ""} onChange={(e) => void call(`/adviser/companies/${companyId}/adviser`, { adviserId: e.target.value || null })}>
          <option value="">Not assigned</option>{d.advisers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </NativeSelect>
        <div className="flex flex-wrap items-center gap-2">
          {d.support.stage < d.stages.length - 1
            ? <Button onClick={() => void call(`/adviser/companies/${companyId}/stage`, { direction: "forward" })}><ArrowRight className="h-4 w-4" />Move to {d.stages[d.support.stage + 1]}</Button>
            : <ToneBadge tone="good">In monitoring</ToneBadge>}
          {d.support.stage > 0 && <Button variant="outline" onClick={() => void call(`/adviser/companies/${companyId}/stage`, { direction: "back" })}><ArrowLeft className="h-4 w-4" />Back a stage</Button>}
        </div>
      </div>
    )} />
  );
}
