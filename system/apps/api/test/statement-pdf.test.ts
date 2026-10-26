import { addDays, todayZA } from "@proofpocket/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { newFounder, testApp } from "./helpers";
import { parsePdfStatement } from "../src/lib/statements";
import { pdfTextLines } from "../src/lib/statement-pdf";

/** A tiny real PDF with one line of text per row (Helvetica), for reading tests. */
function makePdf(rows: string[]): Buffer {
  const esc = (t: string) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const content = rows.map((r, i) => `BT /F1 9 Tf 40 ${800 - i * 14} Td (${esc(r)}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out)); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

describe("PDF bank statements", () => {
  it("FNB style: dates without a year, Cr for money in, plain amounts out, balance last", () => {
    const r = parsePdfStatement([
      "First National Bank  Statement Period : 01 October 2026 to 31 October 2026",
      "Opening Balance 5,000.00Cr",
      "05 Oct Payshap Credit From Thandi 1,200.00Cr 6,200.00Cr",
      "07 Oct POS Purchase Makro Germiston 350.00 5,850.00Cr",
      "12 Oct #Monthly Account Fee 69.00 5,781.00Cr",
      "Closing Balance 5,781.00Cr",
    ]);
    expect(r.bank).toBe("FNB");
    expect(r.lines).toEqual([
      { date: "2026-10-05", description: "Payshap Credit From Thandi", amount: 1200, direction: "in" },
      { date: "2026-10-07", description: "POS Purchase Makro Germiston", amount: 350, direction: "out" },
      { date: "2026-10-12", description: "#Monthly Account Fee", amount: 69, direction: "out" },
    ]);
  });

  it("Capitec style: full dates, minus for money out, a fee column, spaces in thousands", () => {
    const r = parsePdfStatement([
      "Capitec Bank  Account Statement",
      "Opening balance 10 000.00",
      "03/10/2026 Payment Received: Naledi 2 500.00 12 500.00",
      "04/10/2026 Card Purchase: Shoprite -1 234.50 -2.00 11 263.50",
      "06/10/2026 Send Cash -500.00 -10.00 10 753.50",
    ]);
    expect(r.bank).toBe("Capitec");
    expect(r.lines).toEqual([
      { date: "2026-10-03", description: "Payment Received: Naledi", amount: 2500, direction: "in" },
      // The fee is its own column; the amount is the purchase. The balance moved by both.
      { date: "2026-10-04", description: "Card Purchase: Shoprite", amount: 1234.5, direction: "out" },
      { date: "2026-10-06", description: "Send Cash", amount: 500, direction: "out" },
    ]);
  });

  it("Standard Bank / Absa style: ISO or long dates and minus signs, no opening balance line", () => {
    const r = parsePdfStatement([
      "STANDARD BANK",
      "2026-10-02 DEPOSIT CASH 800.00 3,800.00",
      "2026-10-03 DEBIT ORDER INSURANCE -150.00 3,650.00",
      "14 Oct 2026 IB PAYMENT TO SUPPLIER -1,000.00 2,650.00",
    ]);
    expect(r.lines.map((l) => [l.date, l.amount, l.direction])).toEqual([["2026-10-02", 800, "in"], ["2026-10-03", 150, "out"], ["2026-10-14", 1000, "out"]]);
  });

  it("skips headers, totals and lines without a date or amount", () => {
    const r = parsePdfStatement(["Date Description Amount Balance", "Page 1 of 3", "Total Credits 4,000.00", "Hello 12 Oct"]);
    expect(r.lines).toEqual([]);
  });

  it("reads the text lines out of a real PDF file", async () => {
    const pdf = makePdf(["Capitec Bank", "03/10/2026 Payment Received: Naledi 2 500.00 12 500.00", "04/10/2026 Card Purchase -100.00 12 400.00"]);
    const lines = await pdfTextLines(pdf);
    expect(lines).toEqual(["Capitec Bank", "03/10/2026 Payment Received: Naledi 2 500.00 12 500.00", "04/10/2026 Card Purchase -100.00 12 400.00"]);
    expect(parsePdfStatement(lines).lines).toHaveLength(2);
  });

  it("a PDF with no text (a scan or photo) is refused with a clear message", async () => {
    await expect(pdfTextLines(makePdf([]))).rejects.toThrow(/scanned/);
  });
});

describe("importing a PDF statement (upload → lines to sort)", () => {
  const { app } = testApp();
  it("reads the PDF and puts its lines in the sorting list", async () => {
    const f = await newFounder(app, "pdfstatement");
    const [d1, d2] = [addDays(todayZA(), -2), addDays(todayZA(), -1)].map((d) => d.split("-").reverse().join("/"));
    const pdf = makePdf(["Capitec Bank", "Opening balance 1 000.00", `${d1} Payment Received: Lerato 450.00 1 450.00`, `${d2} Card Purchase: Spar -120.50 1 329.50`]);
    const up = await request(app).post("/api/v1/founder/uploads").set("Authorization", f.token).send({ purpose: "statement", name: "statement.pdf", contentType: "application/pdf", size: pdf.length });
    await request(app).put(up.body.upload.url).set("Content-Type", "application/pdf").send(pdf);
    expect((await request(app).post(`/api/v1/founder/uploads/${up.body.fileId}/complete`).set("Authorization", f.token).send({})).status).toBe(200);
    const r = await request(app).post("/api/v1/founder/statements").set("Authorization", f.token).send({ fileId: up.body.fileId });
    expect(r.body).toMatchObject({ ok: true, added: 2, bank: "Capitec" });
    const lines = (await request(app).get("/api/v1/founder/books").set("Authorization", f.token)).body.statementLines;
    expect(lines.map((l: { description: string; amount: number; direction: string }) => [l.description, l.amount, l.direction]))
      .toEqual(expect.arrayContaining([["Payment Received: Lerato", 450, "in"], ["Card Purchase: Spar", 120.5, "out"]]));
  });
});
