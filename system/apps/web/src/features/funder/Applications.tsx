// Applications (v2/app.js funderApplications).
import { R, shortDate } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ScoreCell } from "../../components/charts";
import { PageHead, Pill, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import type { Application } from "../founder/Funding";
import { FunderDrawer } from "./FunderDrawer";

export default function Applications() {
  const q = useQuery({ queryKey: ["funder", "applications"], queryFn: () => api<{ funder: { name: string }; applications: (Application & { score: number | null })[] }>("/funder/applications") });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data) return <><PageHead title="Applications" /><Spinner /></>;
  return (
    <>
      <PageHead label={q.data.funder.name} title="Applications" sub="Every change to an offer needs a reason, and founders see the full history." />
      <div className="table-wrap"><table>
        <thead><tr><th>Company</th><th>Programme</th><th className="r">Requested</th><th className="r">Current offer</th><th>Status</th><th>Readiness</th><th /></tr></thead>
        <tbody>{q.data.applications.map((a) => (
          <tr key={a.id}>
            <td><b>{a.company}</b><div className="hint">{shortDate(a.appliedOn)}</div></td><td>{a.programme}</td>
            <td className="r num">{R(a.requested)}</td>
            <td className="r num">{R(a.currentOffer)}{a.changedWithoutReason && <div className="hint" style={{ color: "var(--bad)" }}>No reason given</div>}{a.reasonRequested && <div className="hint" style={{ color: "var(--warn)" }}>Founder asked why</div>}</td>
            <td><Pill tone={a.statusTone}>{a.statusLabel}</Pill></td>
            <td>{a.score !== null ? <ScoreCell score={a.score} /> : "—"}</td>
            <td className="r"><button className="btn sm" onClick={() => setOpen(a.companyId)}>Open</button></td>
          </tr>
        ))}{!q.data.applications.length && <tr><td colSpan={7} className="muted">No applications yet.</td></tr>}</tbody>
      </table></div>
      {open && <FunderDrawer companyId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
