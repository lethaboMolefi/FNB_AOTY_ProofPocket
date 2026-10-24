import { addDays, todayZA } from "@proofpocket/shared";
import pg from "pg";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { runJobs } from "../src/jobs";
import { localStore } from "../src/lib/storage";
import { newFounder, testApp } from "./helpers";

const { app, config } = testApp();
const owner = () => new pg.Pool({ connectionString: process.env.DATABASE_OWNER_URL, max: 1 });

describe("scheduled jobs", () => {
  it("expire old requests, expired documents, and catch a swapped file", async () => {
    const f = await newFounder(app, "jobs");
    const created = await request(app).post("/api/v1/founder/payment-requests").set("Authorization", f.token).send({ client: "Old", amount: 50, rails: ["eft"] });
    const db = owner();
    try {
      await db.query("update payment_requests set requested_on = $1 where ref = $2", [addDays(todayZA(), -9), created.body.ref]);
      // The founder's ID document: mark it verified with an expiry in the past, then tamper with the stored file.
      const doc = (await db.query("select d.id, f.bucket_path from documents d join files f on f.id = d.file_id join companies c on c.id = d.company_id join users u on u.id = c.owner_id where u.email = $1 and d.doc_type = 'id'", [f.email])).rows[0];
      await db.query("update documents set status = 'verified', expires_on = $1 where id = $2", [addDays(todayZA(), -1), doc.id]);
      const store = localStore(config);
      await store.write(doc.bucket_path, Buffer.from("%PDF-1.4 swapped"));

      const res = await runJobs(process.env.DATABASE_OWNER_URL!, store, { rehash: true });
      expect(res.requestsExpired).toBeGreaterThanOrEqual(1);
      expect(res.documentsExpired).toBeGreaterThanOrEqual(1);
      expect(res.filesMismatched).toBeGreaterThanOrEqual(1);

      const msgs = (await request(app).get("/api/v1/founder/protection").set("Authorization", f.token)).body.messages.map((m: { body: string }) => m.body);
      expect(msgs).toEqual(expect.arrayContaining(["Your Owner ID copy has expired. Upload a current one under Registration steps.", expect.stringMatching(/no longer matches the file that was checked/)]));
      const reqs = (await request(app).get("/api/v1/founder/payments").set("Authorization", f.token)).body.requests;
      expect(reqs.find((r: { ref: string }) => r.ref === created.body.ref).status).toBe("expired");
    } finally { await db.end(); }
  });
});
