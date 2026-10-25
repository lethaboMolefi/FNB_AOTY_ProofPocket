// Company detail for funders and advisers (v2/app.js drawerHTML): a side drawer on desktop, full screen on phones.
import { R, shortDate, type DocState, type Flag, type ReadinessItem, type Tone } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";
import { api } from "../lib/api";
import { BarChart, Checklist, Ring, type Point } from "./charts";
import { LevelPill, Notice, Pill, Spinner } from "./ui";

export interface Drawer {
  company: { id: string; name: string; sector: string; town: string; province: string; area: string; cipcNumber: string | null; stage: string; employees: number; verified: boolean; sharing: string; recordMonths: number };
  readiness: { score: number; label: string; tone: Tone; items: ReadinessItem[] };
  documentsChecked: number;
  figures: { income5: number; avgProfit: number; cash: number; people: number };
  flags: Flag[]; series: Point[];
  entries: { id: string; date: string; note: string; method: string; direction: "in" | "out"; amount: number; isPersonal: boolean; voided: boolean }[] | null;
  documents: { docType: string; name: string; state: DocState }[];
  support: { incubator: string | null; stage: number; stageName: string; adviser: string | null; adviserId: string | null; logs: { id: string; date: string; type: string; note: string }[] };
  activity: { date: string; text: string }[];
}

const DOC_PILL: Record<DocState, [Tone, string]> = { verified: ["good", "Verified"], pending: ["warn", "Being checked"], missing: ["bad", "Missing"], expired: ["bad", "Expired"] };
const STAGES = ["Assessment", "Adviser assigned", "Service agreement", "Intervention", "Monitoring & evaluation"];

export function CompanyDrawer<T extends Drawer>({ path, onClose, children, supportControls }: {
  path: string; onClose: () => void; children?: (d: T) => ReactNode; supportControls?: (d: T) => ReactNode;
}) {
  const q = useQuery({ queryKey: ["drawer", path], queryFn: () => api<T>(path) });
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = ""; };
  }, [onClose]);
  const d = q.data;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} className="drawer" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="dr-title">
        <div className="sticky top-0 z-[2] flex items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4">
          <div>
            {d && <div className="label">{d.company.sector} · {d.company.town}, {d.company.province}</div>}
            <h2 id="dr-title">{d?.company.name ?? "Loading…"}</h2>
            {d && <div className="row mt-1.5" style={{ gap: 6 }}>
              <LevelPill verified={d.company.verified} />{d.company.cipcNumber && <Pill tone="plain">CIPC {d.company.cipcNumber}</Pill>}
              <Pill tone="plain">{d.company.area[0]!.toUpperCase() + d.company.area.slice(1)}</Pill><Pill tone="plain">{d.company.recordMonths} months on record</Pill>
            </div>}
          </div>
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          {!d ? (q.isError ? <p className="err">Couldn't open this company.</p> : <Spinner />) : <>
            <div className="grid-2">
              <div className="panel"><div className="row" style={{ gap: 16 }}><Ring score={d.readiness.score} />
                <div className="stack" style={{ gap: 6 }}><Pill tone={d.readiness.tone}>{d.readiness.label}</Pill><span className="small muted">{d.documentsChecked} of 9 documents checked</span></div></div></div>
              <div className="panel grid-2" style={{ gap: 10 }}>
                <div className="stat"><span className="label">Income, 5 months</span><span className="v" style={{ fontSize: "1.1rem" }}>{R(d.figures.income5)}</span></div>
                <div className="stat"><span className="label">Avg monthly profit</span><span className="v" style={{ fontSize: "1.1rem" }}>{R(d.figures.avgProfit)}</span></div>
                <div className="stat"><span className="label">Cash on hand</span><span className="v" style={{ fontSize: "1.1rem" }}>{R(d.figures.cash)}</span></div>
                <div className="stat"><span className="label">People</span><span className="v" style={{ fontSize: "1.1rem" }}>{d.figures.people}</span></div>
              </div>
            </div>
            {d.flags.length > 0 && <div className="panel"><h3>Flags</h3><div className="row" style={{ gap: 6 }}>{d.flags.map((f) => <Pill key={f.code} tone={f.level}>{f.text}</Pill>)}</div></div>}
            <div className="panel"><h3>Money in and out</h3><BarChart series={d.series} /></div>
            {d.entries ? (
              <div className="panel" style={{ padding: 0 }}><h3 style={{ padding: "16px 18px 8px" }}>Latest entries</h3>
                <div className="table-wrap flush"><table><tbody>{d.entries.map((e) => (
                  <tr key={e.id} style={e.voided ? { opacity: 0.5 } : undefined}><td className="num">{shortDate(e.date)}</td><td>{e.note}{e.isPersonal && <> <Pill tone="warn">Personal</Pill></>}</td>
                    <td className={`r num ${e.direction === "in" ? "in" : ""}`}>{e.direction === "in" ? "+" : "−"}{R(e.amount)}</td></tr>
                ))}{!d.entries.length && <tr><td className="muted">No entries.</td></tr>}</tbody></table></div></div>
            ) : <Notice tone="info" icon="i"><span className="small">This founder shares a summary only. Individual book entries are private.</span></Notice>}
            <div className="grid-2">
              <div className="panel"><h3>Documents</h3>{d.documents.map((x) => <div key={x.docType} className="li"><span className="small">{x.name}</span><Pill tone={DOC_PILL[x.state][0]}>{DOC_PILL[x.state][1]}</Pill></div>)}</div>
              <div className="panel"><h3>Bookkeeping health</h3><Checklist items={d.readiness.items.filter((i) => i.group === "Bookkeeping")} /></div>
            </div>
            {children?.(d)}
            <div className="panel stack">
              <div className="panel-head" style={{ margin: 0 }}><h3>Incubator support</h3><span className="small muted">{d.support.incubator ?? "No incubator"}</span></div>
              <div className="steps">{STAGES.map((s, i) => <span key={s} className={`step ${i < d.support.stage ? "done" : i === d.support.stage ? "now" : ""}`}>{s}</span>)}</div>
              {supportControls ? supportControls(d) : <span className="small">Adviser: {d.support.adviser ?? "not assigned"}</span>}
              {d.support.logs.length ? d.support.logs.map((l) => <div key={l.id} className="tl"><span className="when">{shortDate(l.date)}</span><span><b>{l.type}</b><br /><span className="small muted">{l.note}</span></span></div>)
                : <p className="small muted">No support logged yet.</p>}
            </div>
            <div className="panel"><h3>Activity</h3>{d.activity.length ? d.activity.map((a, i) => <div key={i} className="tl"><span className="when">{shortDate(a.date.slice(0, 10))}</span><span>{a.text}</span></div>) : <p className="muted small">No activity yet.</p>}</div>
          </>}
        </div>
      </aside>
    </>
  );
}
