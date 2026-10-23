// Cash flow page: v2/app.js vCashflow.
import { OWNER_SALARY } from "../constants";
import { monthOf } from "../dates";
import type { CompanySnapshot } from "../types";
import { cashOnHand, liveEntries, lowStock, usualMonth } from "./ledger";
import { restockCost } from "./bookkeeping";

export function cashflowSummary(
  s: CompanySnapshot & { waitingRequests: { client: string; amount: number }[] },
  today: string,
) {
  const usual = usualMonth(s, today);
  const cash = cashOnHand(s);
  const live = liveEntries(s.entries);
  return {
    cash,
    usual: { ...usual, net: usual.moneyIn - usual.moneyOut },
    expectedIn30Days: cash + (usual.moneyIn - usual.moneyOut),
    /** Months the cash lasts if no money came in; null when there is no usual spending. */
    runwayMonths: usual.moneyOut > 0 ? cash / usual.moneyOut : null,
    ownerSalaryThisMonth: live.filter((e) => monthOf(e.date) === monthOf(today) && e.category === OWNER_SALARY).reduce((a, e) => a + e.amount, 0),
    personalPurchases: live.filter((e) => e.isPersonal).reduce((a, e) => a + e.amount, 0),
    owed: s.waitingRequests,
    restock: lowStock(s.stock).map((x) => ({ name: x.name, cost: restockCost(x.qty, x.reorderAt, x.cost) })),
  };
}
