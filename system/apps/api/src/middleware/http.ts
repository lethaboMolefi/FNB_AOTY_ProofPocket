import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit from "express-rate-limit";
import type { Logger } from "pino";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError } from "../lib/errors";

/** Wraps an async handler; a returned value is sent as JSON. */
export const handle = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).then((body) => { if (!res.headersSent) res.json(body ?? { ok: true }); }, next);
  };

export const parse = <S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> => schema.parse(value);

const limiter = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs, limit, standardHeaders: "draft-7", legacyHeaders: false,
    handler: (_req, res) => { res.status(429).json({ error: { code: "rate_limited", message } }); },
  });

export const limits = {
  general: () => limiter(60_000, 300, "Too many requests. Wait a minute and try again."),
  auth: () => limiter(15 * 60_000, 30, "Too many sign-in attempts. Wait 15 minutes and try again."),
  uploads: () => limiter(15 * 60_000, 60, "Too many uploads. Wait a few minutes and try again."),
  pay: () => limiter(60_000, 30, "Too many requests. Wait a minute and try again."),
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: "not_found", message: "Not found." } });
};

export function errorHandler(log: Logger) {
  return (err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    if (err instanceof ZodError) {
      const first = err.issues[0];
      return res.status(400).json({ error: { code: "validation_failed", message: first ? `${first.path.join(".") || "request"}: ${first.message}` : "Check the form and try again." } });
    }
    const e = err as { type?: string; status?: number };
    if (e?.type === "entity.parse.failed") return res.status(400).json({ error: { code: "bad_json", message: "The request body isn't valid JSON." } });
    if (e?.type === "entity.too.large") return res.status(413).json({ error: { code: "too_large", message: "The request is too large." } });
    // Never log request bodies: they can hold ID or account numbers.
    log.error({ err, reqId: req.id, path: req.path }, "unhandled error");
    res.status(500).json({ error: { code: "internal", message: "Something went wrong on our side. Try again." } });
  };
}
