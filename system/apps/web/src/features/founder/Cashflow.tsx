// Cash flow (v2/app.js vCashflow) — rebuilt with shadcn.
import { R } from "@proofpocket/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Clock, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { BarChart, type Point } from "../../components/charts";
import { Spinner } from "../../components/ui";
import { api } from "../../lib/api";
import { FounderHead } from "./FounderHead";

interface CashData {
  openingBalance: number; openingBalanceDate: string; cash: number;
  usual: { moneyIn: number; moneyOut: number; net: number };
  expectedIn30Days: number; runwayMonths: number | null;
  ownerSalaryThisMonth: number; personalPurchases: number;
  owed: { client: string; amount: number }[];
  restock: { name: string; cost: number }[];
  series: Point[];
}

const SUB = "Where your money is, where it's going, and how long it lasts.";

export default function Cashflow() {
  const q = useQuery({ queryKey: ["founder", "cashflow"], queryFn: () => api<CashData>("/founder/cashflow") });
  if (!q.data) return <><FounderHead title="Cash flow" sub={SUB} /><Spinner /></>;
  const d = q.data;
  const runwayOk = d.runwayMonths !== null && d.runwayMonths >= 3;

  return (
    <>
      <FounderHead title="Cash flow" sub={SUB} />

      {/* Key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash on hand</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{R(d.cash)}</div>
            <p className="text-xs text-muted-foreground mt-1">Opening {R(d.openingBalance)} on {d.openingBalanceDate}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Usual month</CardTitle>
            <ArrowUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${d.usual.net >= 0 ? "text-good" : "text-bad"}`}>{R(d.usual.net)}</div>
            <p className="text-xs text-muted-foreground mt-1">{R(d.usual.moneyIn)} in · {R(d.usual.moneyOut)} out</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expected in 30 days</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${d.expectedIn30Days < 0 ? "text-bad" : "text-foreground"}`}>
              {R(d.expectedIn30Days)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">If next month is usual</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash runway</CardTitle>
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${runwayOk ? "text-foreground" : "text-warn"}`}>
              {d.runwayMonths !== null ? `${d.runwayMonths.toFixed(1)}` : "—"}
              <span className="text-sm font-normal text-muted-foreground ml-1">months</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">If no money came in</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Money in and out — last 6 months</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart series={d.series} />
        </CardContent>
      </Card>

      {/* Paying yourself + Coming up */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Paying yourself</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Owner salary this month</span>
              <span className="font-semibold tabular-nums">{R(d.ownerSalaryThisMonth)}</span>
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Personal purchases from business money</span>
              <span className={`font-semibold tabular-nums ${d.personalPurchases > 0 ? "text-bad" : ""}`}>
                {R(d.personalPurchases)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
              A set monthly salary keeps business money clean and shows funders you run the business professionally.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Coming up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {d.owed.map((o, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{o.client} owes you</span>
                <span className="font-semibold tabular-nums text-good">+{R(o.amount)}</span>
              </div>
            ))}
            {d.restock.map((s) => (
              <div key={s.name} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Restock {s.name}</span>
                <span className="font-semibold tabular-nums">−{R(s.cost)}</span>
              </div>
            ))}
            {!d.owed.length && !d.restock.length && (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
