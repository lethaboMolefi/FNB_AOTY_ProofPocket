// Features that had no API test of their own (found by the phase B coverage check). Each test makes its own data,
// so it doesn't depend on, or change, the seeded rows other test files use.
import { todayZA } from "@proofpocket/shared";
import pg from "pg";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { ADMIN, ADVISER_N1, FUNDER_F1, newFounder, staffToken, testApp } from "./helpers";

// This file signs up and verifies several founders; keep the general rate limit out of the way.
process.env.TEST_RATE_LIMIT = "100000";
const { app, mailer } = testApp();
const owner = new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });
afterAll(() => owner.end());
const api = (t: string | null, method: "get" | "post" | "put" | "patch" | "delete", p: string, b?: object) => {
  const r = request(app)[method](`/api/v1${p}`);
  if (t) r.set("Authorization", t);
  return b === undefined && method === "get" ? r : r.send(b ?? {});
};
const get = (t: string, p: string) => api(t, "get", p);
const post = (t: string, p: string, b: object = {}) => api(t, "post", p, b);
const nextYear = () => todayZA().replace(/^(\d{4})/, (y) => String(Number(y) + 1));

/** A new registered founder taken through the real flow: four documents uploaded, then approved by the right checker. */
async function verifiedFounder(label: string, incubator?: string) {
  const email = `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@proofpocket.example`;
  const token = `Bearer ${(await api(null, "post", "/auth/local/sign-up", { email, password: "a long and lovely passphrase" })).body.token}`;
  const opts = (await api(null, "get", "/join/options")).body.incubators as { id: string; name: string }[];
  const name = `Verified ${label} ${Math.random().toString(36).slice(2, 6)}`;
  const joined = await post(token, "/join", {
    founderName: "Test Founder", idNumber: "8001015009087", phone: "0821234567", businessName: name, businessType: "food", sector: "Catering",
    town: "Soweto", province: "Gauteng", area: "township", incubatorId: incubator ? opts.find((o) => o.name === incubator)!.id : null,
    registered: true, legalName: `${name} (Pty) Ltd`, cipcNumber: `2025/${String(Date.now()).slice(-6)}/07`,
  });
  if (joined.status !== 200) throw new Error(JSON.stringify(joined.body));
  for (const docType of ["cipc", "id", "bank", "addr"]) {
    const pdf = Buffer.from(`%PDF-1.4\n% ${email} ${docType}\ntrailer<<>>\n%%EOF\n`);
    const up = await post(token, "/founder/uploads", { purpose: "document", name: `${docType}.pdf`, contentType: "application/pdf", size: pdf.length });
    await request(app).put(up.body.upload.url).set("Content-Type", "application/pdf").send(pdf);
    await post(token, `/founder/uploads/${up.body.fileId}/complete`);
    await post(token, "/founder/documents", { docType, fileId: up.body.fileId });
  }
  expect((await post(token, "/join/complete", { agree: true })).status).toBe(200);
  const scope = incubator ? "adviser" : "admin";
  const checker = await staffToken(app, incubator ? ADVISER_N1 : ADMIN);
  const company = `${name} (Pty) Ltd`;
  for (const item of ((await get(checker, `/${scope}/checks`)).body.queue as { id: string; companyName: string }[]).filter((q) => q.companyName === company)) {
    expect((await post(checker, `/${scope}/checks/${item.id}/approve`, { expiresOn: null })).status).toBe(200);
  }
  expect((await get(token, "/me")).body.company.verified).toBe(true);
  return { token, email };
}
const companyId = async (email: string) => (await owner.query<{ id: string }>("select c.id from companies c join users u on u.id = c.owner_id where u.email = $1", [email])).rows[0]!.id;

describe("join options (JOIN-01)", () => {
  it("lists only verified incubators, by name, to anyone", async () => {
    const r = await api(null, "get", "/join/options");
    expect(r.status).toBe(200);
    const names: string[] = r.body.incubators.map((i: { name: string }) => i.name);
    const db = (await owner.query<{ name: string }>("select name from organisations where type = 'incubator' and verified order by name")).rows.map((x) => x.name);
    expect(names).toEqual(db);
    expect(names).toContain("Ikhaya Incubation Hub");
  });
});

