import { todayZA } from "@proofpocket/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { newFounder, signIn, staffToken, testApp } from "./helpers";

const { app, mailer } = testApp();
const get = (t: string, p: string) => request(app).get(`/api/v1${p}`).set("Authorization", t);
const post = (t: string, p: string, b: object = {}) => request(app).post(`/api/v1${p}`).set("Authorization", t).send(b);
const MABELE = signIn("tumelo@proofpocket.example");
const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe("funder pipeline: consent and Verified only", () => {
  it("never shows Starter companies or companies sharing nothing", async () => {
    const lesedi = await staffToken(app, "lesedi@proofpocket.example");
    const p = (await get(lesedi, "/funder/pipeline")).body;
    expect(names(p.rows)).not.toContain("Nala Nails & Lashes");
    expect(names(p.rows)).toContain("Mabele AgriLink");
    expect(p.tiles.hidden).toBeGreaterThanOrEqual(1);
    for (const r of p.rows) expect(r.sharing).not.toBe("none");

    await request(app).put("/api/v1/founder/privacy").set("Authorization", MABELE).send({ sharing: "none" });
    try {
      expect(names((await get(lesedi, "/funder/pipeline")).body.rows)).not.toContain("Mabele AgriLink");
    } finally {
      await request(app).put("/api/v1/founder/privacy").set("Authorization", MABELE).send({ sharing: "full" });
    }
  });

  it("the drawer shows book entries only with full sharing", async () => {
    const lesedi = await staffToken(app, "lesedi@proofpocket.example");
    const rows = (await get(lesedi, "/funder/pipeline")).body.rows as { id: string; name: string }[];
    const full = (await get(lesedi, `/funder/companies/${rows.find((r) => r.name === "ReKasi Plastics")!.id}`)).body;
    expect(full.entries.length).toBeGreaterThan(0);
    expect(full.applications[0].offers.map((o: { amount: number }) => o.amount)).toEqual([50000, 40000, 28000]);
    const summary = (await get(lesedi, `/funder/companies/${rows.find((r) => r.name === "Mama Tau Catering")!.id}`)).body;
    expect(summary.entries).toBeNull();
    expect(summary.readiness.score).toBeTypeOf("number");
  });
});

