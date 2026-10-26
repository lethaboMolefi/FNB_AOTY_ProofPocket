import { randomUUID } from "node:crypto";
import { todayZA } from "@proofpocket/shared";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { newFounder, nextCode, signIn, testApp } from "./helpers";

const { app, mailer } = testApp();
const NALA = signIn("zanele@proofpocket.example");
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489", "hex");
const get = (t: string, p: string) => request(app).get(`/api/v1${p}`).set("Authorization", t);
const post = (t: string, p: string, b: object = {}) => request(app).post(`/api/v1${p}`).set("Authorization", t).send(b);

/** Splits "https://…/pay/PP-4821-token" into what the page sends: the ref in the path, the token in a header. */
const split = (link: string) => { const m = /\/pay\/(PP-\d+)-(.+)$/.exec(link)!; return { ref: m[1]!, token: m[2]! }; };
const payGet = (link: string) => { const { ref, token } = split(link); return request(app).get(`/api/v1/pay/${ref}`).set("X-Pay-Token", token); };
const payPost = (link: string, path: string, body: object) => { const { ref, token } = split(link); return request(app).post(`/api/v1/pay/${ref}${path}`).set("X-Pay-Token", token).send(body); };

/** A PNG with unique trailing bytes, so it's never "used before" by accident. */
const uniquePng = () => Buffer.concat([PNG, Buffer.from(randomUUID())]);

async function clientUploads(link: string, bytes = uniquePng()) {
  const s = await payPost(link, "/uploads", { name: "proof.png", contentType: "image/png", size: bytes.length });
  expect(s.status).toBe(200);
  await request(app).put(s.body.upload.url).set("Content-Type", "image/png").send(bytes);
  const { ref, token } = split(link);
  const done = await request(app).post(`/api/v1/pay/${ref}/uploads/${s.body.fileId}/complete`).set("X-Pay-Token", token).send({});
  expect(done.status).toBe(200);
  return s.body.fileId as string;
}