describe("CIPC number (DOC-05)", () => {
  it("saves a valid number, refuses a wrong format, and records it", async () => {
    const f = await newFounder(app, "cipc");
    expect((await api(f.token, "put", "/founder/cipc", { cipcNumber: "2025-48" })).status).toBe(400);
    const ok = await api(f.token, "put", "/founder/cipc", { cipcNumber: "2025/123456/07" });
    expect(ok.body.message).toBe("CIPC number saved. Upload the certificate next.");
    expect((await get(f.token, "/founder/documents")).body.company.cipcNumber).toBe("2025/123456/07");
    const act = await owner.query("select 1 from activity where company_id = $1 and text like 'CIPC number 2025/123456/07%'", [await companyId(f.email)]);
    expect(act.rowCount).toBe(1);
  });
});

describe("adviser sends a document back (CHK-03)", () => {
  it("needs a reason, reaches the founder by message and email, and other incubators can't touch it", async () => {
    const f = await newFounder(app, "sendback", "Ikhaya Incubation Hub");
    const mokoena = await staffToken(app, ADVISER_N1);
    const queue = (await get(mokoena, "/adviser/checks")).body.queue as { id: string; companyName: string; docType: string }[];
    const name = (await get(f.token, "/founder/documents")).body.company.name;
    const item = queue.find((q) => q.companyName === name && q.docType === "addr")!;
    expect(item).toBeTruthy();
    expect((await post(mokoena, `/adviser/checks/${item.id}/reject`, { reason: "" })).status).toBe(400);
    const pillay = await staffToken(app, "s.pillay@proofpocket.example");
    expect((await post(pillay, `/adviser/checks/${item.id}/reject`, { reason: "Not ours to check" })).status).toBeGreaterThanOrEqual(403);
    const before = mailer.sent.length;
    const r = await post(mokoena, `/adviser/checks/${item.id}/reject`, { reason: "The bill is older than three months." });
    expect(r.status).toBe(200);
    const doc = (await get(f.token, "/founder/documents")).body.documents.find((d: { docType: string }) => d.docType === "addr");
    // A sent-back document counts as missing again, with the reason shown to the founder.
    expect(doc.state).toBe("missing");
    expect(doc.sentBackReason).toBe("The bill is older than three months.");
    expect(mailer.sent.slice(before).some((m) => m.to === f.email && /upload your/i.test(m.subject))).toBe(true);
  });
});

describe("stock: edit and remove (STK-03, STK-04)", () => {
  it("edits an item, refuses bad values, and removes it from the list", async () => {
    const f = await newFounder(app, "stock");
    expect((await post(f.token, "/founder/stock", { name: "Rice 10 kg", unit: "bags", qty: 4, reorderAt: 2, cost: 120 })).status).toBe(200);
    const item = (await get(f.token, "/founder/stock")).body.items.find((i: { name: string }) => i.name === "Rice 10 kg");
    expect((await api(f.token, "patch", `/founder/stock/${item.id}`, { name: "x".repeat(81) })).status).toBe(400);
    expect((await api(f.token, "patch", `/founder/stock/${item.id}`, { cost: -1 })).status).toBe(400);
    expect((await api(f.token, "patch", `/founder/stock/${item.id}`, { name: "Rice 10 kg (white)", cost: 135.5 })).body.message).toBe("Item updated");
    const edited = (await get(f.token, "/founder/stock")).body.items.find((i: { id: string }) => i.id === item.id);
    expect(edited.name).toBe("Rice 10 kg (white)");
    expect(Number(edited.cost)).toBe(135.5);
    expect(Number(edited.qty)).toBe(4);
    expect((await api(f.token, "patch", `/founder/stock/${item.id}`, {})).status, "an edit with nothing to change").toBeLessThan(500);
    expect((await api(f.token, "delete", `/founder/stock/${item.id}`)).body.message).toBe("Item removed");
    expect((await get(f.token, "/founder/stock")).body.items.some((i: { id: string }) => i.id === item.id)).toBe(false);
    // Nothing to change, an unknown item, an item already removed, or another founder's item: refused, not a false "updated".
    expect((await api(f.token, "patch", "/founder/stock/00000000-0000-0000-0000-000000000000", { name: "Ghost" })).status).toBe(404);
    expect((await api(f.token, "patch", `/founder/stock/${item.id}`, { name: "After removal" })).status).toBe(404);
    expect((await api(f.token, "delete", `/founder/stock/${item.id}`)).status).toBe(404);
    const other = await newFounder(app, "stock2");
    expect((await api(other.token, "patch", `/founder/stock/${item.id}`, { name: "Taken" })).status).toBe(404);
    expect((await api(other.token, "delete", `/founder/stock/${item.id}`)).status).toBe(404);
    const row = (await owner.query<{ name: string }>("select name from stock_items where id = $1", [item.id])).rows[0]!;
    expect(row.name).toBe("Rice 10 kg (white)");
  });
});