describe("applications, offers and the audit trail", () => {
  it("apply → offer change needs a reason → ask why → approve commits the budget", async () => {
    const funding = (await get(MABELE, "/founder/funding")).body;
    const micro = funding.programmes.find((p: { name: string }) => p.name === "Youth Micro Grant");
    expect(micro.gaps).toEqual([]);
    expect((await post(MABELE, "/founder/applications", { programmeId: micro.id, amount: 60000 })).body.error.message).toBe("Enter an amount between R10\u00a0000 and R50\u00a0000");
    expect((await post(MABELE, "/founder/applications", { programmeId: micro.id, amount: 30000 })).body.message).toBe("Application sent to Lesedi Youth Fund");
    expect((await post(MABELE, "/founder/applications", { programmeId: micro.id, amount: 30000 })).body.error.code).toBe("already_applied");

    const lesedi = await staffToken(app, "lesedi@proofpocket.example");
    const app1 = (await get(lesedi, "/funder/applications")).body.applications.find((a: { company: string; programme: string }) => a.company === "Mabele AgriLink" && a.programme === "Youth Micro Grant");
    expect((await post(lesedi, `/funder/applications/${app1.id}/offer`, { amount: 25000, reason: "" })).body.error.message).toBe("reason: Add a reason. Founders see every change to their offer.");
    expect((await post(lesedi, `/funder/applications/${app1.id}/offer`, { amount: 25000, reason: "Quarterly budget reduced" })).body.message).toBe("Offer updated and shared with the founder");
    expect((await post(lesedi, `/funder/applications/${app1.id}/decline`, { reason: "" })).status).toBe(400);

    const before = (await get(lesedi, "/funder/programmes")).body.programmes.find((p: { name: string }) => p.name === "Youth Micro Grant");
    expect((await post(lesedi, `/funder/applications/${app1.id}/approve`, {})).body.message).toBe("Application approved");
    const after = (await get(lesedi, "/funder/programmes")).body.programmes.find((p: { name: string }) => p.name === "Youth Micro Grant");
    expect(after.committed - before.committed).toBe(25000);
    expect((await post(lesedi, `/funder/applications/${app1.id}/offer`, { amount: 1, reason: "x" })).body.error.code).toBe("decided");

    const mine = (await get(MABELE, "/founder/funding")).body.applications.find((a: { id: string }) => a.id === app1.id);
    expect(mine).toMatchObject({ status: "approved", currentOffer: 25000, canWithdraw: false });
    expect(mine.offers.map((o: { reason: string }) => o.reason)).toEqual(["Requested amount", "Quarterly budget reduced"]);
  });

  it("the founder can ask why about the R28 000 offer, once", async () => {
    const palesa = signIn("palesa@proofpocket.example");
    const ap = (await get(palesa, "/founder/funding")).body.applications.find((a: { currentOffer: number }) => a.currentOffer === 28000);
    expect(ap.canAskReason).toBe(true);
    expect((await post(palesa, `/founder/applications/${ap.id}/ask-reason`)).body.message).toBe("Request sent to the funder");
    expect((await post(palesa, `/founder/applications/${ap.id}/ask-reason`)).body.error.code).toBe("no_reason_needed");
  });

  it("Starters see every programme's gaps but can't apply", async () => {
    const nala = (await get(signIn("zanele@proofpocket.example"), "/founder/funding")).body;
    expect(nala.programmes.every((p: { gaps: string[] }) => p.gaps[0] === "Verified account")).toBe(true);
  });
});

describe("funder set-up and admin onboarding", () => {
  it("a newly invited funder must set requirements and be verified before the pipeline opens", async () => {
    const admin = await staffToken(app, "admin@proofpocket.example");
    const org = await post(admin, "/admin/organisations", { type: "funder", name: "Test Youth Fund", kind: "Grant" });
    const email = `funder.${Date.now()}@proofpocket.example`;
    expect((await post(admin, "/admin/users", { orgId: org.body.id, email, displayName: "Test Funder" })).body.message).toBe(`Invitation sent to ${email}`);
    const password = /temporary password is (\S+)\./.exec(mailer.sent.at(-1)!.text)![1]!;
    const token = `Bearer ${(await request(app).post("/api/v1/auth/local/sign-in").send({ email, password })).body.token}`;
    // Google Authenticator first (required for funders), then set-up, then verification.
    const { secret } = (await post(token, "/auth/totp/setup")).body;
    const { nextCode } = await import("./helpers");
    await post(token, "/auth/totp/activate", { code: nextCode(secret, 0).code });
    expect((await get(token, "/funder/pipeline")).body.error.code).toBe("setup_needed");
    expect((await post(token, "/funder/programmes", { name: "Starter Grant", kind: "Grant", minAmount: 5000, maxAmount: 30000, budget: 500000, minMonths: 3, minScore: 40, requiredDocs: ["cipc", "bank", "tax"] })).body.message)
      .toBe("Requirements saved. Founders can see them now.");
    expect((await get(token, "/funder/pipeline")).body.error.code).toBe("not_verified");
    await post(admin, `/admin/organisations/${org.body.id}/verified`, { verified: true });
    expect((await get(token, "/funder/pipeline")).body.rows.length).toBeGreaterThan(0);
  });
});