describe("payment requests and the public payment page", () => {
  it("lists Naledi's proof with five passing checks and Lerato's open request", async () => {
    const r = (await get(NALA, "/founder/payments")).body;
    const naledi = r.requests.find((x: { ref: string }) => x.ref === "PP-4790");
    expect(naledi.status).toBe("checking");
    expect(naledi.proof.checks.map((c: { ok: boolean }) => c.ok)).toEqual([true, true, true, true, true]);
    expect(r.requests.find((x: { ref: string }) => x.ref === "PP-4821")).toMatchObject({ status: "waiting", client: "Lerato" });
    expect(r.details).toMatchObject({ bank: "Capitec", accountMasked: "••6871", inBusinessName: false });
  });

  it("shows the client only this request, with the founder's saved details for the allowed methods", async () => {
    const lerato = (await get(NALA, "/founder/payments")).body.requests.find((x: { ref: string }) => x.ref === "PP-4821");
    const page = await payGet(lerato.link);
    expect(page.status).toBe(200);
    expect(page.body).toMatchObject({ business: { name: "Nala Nails & Lashes", verified: false }, amount: 350, ref: "PP-4821", canSendProof: true });
    expect(page.body.ways.eft).toEqual({ bank: "Capitec", accountName: "Z. M. (personal account)", accountNumber: "1452 336 871" });
    expect(page.body.ways.payshap.shapId).toBe("071 555 0142");
    expect(page.body.ways.card_machine).toBeUndefined();
    // A wrong token, or none, looks the same as a request that doesn't exist.
    expect((await request(app).get("/api/v1/pay/PP-4821").set("X-Pay-Token", "wrong-token-123")).status).toBe(404);
    expect((await request(app).get("/api/v1/pay/PP-4821")).status).toBe(404);
  });

  it("a fake proof: wrong amount, used twice, rejected twice → flagged with a fraud warning", async () => {
    const F = (await newFounder(app, "fakeproof")).token;
    const created = await post(F, "/founder/payment-requests", { client: "Sizwe", amount: 500, what: "Full set", rails: ["eft", "cash"] });
    expect(created.body.message).toMatch(/^Request PP-\d{4} created/);
    const link = created.body.link as string;
    const screenshot = uniquePng();
    const fileId = await clientUploads(link, screenshot);
    const sent = await payPost(link, "/proof", { payer: "Sizwe B.", amount: 300, paidOn: todayZA(), method: "eft", usedReference: false, fileId });
    expect(sent.body.message).toBe("Proof sent to the business. They'll confirm once the money is in.");
    // The page can't be used to send another while it's being checked.
    expect((await payPost(link, "/proof", { payer: "Sizwe B.", amount: 500, paidOn: todayZA(), method: "eft", usedReference: true, fileId })).body.error.code).toBe("not_open");

    let req = (await get(F, "/founder/payments")).body.requests.find((x: { ref: string }) => x.ref === created.body.ref);
    expect(req.proof.checks.filter((c: { ok: boolean }) => !c.ok).map((c: { code: string }) => c.code)).toEqual(["amount", "reference"]);
    expect((await post(F, `/founder/proofs/${req.proof.id}/reject`)).body.message).toBe("Marked not received. The client can upload proof again.");

    // Second try with the same screenshot: the file has been used before.
    const again = await clientUploads(link, screenshot);
    await payPost(link, "/proof", { payer: "Sizwe B.", amount: 500, paidOn: todayZA(), method: "eft", usedReference: true, fileId: again });
    req = (await get(F, "/founder/payments")).body.requests.find((x: { ref: string }) => x.ref === created.body.ref);
    expect(req.proof.checks.find((c: { code: string }) => c.code === "reused")).toMatchObject({ ok: false, text: "This exact file was used as proof before" });
    expect((await post(F, `/founder/proofs/${req.proof.id}/reject`)).body.message).toBe("Marked not received. Flagged as a possible fake proof of payment.");

    expect((await payGet(link)).body).toMatchObject({ status: "flagged", canSendProof: false });
    const msgs = (await get(F, "/founder/protection")).body.messages;
    expect(msgs[0]).toMatchObject({ sender: "Sizwe (client)", flags: ["Possible fake proof of payment", "Don't hand over goods until the money shows in your bank"] });
  });

  it("“The money is in my account” records money in with the proof attached, once", async () => {
    const F = (await newFounder(app, "confirm")).token;
    const created = await post(F, "/founder/payment-requests", { client: "Naledi", amount: 250, what: "Gel overlay", rails: ["payshap"] });
    const fileId = await clientUploads(created.body.link);
    await payPost(created.body.link, "/proof", { payer: "Naledi M.", amount: 250, paidOn: todayZA(), method: "payshap", usedReference: true, fileId });
    const req = (await get(F, "/founder/payments")).body.requests[0];
    expect(req.proof.checks.every((c: { ok: boolean }) => c.ok)).toBe(true);
    expect((await post(F, `/founder/proofs/${req.proof.id}/confirm`)).body.message).toBe("Confirmed and added to your books with the proof attached");
    expect((await post(F, `/founder/proofs/${req.proof.id}/confirm`)).status).toBe(409);
    const books = (await get(F, "/founder/books")).body.entries;
    expect(books.find((e: { note: string }) => e.note.includes(created.body.ref))).toMatchObject({ amount: 250, direction: "in", receipt: true, source: "proof" });
    expect((await payGet(created.body.link)).body.status).toBe("paid");
    // Later, the founder can look at the payment again and open the proof.
    const paid = (await get(F, "/founder/payments")).body.requests.find((r: { ref: string }) => r.ref === created.body.ref);
    expect(paid.proof).toBeNull();
    expect(paid.proofs).toHaveLength(1);
    expect(paid.proofs[0]).toMatchObject({ payer: "Naledi M.", amount: 250, status: "confirmed", fileId });
    expect((await get(F, `/files/${fileId}/download-url`)).body.url).toBeTruthy();
  });

  it("“Paid me cash” and cancelling", async () => {
    const F = (await newFounder(app, "cash")).token;
    const a = await post(F, "/founder/payment-requests", { client: "Ayanda", amount: 150, what: "Manicure", rails: ["cash"] });
    const reqs = (await get(F, "/founder/payments")).body.requests;
    const id = reqs.find((x: { ref: string }) => x.ref === a.body.ref).id;
    expect((await post(F, `/founder/payment-requests/${id}/cash`)).body.message).toBe("Payment added to your books");
    expect((await post(F, `/founder/payment-requests/${id}/cancel`)).body.error.code).toBe("not_open");
    const b = await post(F, "/founder/payment-requests", { client: "Bongi", amount: 90, rails: ["payshap"] });
    const bid = (await get(F, "/founder/payments")).body.requests.find((x: { ref: string }) => x.ref === b.body.ref).id;
    await post(F, `/founder/payment-requests/${bid}/cancel`);
    expect((await payGet(b.body.link)).body.status).toBe("cancelled");
  });

  it("validates requests", async () => {
    expect((await post(NALA, "/founder/payment-requests", { client: "X", amount: 10, rails: [] })).body.error.message).toMatch(/at least one way to pay/);
  });
});

