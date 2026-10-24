import { describe, expect, it } from "vitest";
import { parseAmount, parseDate, parseStatement } from "../src/lib/statements";

describe("statement parsing", () => {
  it("reads South African date formats", () => {
    expect(["2026/10/23", "2026-10-23", "20261023", "23/10/2026", "23 Oct 2026", "23 Oct 26", "3-10-2026"].map(parseDate))
      .toEqual(["2026-10-23", "2026-10-23", "2026-10-23", "2026-10-23", "2026-10-23", "2026-10-23", "2026-10-03"]);
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("Opening balance")).toBeNull();
  });
  it("reads amounts with spaces, commas, R, CR/DR and brackets", () => {
    expect(["-1 234,56", "1,234.56", "R 315.00", "100.00 CR", "100.00 DR", "(50.00)", "+740", "abc", ""].map(parseAmount))
      .toEqual([-1234.56, 1234.56, 315, 100, -100, -50, 740, null, null]);
    // Banks often export thousands separated by a no-break space.
    expect(parseAmount("12\u00a0450,00")).toBe(12450);
  });
  it("finds the columns of a signed-amount export and skips balance lines", () => {
    const csv = "Account,62810045170\nDate,Description,Amount,Balance\n2026/10/23,PAYSHAP CR KHUMALO T,740.00,7440.00\n2026/10/23,POS PURCHASE BUILDERS ALEX,-315.00,7125.00\n,Closing balance,,7125.00\n";
    const r = parseStatement(csv);
    expect(r).toMatchObject({ ok: true, skipped: 1 });
    if (r.ok) expect(r.lines).toEqual([
      { date: "2026-10-23", description: "PAYSHAP CR KHUMALO T", amount: 740, direction: "in" },
      { date: "2026-10-23", description: "POS PURCHASE BUILDERS ALEX", amount: 315, direction: "out" },
    ]);
  });
  it("ignores a byte-order mark at the start of the file", () => {
    const r = parseStatement("\uFEFFDate,Description,Amount\n2026/10/23,X,1\n");
    expect(r.ok && r.lines.length).toBe(1);
  });
  it("handles separate money in and money out columns", () => {
    const r = parseStatement("Transaction Date;Details;Money In;Money Out\n23 Oct 2026;Cash deposit;500,00;\n24 Oct 2026;Airtime;;29,00\n");
    if (!r.ok) throw new Error("expected columns to be found");
    expect(r.lines.map((l) => [l.direction, l.amount])).toEqual([["in", 500], ["out", 29]]);
  });
  it("asks for the columns when it can't tell, and uses the founder's choice", () => {
    const csv = "23/10/2026,SHOPRITE,-120.50\n24/10/2026,CLIENT EFT,900\n";
    const first = parseStatement(csv);
    expect(first).toMatchObject({ ok: false, needsMapping: true, columnCount: 3 });
    const second = parseStatement(csv, { date: 0, description: 1, amount: 2 });
    expect(second.ok && second.lines.length).toBe(2);
  });
});
