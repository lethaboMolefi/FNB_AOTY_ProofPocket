// UML diagrams (Mermaid sources in apps/api/uml) and the summary of admins' account decisions.
// Founders and admins only: everyone else gets 403, signed-out people 401.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Router } from "express";
import { z } from "zod";
import type { Deps } from "../app";
import { withContext } from "../db/client";
import { notFound } from "../lib/errors";
import { contextOf, requireUser } from "../middleware/auth";
import { handle, parse } from "../middleware/http";
import { founderAdminLog } from "../services/approvals";

interface Diagram { id: string; title: string; kind: string }
// Shipped next to dist/ in the image (Dockerfile), and in apps/api/uml when developing.
const DIR = resolve(process.cwd(), "uml");
const TYPES = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf", source: "text/plain; charset=utf-8" } as const;
const index = (): Diagram[] => JSON.parse(readFileSync(resolve(DIR, "index.json"), "utf8")) as Diagram[];

export function umlRoutes(deps: Deps) {
  const r = Router();
  const allowed = requireUser(["founder", "admin"]);

  r.get("/uml", allowed, handle(async () => ({ diagrams: index() })));
  // Each diagram as SVG, PNG or PDF (drawn at build time: apps/web/scripts/render-uml.mjs), or its Mermaid source.
  r.get("/uml/:id/:format", allowed, (req, res, next) => {
    try {
      const id = parse(z.string().regex(/^[a-z0-9-]+$/), req.params.id);
      const format = parse(z.enum(["svg", "png", "pdf", "source"]), req.params.format);
      const d = index().find((x) => x.id === id);
      if (!d) throw notFound("That diagram");
      const file = format === "source" ? resolve(DIR, `${id}.mmd`) : resolve(DIR, "rendered", `${id}.${format}`);
      const name = `${id}.${format === "source" ? "mmd" : format}`;
      res.setHeader("Content-Type", TYPES[format]);
      // ?view=1 shows the SVG on the page; everything else downloads.
      res.setHeader("Content-Disposition", `${req.query.view === "1" ? "inline" : "attachment"}; filename="${name}"`);
      res.setHeader("Cache-Control", "private, max-age=300");
      res.send(readFileSync(file));
    } catch (e) { next(e); }
  });

  r.get("/admin-log", allowed, handle((req) => withContext(deps.db, contextOf(req), founderAdminLog)));
  return r;
}
