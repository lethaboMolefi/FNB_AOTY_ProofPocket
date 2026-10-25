import type { NextFunction, Request, RequestHandler, Response } from "express";
import rateLimit, { type Store } from "express-rate-limit";
import type { Logger } from "pino";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { AppError } from "../lib/errors";

/** Wraps an async handler; a returned value is sent as JSON. */
export const handle = (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).then((body) => { if (!res.headersSent) res.json(body ?? { ok: true }); }, next);
  };

export const parse = <S extends ZodTypeAny>(schema: S, value: unknown): z.infer<S> => schema.parse(value);

let storeFor: ((name: string) => Store) | undefined;
/** Where limiters keep their counts (Postgres in production; each process's memory when unset). Call before building routes. */
export const useRateLimitStore = (f: ((name: string) => Store) | undefined) => { storeFor = f; };

// Every limiter of one kind shares one counter per client IP (e.g. all sign-in and code endpoints).
const limiter = (name: string, windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs, limit, standardHeaders: "draft-7", legacyHeaders: false, store: storeFor?.(name),
    // If the counter can't be reached the request goes on; the database it needs is the same one.
    passOnStoreError: true,
    handler: (_req, res) => { res.status(429).json({ error: { code: "rate_limited", message } }); },
  });

export const limits = {
  general: () => limiter("general", 60_000, 300, "Too many requests. Wait a minute and try again."),
  // Per IP. Many people can share one mobile-network IP, and each account also locks after 5 wrong tries,
  // so this is a backstop. AUTH_RATE_LIMIT raises it (end-to-end tests sign in many times from one machine).
  auth: () => limiter("auth", 15 * 60_000, Number(process.env.AUTH_RATE_LIMIT) || 60, "Too many sign-in attempts. Wait 15 minutes and try again."),
  uploads: () => limiter("uploads", 15 * 60_000, 60, "Too many uploads. Wait a few minutes and try again."),
  pay: () => limiter("pay", 60_000, 30, "Too many requests. Wait a minute and try again."),
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
