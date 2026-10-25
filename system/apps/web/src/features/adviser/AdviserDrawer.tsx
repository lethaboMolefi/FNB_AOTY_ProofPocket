// The adviser's company drawer: full books, adviser assignment and stage moves (v2: advance, stageback, adviser select).
import { useQueryClient } from "@tanstack/react-query";
import { CompanyDrawer, type Drawer } from "../../components/CompanyDrawer";
import { Pill, useToast } from "../../components/ui";
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
      <div className="form-grid">
        <label className="field"><span>Adviser</span>
          <select value={d.support.adviserId ?? ""} onChange={(e) => void call(`/adviser/companies/${companyId}/adviser`, { adviserId: e.target.value || null })}>
            <option value="">Not assigned</option>{d.advisers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select></label>
        <div className="row">
          {d.support.stage < d.stages.length - 1
            ? <button className="btn primary" onClick={() => void call(`/adviser/companies/${companyId}/stage`, { direction: "forward" })}>Move to {d.stages[d.support.stage + 1]}</button>
            : <Pill tone="good">In monitoring</Pill>}
          {d.support.stage > 0 && <button className="btn" onClick={() => void call(`/adviser/companies/${companyId}/stage`, { direction: "back" })}>Back a stage</button>}
        </div>
      </div>
    )} />
  );
}
