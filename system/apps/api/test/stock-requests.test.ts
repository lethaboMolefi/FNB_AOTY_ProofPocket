import request from "supertest";
import { describe, expect, it } from "vitest";
import { FOUNDER_2, newFounder, signIn, testApp } from "./helpers";

const { app } = testApp();
const post = (tok: string, path: string, body: object) => request(app).post(`/api/v1${path}`).set("Authorization", tok).send(body);
const get = (tok: string, path: string) => request(app).get(`/api/v1${path}`).set("Authorization", tok);
const stockQty = async (tok: string, id: string) => (await get(tok, "/founder/stock")).body.items.find((i: { id: string }) => i.id === id);

describe("asking a client to pay for stock", () => {
  it("prices the request from the selling prices, shows the lines, and takes the stock off once paid", async () => {
    const f = await newFounder(app, "stockreq");
    const add = async (name: string, qty: number, price: number) => {
      await post(f.token, "/founder/stock", { name, unit: "units", qty, reorderAt: 1, cost: Math.round(price * 50) / 100, price });
      return (await get(f.token, "/founder/stock")).body.items.find((i: { name: string }) => i.name === name);
    };
    const polish = await add("Gel polish", 10, 45.5);
    const files = await add("Nail files", 2, 12.99);
    expect(polish.price).toBe(45.5);

    const r = await post(f.token, "/founder/payment-requests", { client: "Thandi", rails: ["cash"], items: [{ stockItemId: polish.id, qty: 2 }, { stockItemId: files.id, qty: 3 }] });
    expect(r.status).toBe(200);
    expect(r.body.amount).toBe(129.97);
    // Asking for more than is in stock is allowed, with a note.
    expect(r.body.message).toMatch(/you don't have enough Nail files \(2 in stock\)/);
    const list = (await get(f.token, "/founder/payments")).body.requests;
    const req = list.find((x: { ref: string }) => x.ref === r.body.ref);
    expect(req.items).toEqual([{ name: "Gel polish", qty: 2, unitPrice: 45.5 }, { name: "Nail files", qty: 3, unitPrice: 12.99 }]);
    expect(req.what).toBe("2 × Gel polish, 3 × Nail files");
    expect(req.proofs).toEqual([]);

    // Nothing moves until the money is in.
    expect((await stockQty(f.token, polish.id)).qty).toBe(10);
    expect((await post(f.token, `/founder/payment-requests/${req.id}/cash`, {})).status).toBe(200);
    expect((await stockQty(f.token, polish.id)).qty).toBe(8);
    expect((await stockQty(f.token, files.id)).qty).toBe(0);
  });

  it("the total can be changed (a discount); items need a selling price and must be your own", async () => {
    const f = await newFounder(app, "stockreq2");
    await post(f.token, "/founder/stock", { name: "Braids", unit: "packs", qty: 5, reorderAt: 1, cost: 20, price: 60 });
    await post(f.token, "/founder/stock", { name: "No price", unit: "units", qty: 5, reorderAt: 1, cost: 20 });
    const items = (await get(f.token, "/founder/stock")).body.items;
    const braids = items.find((i: { name: string }) => i.name === "Braids"), noPrice = items.find((i: { name: string }) => i.name === "No price");
    expect((await post(f.token, "/founder/payment-requests", { client: "Ayanda", amount: 100, rails: ["cash"], items: [{ stockItemId: braids.id, qty: 2 }] })).body.amount).toBe(100);
    expect((await post(f.token, "/founder/payment-requests", { client: "Ayanda", rails: ["cash"], items: [{ stockItemId: noPrice.id, qty: 1 }] })).body.error.message).toBe("Add a selling price for No price under Stock first.");
    // Someone else's stock item is not found.
    expect((await post(signIn(FOUNDER_2), "/founder/payment-requests", { client: "X", rails: ["cash"], items: [{ stockItemId: braids.id, qty: 1 }] })).status).toBe(404);
    // Without items, an amount is still needed.
    expect((await post(f.token, "/founder/payment-requests", { client: "X", rails: ["cash"] })).status).toBe(400);
  });
});
