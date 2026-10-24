// Founder: uploads, documents and Registration steps.
import { cipcNumberSchema, documentCreateSchema, uploadStartSchema, START_STEPS, DOCS, JOIN_DOCS } from "@proofpocket/shared";
import { eq } from "drizzle-orm";
import { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { companies } from "../db/schema/index";
import { addActivity } from "../lib/audit";
import { actorOf, contextOf, requireUser } from "../middleware/auth";
import { handle, limits, parse } from "../middleware/http";
import { myCompany } from "../repositories/companies";
import { checkerText, documentsOf, uploadDocument } from "../services/documents";
import { completeUpload, startUpload } from "../services/files";

export function founderDocRoutes(deps: Deps) {
  const r = Router();
  const founder = requireUser(["founder"]);
  const me = (req: Parameters<typeof contextOf>[0]) => req.auth!.user!.id;

  r.post("/founder/uploads", limits.uploads(), founder, handle(async (req) => {
    const u = parse(uploadStartSchema, req.body);
    return withContext(deps.db, contextOf(req), async (tx) => {
      const c = await myCompany(tx, me(req), { joined: false });
      return startUpload(tx, deps.store, { ...u, companyId: c.id, userId: me(req) });
    });
  }));

  r.post("/founder/uploads/:id/complete", limits.uploads(), founder, handle(async (req) =>
    withContext(deps.db, contextOf(req), async (tx) => {
      await myCompany(tx, me(req), { joined: false });
      return completeUpload(tx, deps.store, String(req.params.id));
    })));

  r.post("/founder/documents", founder, handle(async (req) => {
    const { docType, fileId } = parse(documentCreateSchema, req.body);
    return withContext(deps.db, contextOf(req), async (tx) => {
      const c = await myCompany(tx, me(req), { joined: false });
      return uploadDocument(tx, actorOf(req), c, docType, fileId);
    });
  }));

  // Registration steps: every document's state, fingerprint and who checks it.
  r.get("/founder/documents", founder, handle(async (req) =>
    withContext(deps.db, contextOf(req), async (tx) => {
      const c = await myCompany(tx, me(req), { joined: false });
      const { states, latest } = await documentsOf(tx, c.id);
      const checker = await checkerText(tx, c);
      return {
        company: { name: c.name, legalName: c.legalName, cipcNumber: c.cipcNumber, verified: c.verifiedAt !== null, joined: c.joinedAt !== null, registered: c.cipcNumber !== null, incubatorId: c.incubatorId },
        checker,
        steps: START_STEPS.map((s) => ({ ...s, name: DOCS[s.key].name, neededToVerify: JOIN_DOCS.includes(s.key) })),
        documents: Object.entries(states).map(([docType, state]) => {
          const l = latest.get(docType as keyof typeof DOCS);
          return {
            docType, state, name: DOCS[docType as keyof typeof DOCS].name,
            fileName: state === "missing" ? null : l?.fileName ?? null, sha256: state === "missing" ? null : l?.sha256 ?? null,
            expiresOn: l?.expiresOn ?? null, sentBackReason: l?.status === "rejected" ? l.rejectReason : null,
          };
        }),
      };
    })));

  r.put("/founder/cipc", founder, handle(async (req) => {
    const { cipcNumber } = parse(cipcNumberSchema, req.body);
    return withContext(deps.db, contextOf(req), async (tx) => {
      const c = await myCompany(tx, me(req));
      await tx.update(companies).set({ cipcNumber }).where(eq(companies.id, c.id));
      await addActivity(tx, c.id, `CIPC number ${cipcNumber} added.`, me(req));
      return { ok: true, message: "CIPC number saved. Upload the certificate next." };
    });
  }));

  return r;
}