describe("payment details need Google Authenticator", () => {
  it("are refused without it, then saved with a valid code and the incubator's advisers are told", async () => {
    const F = (await newFounder(app, "details", "Township Futures Trust")).token;
    const body = { bank: "Absa", accountName: "Test Business (Pty) Ltd", accountNumber: "4098 112 999", shapId: "", inBusinessName: true, code: "123456" };
    expect((await request(app).put("/api/v1/founder/payment-details").set("Authorization", F).send(body)).body.error.code).toBe("authenticator_needed");
    const { secret } = (await post(F, "/auth/totp/setup")).body;
    const first = nextCode(secret, 0);
    await post(F, "/auth/totp/activate", { code: first.code });
    expect((await request(app).put("/api/v1/founder/payment-details").set("Authorization", F).send(body)).body.error.code).toBe("code_wrong");
    const second = nextCode(secret, first.step);
    const ok = await request(app).put("/api/v1/founder/payment-details").set("Authorization", F).send({ ...body, code: second.code });
    expect(ok.body.message).toBe("Payment details saved");
    expect(mailer.sent.map((m) => m.to)).toEqual(expect.arrayContaining(["s.pillay@proofpocket.example", "t.mahlangu@proofpocket.example"]));
    expect((await get(F, "/founder/payments")).body.details.accountMasked).toBe("••2999");
    // The client's page shows the new number.
    const created = await post(F, "/founder/payment-requests", { client: "Lwazi", amount: 90, rails: ["eft"] });
    expect((await payGet(created.body.link)).body.ways.eft.accountNumber).toBe("4098112999");
  });
});

describe("suppliers and cash payouts", () => {
  it("payments are blocked while a supplier's bank details are on hold", async () => {
    const F = (await newFounder(app, "supplier")).token;
    await post(F, "/founder/suppliers", { name: "Glam Supplies", bank: "Capitec", accountNumber: "3310" });
    const s = (await get(F, "/founder/payments")).body.suppliers[0];
    expect(s).toMatchObject({ bank: "Capitec ••3310", pending: null });
    expect((await request(app).put(`/api/v1/founder/suppliers/${s.id}/bank`).set("Authorization", F).send({ bank: "Unknown bank", accountNumber: "9001" })).body.message)
      .toBe("Change received. Payments to this supplier are on hold.");
    const pay = { clientUuid: randomUUID(), supplierId: s.id, amount: 640, what: "Gel polish", date: todayZA() };
    expect((await post(F, "/founder/supplier-payments", pay)).body.error.message).toBe("Payment blocked: Glam Supplies's bank details changed. Confirm by phone under Fraud protection first.");
    expect((await post(F, `/founder/suppliers/${s.id}/reject`)).body.message).toBe("Change rejected. Old details kept.");
    expect((await post(F, "/founder/supplier-payments", pay)).body.message).toBe("Recorded your payment to Glam Supplies (Capitec ••3310).");
  });

  it("cash payouts give a slip number once", async () => {
    const p = { clientUuid: randomUUID(), name: "Thabo (collector)", amount: 85, what: "PET bottles 17 kg", noPhone: true, date: todayZA() };
    const F = (await newFounder(app, "payout")).token;
    const a = await post(F, "/founder/cash-payouts", p);
    const b = await post(F, "/founder/cash-payouts", p);
    expect(a.body.message).toMatch(/^Recorded\. Give Thabo \(collector\) slip number S\d{5}\.$/);
    expect(b.body.slip).toBe(a.body.slip);
  });
});

