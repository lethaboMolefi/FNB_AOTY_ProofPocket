// Cash flow (v2/app.js vCashflow).
import { R } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Stat, type Point } from "../../components/charts";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface CashData {
  openingBalance: number; openingBalanceDate: string; cash: number;
  usual: { moneyIn: number; moneyOut: number; net: number }; expectedIn30Days: number; runwayMonths: number | null;
  ownerSalaryThisMonth: number; personalPurchases: number; owed: { client: string; amount: number }[]; restock: { name: string; cost: number }[];
  series: Point[];
}
const SUB = "Where your money is, where it's going, and how long it lasts.";

export default function Cashflow() {
  const q = useQuery({ queryKey: ["founder", "cashflow"], queryFn: () => api<CashData>("/founder/cashflow") });
  if (!q.data) return <><FounderHead title="Cash flow" sub={SUB} /><Spinner /></>;
  const d = q.data;
  return (
    <>
      <FounderHead title="Cash flow" sub={SUB} />
      <div className="grid-4">
        <Stat label="Cash on hand now" value={R(d.cash)} sub={`Opening balance ${R(d.openingBalance)} on ${d.openingBalanceDate}, plus everything since`} />
        <Stat label="Usual month" value={R(d.usual.net)} sub={`${R(d.usual.moneyIn)} in, ${R(d.usual.moneyOut)} out`} />
        <Stat label="Expected in 30 days" value={R(d.expectedIn30Days)} tone={d.expectedIn30Days < 0 ? "bad" : undefined} sub="If next month is a usual one" />
        <Stat label="Cash lasts" value={<>{d.runwayMonths !== null ? d.runwayMonths.toFixed(1) : "—"}<span className="small muted"> months</span></>} sub="If no money came in" />
      </div>
      <section className="panel"><h2>Money in and out</h2><BarChart series={d.series} /></section>
      <div className="grid-2">
        <section className="panel">
          <h2>Paying yourself</h2>
          <div className="li"><span>Owner salary this month</span><span className="num">{R(d.ownerSalaryThisMonth)}</span></div>
          <div className="li"><span>Personal purchases from business money</span><span className="num" style={{ color: d.personalPurchases ? "var(--bad)" : undefined }}>{R(d.personalPurchases)}</span></div>
          <div className="li"><span className="small muted">A set monthly salary keeps business money clean and shows funders you run the business professionally.</span></div>
        </section>
        <section className="panel">
          <h2>Coming up</h2>
          {d.owed.map((o, i) => <div key={i} className="li"><span>{o.client} owes you</span><span className="num in">+{R(o.amount)}</span></div>)}
          {d.restock.map((s) => <div key={s.name} className="li"><span>Restock {s.name}</span><span className="num">−{R(s.cost)}</span></div>)}
          {!d.owed.length && !d.restock.length && <div className="li"><span className="muted">Nothing scheduled.</span></div>}
        </section>
      </div>
    </>
  );
}
