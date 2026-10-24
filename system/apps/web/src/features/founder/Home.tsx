// Home (v2/app.js vHome).
import { R, plural, type Flag, type JourneyStep, type ReadinessItem, type Tone } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BarChart, Stat, type Point } from "../../components/charts";
import { Notice, Pill, Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface HomeData {
  company: { name: string; typeLabel: string; area: string; employees: number; foundedYear: number; verified: boolean };
  notices: { starter: boolean; proofsToCheck: number; fraudOpen: number };
  journey: JourneyStep[];
  tiles: { moneyIn: number; moneyOut: number; cash: number; score: number; label: string; tone: Tone };
  series: Point[];
  nextSteps: ReadinessItem[];
  flags: Flag[];
  messages: { id: string; sender: string; verified: boolean; body: string }[];
}

const AREA: Record<string, string> = { township: "Township", urban: "Urban", rural: "Rural" };
const VIEW: Record<JourneyStep["view"], string> = { start: "start", books: "books", payments: "payments", cashflow: "cashflow", markets: "markets" };

export default function Home() {
  const q = useQuery({ queryKey: ["founder", "home"], queryFn: () => api<HomeData>("/founder/home") });
  if (!q.data) return <><FounderHead title="Home" />{q.isError ? <p className="err">Couldn't load your Home screen. Check your connection.</p> : <Spinner />}</>;
  const d = q.data, c = d.company, t = d.tiles;
  return (
    <>
      <FounderHead title="Home" sub={`${c.typeLabel} · ${AREA[c.area]} · ${c.employees} ${plural(c.employees, "person", "people")} · trading since ${c.foundedYear}`} />
      {d.notices.starter && (
        <Notice tone="info" icon="i" action={<Link className="btn sm primary ml-auto" to="/app/start">Continue</Link>}>
          <b>You're on a Starter account.</b> <span className="small">You can keep books, take payments and build your profile now. Finish the registration steps to get verified, so funders and buyers can find you.</span>
        </Notice>
      )}
      {d.notices.proofsToCheck > 0 && (
        <Notice tone="warn" icon="R" action={<Link className="btn sm ml-auto" to="/app/payments">Check</Link>}>
          <b>{d.notices.proofsToCheck} {d.notices.proofsToCheck > 1 ? "clients say they have" : "client says they have"} paid.</b> <span className="small">Check your banking app, then confirm so it goes into your books.</span>
        </Notice>
      )}
      {d.notices.fraudOpen > 0 && (
        <Notice tone="bad" icon="!" action={<Link className="btn sm ml-auto" to="/app/protection">Review</Link>}>
          <b>{d.notices.fraudOpen} possible {plural(d.notices.fraudOpen, "scam")} need your attention.</b> <span className="small">Check before you pay anyone.</span>
        </Notice>
      )}
      <nav className="journey" aria-label="Your journey">
        {d.journey.map((s, i) => (
          <Link key={s.title} to={`/app/${VIEW[s.view]}`} className={`jstep ${s.done ? "ok" : ""}`}>
            <span className="jn" aria-hidden="true">{s.done ? "✓" : i + 1}</span>
            <span className="jt"><b>{s.title}</b><span className="hint">{s.detail}</span></span>
          </Link>
        ))}
      </nav>
      <div className="grid-4">
        <Stat label="Money in this month" value={R(t.moneyIn)} tone="in" />
        <Stat label="Money out this month" value={R(t.moneyOut)} />
        <Stat label="Cash on hand" value={R(t.cash)} sub="Bank and cash together" />
        <Stat label="Funding readiness" value={<>{t.score}<span className="small muted"> / 100</span></>} sub={<Pill tone={t.tone}>{t.label}</Pill>} />
      </div>
      <div className="grid-3">
        <section className="panel span-2">
          <div className="panel-head"><h2>Six months at a glance</h2><Link className="btn sm" to="/app/cashflow">Cash flow</Link></div>
          <BarChart series={d.series} />
        </section>
        <section className="panel">
          <h2>Next steps</h2>
          {d.nextSteps.length ? d.nextSteps.map((i) => (
            <div key={i.key} className="li">
              <div className="li-main"><span>{i.label}</span><span className="hint">{i.hint} · worth {i.pts} points</span></div>
              <div className="li-side"><Link className="btn sm" to={i.group === "Documents" ? "/app/start" : "/app/books"}>Fix</Link></div>
            </div>
          )) : <p className="muted">Everything funders check is in place.</p>}
        </section>
      </div>
      <div className="grid-2">
        <section className="panel">
          <h2>Things to watch</h2>
          {d.flags.length ? d.flags.map((f) => (
            <div key={f.code} className="li"><span>{f.text}</span><Pill tone={f.level}>{f.level === "bad" ? "Act now" : "Check"}</Pill></div>
          )) : <p className="muted">Nothing needs attention.</p>}
        </section>
        <section className="panel">
          <h2>Messages</h2>
          {d.messages.length ? d.messages.map((m) => (
            <div key={m.id} className="li"><div className="li-main">
              <span><b>{m.sender}</b> {m.verified ? <Pill tone="good">Verified</Pill> : <Pill tone="bad">Not verified</Pill>}</span>
              <span className="small">{m.body}</span>
            </div></div>
          )) : <p className="muted">No messages.</p>}
        </section>
      </div>
    </>
  );
}