describe("incubator portal", () => {
  it("cohort, stages, advisers, support log and needs attention", async () => {
    const mokoena = await staffToken(app, "n.mokoena@proofpocket.example");
    const c = (await get(mokoena, "/adviser/cohort")).body;
    expect(names(c.companies)).toEqual(expect.arrayContaining(["Khanya Solar Installs", "Mabele AgriLink", "Nala Nails & Lashes"]));
    expect(names(c.companies)).not.toContain("ReKasi Plastics");
    const khanya = c.companies.find((x: { name: string }) => x.name === "Khanya Solar Installs");
    expect((await post(mokoena, `/adviser/companies/${khanya.id}/stage`, { direction: "forward" })).body.message).toBe("Moved to Intervention");
    const drawer = (await get(mokoena, `/adviser/companies/${khanya.id}`)).body;
    expect(drawer.entries.length).toBeGreaterThan(0);
    const dube = drawer.advisers.find((a: { name: string }) => a.name === "L. Dube");
    expect((await post(mokoena, `/adviser/companies/${khanya.id}/adviser`, { adviserId: dube.id })).body.message).toBe("Adviser assigned");
    expect((await post(mokoena, "/adviser/support", { companyId: khanya.id, type: "Business plan", note: "Projections updated with supplier quotes." })).body.message).toBe("Support logged");
    expect((await get(mokoena, "/adviser/support")).body.logs[0]).toMatchObject({ company: "Khanya Solar Installs", type: "Business plan" });
    const att = (await get(mokoena, "/adviser/attention")).body.items;
    expect(att[0].level).toBe("bad");
    // Another incubator's company can't be moved.
    const rekasi = (await get(await staffToken(app, "s.pillay@proofpocket.example"), "/adviser/cohort")).body.companies.find((x: { name: string }) => x.name === "ReKasi Plastics");
    expect((await post(mokoena, `/adviser/companies/${rekasi.id}/stage`, { direction: "forward" })).status).toBe(404);
  });

  it("accepts a founder's request to join", async () => {
    const f = await newFounder(app, "joiner");
    const privacy = (await get(f.token, "/founder/privacy")).body;
    await post(f.token, "/founder/incubator", { incubatorId: privacy.incubators.find((i: { name: string }) => i.name === "Ikhaya Incubation Hub").id });
    const mokoena = await staffToken(app, "n.mokoena@proofpocket.example");
    const reqs = (await get(mokoena, "/adviser/cohort")).body.requests;
    const mine = reqs.find((r: { name: string }) => r.name.startsWith("Test joiner"));
    expect((await post(mokoena, `/adviser/memberships/${mine.id}`, { accept: true })).body.message).toBe("Company added to your cohort");
    expect(names((await get(mokoena, "/adviser/cohort")).body.companies)).toContain(mine.name);
    expect((await get(f.token, "/founder/privacy")).body.incubator.name).toBe("Ikhaya Incubation Hub");
  });
});