describe("supplier bank change: confirm (PAY-09, PAY-10)", () => {
  it("holds payments until the founder confirms by phone", async () => {
    const f = await newFounder(app, "supplier");
    expect((await post(f.token, "/founder/suppliers", { name: "Kasi Wholesale", bank: "FNB", accountNumber: "62810045" })).status).toBe(200);
    let s = (await get(f.token, "/founder/payments")).body.suppliers.find((x: { name: string }) => x.name === "Kasi Wholesale");
    expect((await post(f.token, `/founder/suppliers/${s.id}/confirm`)).body.error.code).toBe("no_change");
    expect((await api(f.token, "put", `/founder/suppliers/${s.id}/bank`, { bank: "Capitec", accountNumber: "1234" })).body.message).toBe("Change received. Payments to this supplier are on hold.");
    s = (await get(f.token, "/founder/payments")).body.suppliers.find((x: { id: string }) => x.id === s.id);
    expect(s.pending).toBeTruthy();
    const pay = { clientUuid: crypto.randomUUID(), supplierId: s.id, amount: 300, what: "Stock", date: todayZA() };
    expect((await post(f.token, "/founder/supplier-payments", pay)).status).toBe(409);
    expect((await post(f.token, `/founder/suppliers/${s.id}/confirm`)).body.message).toBe("New details confirmed");
    s = (await get(f.token, "/founder/payments")).body.suppliers.find((x: { id: string }) => x.id === s.id);
    expect(s.pending).toBeNull();
    expect(s.bank).toMatch(/Capitec/);
    expect((await post(f.token, "/founder/supplier-payments", { ...pay, clientUuid: crypto.randomUUID() })).status).toBe(200);
  });
});

describe("payment page: report, PayFast webhook (PP-05, PP-07)", () => {
  it("a client's report reaches the admin's reports", async () => {
    const f = await newFounder(app, "payreport");
    const made = await post(f.token, "/founder/payment-requests", { client: "Sizwe", amount: 90, what: "Haircut", rails: ["cash"] });
    const [, ref, token] = /\/pay\/(PP-\d+)-(.+)$/.exec(made.body.link)!;
    const r = await request(app).post(`/api/v1/pay/${ref}/report`).set("X-Pay-Token", token!).send({ reason: "Never heard of this business" });
    expect(r.body.message).toMatch(/review this business within two working days/);
    const reports = (await get(await staffToken(app, ADMIN), "/admin/reports")).body.reports as { target: string; reason: string }[];
    expect(reports.some((x) => x.target === "payment_request" && x.reason === "Never heard of this business")).toBe(true);
    expect((await request(app).post(`/api/v1/pay/${ref}/report`).set("X-Pay-Token", "wrong").send({})).status).toBe(404);
  });

  it("the PayFast webhook answers 200 and changes nothing while PayFast is off", async () => {
    const before = (await owner.query<{ n: number }>("select count(*)::int as n from payment_requests where status = 'paid'")).rows[0]!.n;
    const r = await request(app).post("/api/v1/payfast/itn").type("form").send({ m_payment_id: crypto.randomUUID(), payment_status: "COMPLETE", amount_gross: "100.00", signature: "x" });
    expect(r.status).toBe(200);
    expect(r.text).toBe("OK");
    expect((await owner.query<{ n: number }>("select count(*)::int as n from payment_requests where status = 'paid'")).rows[0]!.n).toBe(before);
  });
});

describe("profile and post shares (MKT-02, MKT-04)", () => {
  it("saves the profile (shown publicly) and validates it", async () => {
    const f = await newFounder(app, "profile");
    expect((await api(f.token, "put", "/founder/profile", { tagline: "x".repeat(91) })).status).toBe(400);
    expect((await api(f.token, "put", "/founder/profile", { whatsapp: "call me" })).status).toBe(400);
    const ok = await api(f.token, "put", "/founder/profile", { tagline: "Fresh vetkoek daily", services: "Vetkoek R10", whatsapp: "082 123 4567", instagram: "@vetkoek", hours: "Mon–Sat 6–14" });
    expect(ok.body.message).toBe("Profile saved");
    const m = (await get(f.token, "/founder/markets")).body;
    expect(m.profile.tagline).toBe("Fresh vetkoek daily");
    const slug = m.url.split("/").pop();
    expect((await api(null, "get", `/public/b/${slug}`)).body.tagline).toBe("Fresh vetkoek daily");
  });

  it("records where a post was shared, only for known networks and own posts", async () => {
    const f = await newFounder(app, "shares");
    await post(f.token, "/founder/posts", { text: "Open on Sunday" });
    const p = (await get(f.token, "/founder/markets")).body.posts.find((x: { text: string }) => x.text === "Open on Sunday");
    expect((await post(f.token, `/founder/posts/${p.id}/shared`, { net: "TikTok" })).status).toBe(400);
    expect((await post(f.token, `/founder/posts/${p.id}/shared`, { net: "WhatsApp" })).status).toBe(200);
    expect((await get(f.token, "/founder/markets")).body.posts.find((x: { id: string }) => x.id === p.id).shared).toContain("WhatsApp");
    const other = await newFounder(app, "shares2");
    expect((await post(other.token, `/founder/posts/${p.id}/shared`, { net: "X" })).status).toBe(404);
  });
});

