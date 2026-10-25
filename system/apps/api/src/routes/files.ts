// Signed 5-minute download links, after an access check (RLS decides who can see the file row).
// In local development, also the stand-in for Cloud Storage's signed URLs.
import { eq } from "drizzle-orm";
import express, { Router } from "express";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { files } from "../db/schema/index";
import { AppError, notFound } from "../lib/errors";
import type { LocalStore } from "../lib/storage";
import { contextOf, requireUser } from "../middleware/auth";
import { handle } from "../middleware/http";
import { MAX_UPLOAD_BYTES } from "@proofpocket/shared";

export function fileRoutes(deps: Deps) {
  const r = Router();

  r.get("/files/:id/download-url", requireUser(), handle(async (req) => {
    const f = await withContext(deps.db, contextOf(req), async (tx) => (await tx.select().from(files).where(eq(files.id, String(req.params.id))))[0]);
    if (!f || !f.sha256) throw notFound("That file");
    return { url: await deps.store.downloadUrl(f.bucketPath, f.originalName, f.mime), expiresInSeconds: 300 };
  }));

  if (deps.config.STORAGE_MODE === "local") {
    const store = deps.store as LocalStore;
    r.put("/storage/:token", express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }), handle(async (req) => {
      let g;
      try { g = store.grant(String(req.params.token)); } catch { throw new AppError(403, "bad_upload_url", "This upload link has expired. Try again."); }
      const body = req.body as Buffer;
      if (g.op !== "put" || req.headers["content-type"] !== g.t || !Buffer.isBuffer(body) || body.length !== g.s) {
        throw new AppError(400, "upload_mismatch", "The file doesn't match what was expected. Try again.");
      }
      await store.save(g.p, body);
      return { ok: true };
    }));
    r.get("/storage/:token", handle(async (req, res) => {
      let g;
      try { g = store.grant(String(req.params.token)); } catch { throw new AppError(403, "bad_download_url", "This link has expired."); }
      if (g.op !== "get") throw new AppError(403, "bad_download_url", "This link has expired.");
      const data = await store.read(g.p);
      res.setHeader("Content-Type", g.t);
      res.setHeader("Content-Disposition", `attachment; filename="${(g.n ?? "file").replace(/[^\w.-]+/g, "_")}"`);
      res.setHeader("Cache-Control", "private, no-store");
      // A stored upload, sent as a download: no scripts, no rendering in our origin.
      res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
      // nosemgrep: direct-response-write -- binary file download with attachment disposition, nosniff and a sandbox CSP
      res.send(data);
    }));
  }
  return r;
}