describe("markets, directory and admin reviews", () => {
  it("posts: feature requests only when Verified; admin features one; the directory shows it", async () => {
    const nala = signIn("zanele@proofpocket.example");
    expect((await post(nala, "/founder/posts", { text: "Lash fills R200 this week", requestFeature: true })).status).toBe(403);
    expect((await post(MABELE, "/founder/posts", { text: "New co-op dashboard for maize prices", requestFeature: true })).body.message).toBe("Saved. ProofPocket reviews feature requests weekly.");
    const admin = await staffToken(app, "admin@proofpocket.example");
    const req = (await get(admin, "/admin/features")).body.posts.find((p: { text: string }) => p.text.startsWith("New co-op dashboard"));
    expect((await post(admin, `/admin/features/${req.id}`, { approve: true })).body.message).toBe("Featured for 7 days");
    const dir = (await request(app).get("/api/v1/public/directory")).body;
    expect(dir.featured.map((f: { text: string }) => f.text)).toContain("New co-op dashboard for maize prices");
    expect(names(dir.businesses)).not.toContain("Nala Nails & Lashes");
    expect(Object.keys(dir.businesses[0]).sort()).toEqual(["name", "province", "sector", "slug", "tagline", "town"]);
  });

  it("profiles: Starters have a page with the Starter badge; reports reach admin", async () => {
    const nala = (await request(app).get("/api/v1/public/b/nala-nails-lashes")).body;
    expect(nala).toMatchObject({ name: "Nala Nails & Lashes", verified: false, whatsapp: "071 555 0142" });
    expect((await request(app).get("/api/v1/public/b/does-not-exist")).status).toBe(404);
    await request(app).post("/api/v1/public/b/nala-nails-lashes/report").send({ reason: "Asked me to pay a different account" });
    const admin = await staffToken(app, "admin@proofpocket.example");
    const r = (await get(admin, "/admin/reports")).body.reports.find((x: { reason: string }) => x.reason === "Asked me to pay a different account");
    expect(r).toMatchObject({ company: "Nala Nails & Lashes", status: "open" });
    expect((await post(admin, `/admin/reports/${r.id}`, { status: "resolved", note: "Spoke to founder" })).body.message).toBe("Report resolved");
  });

  it("buyers and tenders need Verified; interest goes to the adviser", async () => {
    const m = (await get(MABELE, "/founder/markets")).body;
    const coop = m.buyers.find((b: { name: string }) => b.name.startsWith("Farmer Co-op"));
    expect(coop.goodFit).toBe(true);
    expect((await post(MABELE, `/founder/intros/${coop.id}`)).body.message).toBe("Your adviser will arrange the introduction");
    const nala = signIn("zanele@proofpocket.example");
    expect((await post(nala, `/founder/intros/${coop.id}`)).status).toBe(403);
    const proc = (await get(MABELE, "/founder/procurement")).body;
    const solar = proc.tenders.find((t: { action: { kind: string } }) => t.action.kind === "can_express");
    expect((await post(MABELE, `/founder/tenders/${solar.id}/interest`)).body.message).toBe("Interest sent with your checked documents and track record");
    expect((await get(nala, "/founder/procurement")).body.tenders.every((t: { action: { kind: string } }) => t.action.kind === "verify_first")).toBe(true);
    const mokoena = await staffToken(app, "n.mokoena@proofpocket.example");
    const sup = (await get(mokoena, "/adviser/support")).body;
    const intro = sup.intros.find((i: { company: string }) => i.company === "Mabele AgriLink");
    expect((await post(mokoena, `/adviser/intros/${intro.id}`, { status: "arranged" })).body.message).toBe("Marked as arranged");
    expect(sup.tenderInterests.some((t: { company: string }) => t.company === "Mabele AgriLink")).toBe(true);
  });

  it("admin publishes a tender", async () => {
    const admin = await staffToken(app, "admin@proofpocket.example");
    const closes = todayZA().replace(/^(\d{4})/, (y) => String(Number(y) + 1));
    expect((await post(admin, "/admin/tenders", { title: "Catering for 3 clinics", buyerName: "Health district (example)", value: 120000, closesOn: closes, minMonths: 3, sectors: ["Catering"], requiredDocs: ["tax"] })).body.message).toBe("Tender published");
  });

  it("only staff of the right kind reach each portal", async () => {
    expect((await get(signIn("zanele@proofpocket.example"), "/funder/pipeline")).status).toBe(403);
    expect((await get(await staffToken(app, "lesedi@proofpocket.example"), "/adviser/cohort")).status).toBe(403);
    expect((await get(await staffToken(app, "n.mokoena@proofpocket.example"), "/admin/organisations")).status).toBe(403);
  });
});

describe("navigation counts", () => {
  it("match the prototype's rail for Nala", async () => {
    expect((await get(signIn("zanele@proofpocket.example"), "/me/counts")).body).toMatchObject({ start: 2, stock: 2 });
    const pillay = await staffToken(app, "s.pillay@proofpocket.example");
    expect((await get(pillay, "/me/counts")).body).toHaveProperty("checks");
  });
});
