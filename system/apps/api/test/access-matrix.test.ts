// Calls every endpoint as every role and checks access control against access-matrix.ts.
// Allowed  = the request gets past access control (anything but 401/403, "already joined", 429 or a server error).
// Denied   = 401, or 403 with an access-control code (forbidden, no_account, otp_required), or 409 already_joined on the
//            two Join endpoints that people with an account can't use.
// Token-only endpoints (payment links, signed storage links, the PayFast webhook) must answer every role the same way.
import { writeFileSync } from "node:fs";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MATRIX, ROLES, type Endpoint, type MatrixRole } from "./access-matrix";
import { ADMIN, ADVISER_N1, FUNDER_F1, newFounder, signIn, staffToken, testApp } from "./helpers";

// Read when the app is built: ~900 requests from one address would otherwise hit the general rate limit.
process.env.TEST_RATE_LIMIT = "100000";
const { app } = testApp();
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
afterAll(() => owner.end());

const ZERO = "00000000-0000-0000-0000-000000000000";
const fill = (path: string) => path.replace(":type", "user").replace(":id", ZERO).replace(":ref", "PP-0000").replace(":slug", "no-such-business").replace(":token", "not-a-real-link");

const tokens = {} as Record<MatrixRole, string | null>;
const results: { id: string; method: string; path: string; role: MatrixRole; expected: "allowed" | "denied" | "same"; status: number; code: string | null; pass: boolean }[] = [];

beforeAll(async () => {
  tokens.public = null;
  tokens.joining = signIn(`matrix.joining.${Date.now()}@proofpocket.example`);
  tokens.founder = (await newFounder(app, "matrix")).token;
  tokens.funder = await staffToken(app, FUNDER_F1);
  tokens.adviser = await staffToken(app, ADVISER_N1);
  tokens.admin = await staffToken(app, ADMIN);
  // A buyer account: the seed has buyer organisations but no buyer people (they're invited by the admin).
  const buyerEmail = `matrix.buyer.${Date.now()}@proofpocket.example`;
  const org = (await owner.query<{ id: string }>("select id from organisations where type = 'buyer' limit 1")).rows[0]!;
  await owner.query("insert into users (email, display_name, role, org_id) values ($1, 'Matrix Buyer', 'buyer', $2)", [buyerEmail, org.id]);
  tokens.buyer = signIn(buyerEmail);
}, 120_000);

afterAll(() => {
  // Evidence for docs/FEATURE-STATUS-REPORT.md.
  writeFileSync(new URL("../.access-matrix-results.json", import.meta.url), JSON.stringify(results, null, 1));
});

async function call(e: Endpoint, role: MatrixRole) {
  const r = request(app)[e.method.toLowerCase() as "get"](`/api/v1${fill(e.path)}`);
  if (tokens[role]) r.set("Authorization", tokens[role]!);
  if (e.path.startsWith("/pay/")) r.set("X-Pay-Token", "not-the-real-token");
  if (e.method !== "GET") r.send(e.body ?? {});
  const res = await r;
  return { status: res.status, code: (res.body?.error?.code as string | undefined) ?? null };
}

/** Refusals made by access control (not business rules such as "Verified only", which are tested per feature). */
const ACCESS_CODES = ["unauthenticated", "invalid_token", "forbidden", "no_account", "otp_required"];
const denied = (e: Endpoint, s: number, code: string | null) =>
  s === 401 || (s === 403 && ACCESS_CODES.includes(code ?? "")) || (s === 409 && code === "already_joined" && !!e.accountsRefused);

describe("every endpoint, every role", () => {
  for (const e of MATRIX) {
    it(`${e.id} ${e.method} ${e.path}`, async () => {
      const seen: Record<string, number> = {};
      for (const role of ROLES) {
        const { status, code } = await call(e, role);
        seen[role] = status;
        if (e.token) {
          results.push({ id: e.id, method: e.method, path: e.path, role, expected: "same", status, code, pass: status < 500 && status !== 429 });
          expect(status, `${e.id} as ${role}`).toBeLessThan(500);
          continue;
        }
        const expected = e.allow.includes(role) ? "allowed" : "denied";
        const ok = expected === "denied" ? denied(e, status, code) : !denied(e, status, code) && status < 500 && status !== 429;
        results.push({ id: e.id, method: e.method, path: e.path, role, expected, status, code, pass: ok });
        expect(ok, `${e.id} ${e.method} ${e.path} as ${role}: expected ${expected}, got ${status} ${code ?? ""}`).toBe(true);
      }
      if (e.token) expect(new Set(Object.values(seen)).size, `${e.id}: every role gets the same answer (${JSON.stringify(seen)})`).toBe(1);
    });
  }
});

describe("the matrix lists every endpoint the API serves", () => {
  it("no endpoint is missing from the matrix, and none listed is missing from the app", () => {
    const served: string[] = [];
    const walk = (stack: { route?: { path: string; methods: Record<string, boolean> }; handle?: { stack?: unknown[] } }[]) => {
      for (const l of stack) {
        if (l.route) for (const m of Object.keys(l.route.methods)) served.push(`${m.toUpperCase()} ${l.route.path}`);
        else if (l.handle?.stack) walk(l.handle.stack as never);
      }
    };
    walk((app as unknown as { router: { stack: never[] } }).router.stack);
    const listed = MATRIX.map((e) => `${e.method} ${e.path}`);
    expect(served.filter((s) => !listed.includes(s)), "served but not in the matrix").toEqual([]);
    expect(listed.filter((s) => !served.includes(s)), "in the matrix but not served").toEqual([]);
    expect(new Set(MATRIX.map((e) => e.id)).size, "feature IDs are unique").toBe(MATRIX.length);
  });
});
