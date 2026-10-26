import { describe, expect, it } from "vitest";
import { CACHEABLE_API } from "../lib/cache-rules";
import { FOUNDER_NAV, founderNavFor } from "./nav";

const paths = (type?: Parameters<typeof founderNavFor>[0]) => founderNavFor(type).flatMap((g) => g.pages.map((p) => p.path));

describe("founder navigation", () => {
  it("uses the dashboard redesign's groups, in order", () => {
    expect(FOUNDER_NAV.map((g) => g.group)).toEqual(["", "Daily operations", "Documents", "Funding & markets", "Safety", "Account"]);
    expect(FOUNDER_NAV.flatMap((g) => g.pages.map((p) => p.path))).toEqual(["home", "books", "stock", "payments", "cashflow", "start", "markets", "funding", "procurement", "protection", "privacy", "settings", "uml", "admin-log"]);
  });
  it("hides Stock for services businesses only", () => {
    expect(paths("services")).not.toContain("stock");
    expect(paths("beauty")).toContain("stock");
  });
});

describe("service worker cache rule", () => {
  it("caches the founder's own reads", () => {
    for (const p of ["/api/v1/me", "/api/v1/founder/home", "/api/v1/founder/books/entries"]) expect(CACHEABLE_API.test(p)).toBe(true);
  });
  it("never caches documents, proofs, payment pages or other portals", () => {
    for (const p of ["/api/v1/founder/documents/abc", "/api/v1/founder/files/x/download", "/api/v1/founder/proofs/1", "/api/v1/pay/PP-4821-abc", "/api/v1/funder/pipeline", "/api/v1/adviser/cohort", "/api/v1/public/directory"])
      expect(CACHEABLE_API.test(p)).toBe(false);
  });
});
