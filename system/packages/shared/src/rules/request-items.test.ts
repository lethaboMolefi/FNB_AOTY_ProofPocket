import { describe, expect, it } from "vitest";
import { requestItemsTotal, requestItemsShortfall } from "./request-items";

describe("payment request from stock", () => {
  it("adds up price × quantity per line, to the cent", () => {
    expect(requestItemsTotal([{ price: 45.5, qty: 2 }, { price: 12.99, qty: 3 }])).toBe(129.97);
    expect(requestItemsTotal([{ price: 0.1, qty: 3 }])).toBe(0.3);
    expect(requestItemsTotal([])).toBe(0);
  });
  it("names the lines asking for more than is in stock (a warning, not a block)", () => {
    expect(requestItemsShortfall([{ name: "Gel polish", qty: 5, inStock: 3 }, { name: "Lashes", qty: 1, inStock: 4 }])).toEqual(["Gel polish (3 in stock)"]);
  });
});