describe("fraud protection and privacy", () => {
  it("reporting a scammer warns the next founder who checks a message from them", async () => {
    const A = (await newFounder(app, "reporter")).token;
    const text = "Congratulations! Your salon qualifies for R250 000. Pay a R1 500 processing fee today to release the funds.";
    const sender = `approvals.${randomUUID().slice(0, 6)}@quickgrantz-mail.com`;
    const checked = await post(A, "/founder/check-message", { sender, text });
    expect(checked.body.flags).toEqual(["Sender is not a verified funder", "Asks for a fee before money is released", "Pressure to act today"]);
    expect((await post(A, `/founder/messages/${checked.body.id}`, { action: "block" })).body.message).toBe("Reported. Other founders will be warned about this sender.");
    const B = (await newFounder(app, "checker")).token;
    const r = await post(B, "/founder/check-message", { sender: sender.toUpperCase(), text: "You qualify for a R100 000 grant. Pay the admin fee today." });
    expect(r.body.flags).toContain("Other founders reported this sender");
    expect((await post(B, "/founder/check-message", { sender: "0715550000", text: "Hi, can I book a catering tasting for Saturday?" })).body.flags).toEqual([]);
    // Nala's seeded scam is listed with its flags.
    const nalaMsgs = (await get(NALA, "/founder/protection")).body.messages;
    expect(nalaMsgs.find((m: { sender: string }) => m.sender === "Funding Approvals Desk").flags).toHaveLength(3);
  });

  it("sharing and incubator membership", async () => {
    const thandi = (await newFounder(app, "privacy", "Township Futures Trust")).token;
    expect((await request(app).put("/api/v1/founder/privacy").set("Authorization", thandi).send({ sharing: "full" })).body.message).toBe("Sharing updated");
    expect((await get(thandi, "/founder/privacy")).body).toMatchObject({ sharing: "full", incubator: { name: "Township Futures Trust" } });
    await post(thandi, "/founder/incubator", { incubatorId: null });
    const v = (await get(thandi, "/founder/privacy")).body;
    expect(v.incubator).toBeNull();
    const ikhaya = v.incubators.find((i: { name: string }) => i.name === "Ikhaya Incubation Hub");
    expect((await post(thandi, "/founder/incubator", { incubatorId: ikhaya.id })).body.message).toMatch(/^Request sent\. Ikhaya Incubation Hub will accept you/);
    expect((await get(thandi, "/founder/privacy")).body.pendingRequest.name).toBe("Ikhaya Incubation Hub");
  });

  it("PayFast stays off until its merchant details are set", async () => {
    const F = (await newFounder(app, "payfastoff")).token;
    expect((await get(F, "/founder/payments")).body.payfastEnabled).toBe(false);
    const r = await post(F, "/founder/payment-requests", { client: "Lerato", amount: 120, what: "Braids", rails: ["payfast", "cash"] });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe("payfast_off");
    const ok = await post(F, "/founder/payment-requests", { client: "Lerato", amount: 120, what: "Braids", rails: ["cash"] });
    const { ref, token } = split(ok.body.link);
    expect((await request(app).post(`/api/v1/pay/${ref}/payfast/initiate`).set("X-Pay-Token", token).send({})).status).toBe(404);
    expect((await payGet(ok.body.link)).body.ways.payfast).toBeUndefined();
  });
});