describe("funder programme controls, invite, status; founder withdraws (FUN-05, FUN-06, FUN-08, FUN-12, FUND-04)", () => {
  it("runs a whole programme from set-up to withdrawal", async () => {
    const lesedi = await staffToken(app, FUNDER_F1);
    const name = `Test Fund ${Date.now() % 100000}`;
    await post(lesedi, "/funder/programmes", { name, kind: "Grant", minAmount: 1000, maxAmount: 5000, budget: 50000, minMonths: 0, minScore: 0, requiredDocs: [] });
    const prog = (await get(lesedi, "/funder/programmes")).body.programmes.find((p: { name: string }) => p.name === name);
    try {
      // Requirements toggle on and off.
      expect((await post(lesedi, `/funder/programmes/${prog.id}/requirements`, { docType: "tax" })).body.message).toMatch(/founders see the change/);
      expect((await get(lesedi, "/funder/programmes")).body.programmes.find((p: { id: string }) => p.id === prog.id).requiredDocs).toContain("tax");
      await post(lesedi, `/funder/programmes/${prog.id}/requirements`, { docType: "tax" });
      expect((await post(lesedi, `/funder/programmes/${prog.id}/requirements`, { docType: "passport" })).status).toBe(400);

      // Invite: a Starter isn't visible to funders; a Verified company sharing a summary is.
      const starter = await newFounder(app, "invite-starter");
      expect((await post(lesedi, `/funder/companies/${await companyId(starter.email)}/invite`, { programmeId: prog.id })).status).toBe(404);
      const f = await verifiedFounder("invite");
      expect((await post(lesedi, `/funder/companies/${await companyId(f.email)}/invite`, { programmeId: prog.id })).body.message).toBe("Invite sent");
      const msgs = await owner.query("select 1 from messages where company_id = $1 and body like $2", [await companyId(f.email), `%${name}%`]);
      expect(msgs.rowCount).toBeGreaterThanOrEqual(1);

      // Closed programmes take no applications; reopened ones do.
      expect((await post(lesedi, `/funder/programmes/${prog.id}/status`, { status: "closed" })).body.message).toBe("Programme closed to new applications");
      expect((await post(f.token, "/founder/applications", { programmeId: prog.id, amount: 3000 })).status).toBeGreaterThanOrEqual(400);
      expect((await post(lesedi, `/funder/programmes/${prog.id}/status`, { status: "open" })).body.message).toBe("Programme open again");
      expect((await post(f.token, "/founder/applications", { programmeId: prog.id, amount: 9000 })).status).toBe(400);
      expect((await post(f.token, "/founder/applications", { programmeId: prog.id, amount: 3000 })).status).toBe(200);

      // Funder status changes.
      const app1 = (await get(lesedi, "/funder/applications")).body.applications.find((a: { programme: string }) => a.programme === name);
      expect((await post(lesedi, `/funder/applications/${app1.id}/status`, { status: "under_review" })).body.message).toBe("Status updated");
      expect((await post(lesedi, `/funder/applications/${app1.id}/status`, { status: "awaiting_cofunding", reason: "" })).body.error.code).toBe("reason_needed");
      expect((await post(lesedi, `/funder/applications/${app1.id}/status`, { status: "awaiting_cofunding", reason: "Find R1 000 from another funder" })).status).toBe(200);
      const mine = (await get(f.token, "/founder/funding")).body.applications.find((a: { programme: string }) => a.programme === name);
      expect(mine.status).toBe("awaiting_cofunding");

      // The founder withdraws; a decided application can't be withdrawn again.
      expect((await post(f.token, `/founder/applications/${mine.id}/withdraw`)).body.message).toBe("Application withdrawn");
      expect((await post(f.token, `/founder/applications/${mine.id}/withdraw`)).body.error.code).toBe("decided");
      const audit = await owner.query("select 1 from audit_log where action = 'application.withdrawn' and entity_id = $1", [mine.id]);
      expect(audit.rowCount).toBe(1);
    } finally {
      await post(lesedi, `/funder/programmes/${prog.id}/status`, { status: "closed" });
    }
  });
});

