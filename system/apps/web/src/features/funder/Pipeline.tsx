// Company pipeline (v2/app.js funderPipeline).
import { AREAS } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ScoreCell, Spark } from "../../components/charts";
import { PageHead, Pill, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { FunderDrawer } from "./FunderDrawer";

interface Row { id: string; name: string; sector: string; stage: string; town: string; area: keyof typeof AREAS; sharing: string; score: number; spark: number[]; lastEntryDays: number | null; qualifies: number }
interface Data { funder: { name: string; kind: string | null }; tiles: { visible: number; hidden: number; qualify: number; ready: number; applications: number }; sectors: string[]; rows: Row[] }

export default function Pipeline() {
  const q = useQuery({ queryKey: ["funder", "pipeline"], queryFn: () => api<Data>("/funder/pipeline") });
  const [f, setF] = useState({ q: "", sector: "", area: "", min: 0 });
  const [open, setOpen] = useState<string | null>(null);
  if (!q.data) return <><PageHead title="Company pipeline" /><Spinner /></>;
  const d = q.data;
  const rows = d.rows.filter((r) => (!f.q || `${r.name} ${r.town} ${r.sector}`.toLowerCase().includes(f.q.toLowerCase())) && (!f.sector || r.sector === f.sector) && (!f.area || r.area === f.area) && r.score >= f.min);
  const books = (n: number | null) => n === null ? <Pill tone="bad">None</Pill> : n <= 7 ? <Pill tone="good">Up to date</Pill> : n <= 14 ? <Pill tone="warn">{n} days</Pill> : <Pill tone="bad">{n} days</Pill>;
  return (
    <>
      <PageHead label={`${d.funder.name} · ${d.funder.kind ?? ""} funder`} title="Company pipeline" sub="Verified companies that chose to share with funders, ranked by readiness. Scores come from checked documents and live books, not self-reported figures." />
      <div className="grid-4">
        <div className="panel stat"><span className="label">Verified and sharing</span><span className="v">{d.tiles.visible}</span><span className="small muted">{d.tiles.hidden} Starter or private</span></div>
        <div className="panel stat"><span className="label">Meet your requirements</span><span className="v">{d.tiles.qualify}</span><span className="small muted">For at least one programme</span></div>
        <div className="panel stat"><span className="label">Funding ready (70+)</span><span className="v">{d.tiles.ready}</span></div>
        <div className="panel stat"><span className="label">Applications to you</span><span className="v">{d.tiles.applications}</span><Link className="btn ghost sm self-start" to="/funder/applications">Open</Link></div>
      </div>
      <div className="panel"><div className="form-grid">
        <label className="field"><span>Search</span><input type="text" placeholder="Name, town or sector" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></label>
        <label className="field"><span>Sector</span><select value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })}><option value="">All sectors</option>{d.sectors.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label className="field"><span>Area</span><select value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })}><option value="">Township, urban and rural</option>{Object.entries(AREAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="field"><span>Minimum readiness: <b className="num">{f.min}</b></span><input type="range" min={0} max={100} step={5} value={f.min} onChange={(e) => setF({ ...f, min: Number(e.target.value) })} style={{ accentColor: "var(--accent)" }} /></label>
      </div></div>
      <div className="table-wrap"><table>
        <thead><tr><th>Company</th><th>Area</th><th>Readiness</th><th>Your programmes</th><th>Income, 5 months</th><th>Books</th><th>Sharing</th></tr></thead>
        <tbody>{rows.map((r) => (
          <tr key={r.id} className="click" tabIndex={0} onClick={() => setOpen(r.id)} onKeyDown={(e) => { if (e.key === "Enter") setOpen(r.id); }}>
            <td><b>{r.name}</b><div className="hint">{r.sector} · {r.stage}</div></td>
            <td>{r.town}<div className="hint">{AREAS[r.area]}</div></td>
            <td><ScoreCell score={r.score} /></td>
            <td>{r.qualifies ? <Pill tone="good">Qualifies for {r.qualifies}</Pill> : <Pill tone="plain">Not yet</Pill>}</td>
            <td><Spark values={r.spark} /></td><td>{books(r.lastEntryDays)}</td>
            <td className="small">{r.sharing === "full" ? "Full books" : "Summary"}</td>
          </tr>
        ))}{!rows.length && <tr><td colSpan={7} className="muted">No companies match these filters.</td></tr>}</tbody>
      </table></div>
      {open && <FunderDrawer companyId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