describe("introductions and tender interest: adviser and admin (ADV-10, ADM-13 to ADM-16)", () => {
  it("adviser arranges tender interest from their own cohort only; admin handles companies without an incubator", async () => {
    const admin = await staffToken(app, ADMIN);
    const title = `Test tender ${Date.now() % 100000}`;
    expect((await post(admin, "/admin/tenders", { title, buyerName: "Test buyer", value: 5000, closesOn: nextYear(), minMonths: 0, sectors: ["Catering"], requiredDocs: [] })).body.message).toBe("Tender published");
    const ikhaya = await verifiedFounder("tender-adv", "Ikhaya Incubation Hub");
    const solo = await verifiedFounder("tender-solo");
    for (const f of [ikhaya, solo]) {
      const t = (await get(f.token, "/founder/procurement")).body.tenders.find((x: { title: string }) => x.title === title);
      expect(t.action.kind).toBe("can_express");
      expect((await post(f.token, `/founder/tenders/${t.id}/interest`)).status).toBe(200);
    }
    const mokoena = await staffToken(app, ADVISER_N1);
    const ikhayaName = (await get(ikhaya.token, "/founder/documents")).body.company.name;
    const ti = (await get(mokoena, "/adviser/support")).body.tenderInterests.find((t: { company: string }) => t.company === ikhayaName);
    expect((await post(mokoena, `/adviser/tenders/${ti.id}`, { status: "maybe" })).status).toBe(400);
    const pillay = await staffToken(app, "s.pillay@proofpocket.example");
    expect((await post(pillay, `/adviser/tenders/${ti.id}`, { status: "arranged" })).status).toBe(404);
    expect((await post(mokoena, `/adviser/tenders/${ti.id}`, { status: "arranged" })).body.message).toBe("Marked as arranged");

    // The company without an incubator goes to the admin, with an introduction too.
    const buyer = (await get(solo.token, "/founder/markets")).body.buyers[0];
    expect((await post(solo.token, `/founder/intros/${buyer.id}`)).status).toBe(200);
    const soloName = (await get(solo.token, "/founder/documents")).body.company.name;
    const reqs = (await get(admin, "/admin/tenders")).body.requests as { kind: string; id: string; company: string }[];
    const intro = reqs.find((r) => r.kind === "intro" && r.company === soloName)!;
    const tender = reqs.find((r) => r.kind === "tender" && r.company === soloName)!;
    expect(reqs.some((r) => r.company === ikhayaName)).toBe(false);
    expect((await post(admin, `/admin/intros/${intro.id}`, { status: "declined", note: "Buyer not taking suppliers" })).body.message).toBe("Marked as declined");
    expect((await post(admin, `/admin/tenders/${tender.id}`, { status: "arranged" })).body.message).toBe("Marked as arranged");
    expect((await get(solo.token, "/founder/procurement")).body.tenders.find((x: { title: string }) => x.title === title).interest).toBe("arranged");
  });
});

describe("flagged payments and the sender watch list (ADM-11, ADM-12)", () => {
  it("a sender blocked by a founder reaches the admin, who confirms the scam", async () => {
    const f = await newFounder(app, "watch");
    const sender = `+27 71 ${Date.now() % 1000000}`;
    await post(f.token, "/founder/check-message", { sender, text: "Pay a R500 release fee to receive your grant" });
    const msg = (await get(f.token, "/founder/protection")).body.messages.find((m: { address: string }) => m.address === sender);
    expect((await post(f.token, `/founder/messages/${msg.id}`, { action: "block" })).status).toBe(200);
    const admin = await staffToken(app, ADMIN);
    const flagged = (await get(admin, "/admin/flagged")).body;
    expect(Array.isArray(flagged.payments)).toBe(true);
    const w = flagged.watchlist.find((x: { sender: string }) => x.sender.replace(/\s/g, "").endsWith(sender.replace(/\s/g, "").slice(-6)));
    expect(w).toBeTruthy();
    expect((await post(admin, `/admin/watchlist/${w.id}`, { status: "maybe" })).status).toBe(400);
    expect((await post(admin, `/admin/watchlist/${w.id}`, { status: "confirmed_scam" })).body.message).toBe("Confirmed as a scam. Founders are warned.");
    expect((await get(admin, "/admin/flagged")).body.watchlist.find((x: { id: string }) => x.id === w.id).status).toBe("confirmed_scam");
  });
});
