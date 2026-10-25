// Rate-limit counters in Postgres (rate_limit_hit(), migration 0009), so the limits hold across every
// Cloud Run instance instead of each instance counting on its own.
import { sql } from "drizzle-orm";
import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";
import type { Db } from "../db/client";

export class PostgresRateLimitStore implements Store {
  private windowMs = 60_000;
  readonly localKeys = false;
  constructor(private db: Db, readonly prefix: string) {}

  init(options: Options) { this.windowMs = options.windowMs; }

  private async hit(key: string, delta: number): Promise<ClientRateLimitInfo> {
    const r = await this.db.execute<{ hits: number; reset_at: string | Date }>(
      sql`select * from rate_limit_hit(${`${this.prefix}:${key}`}, ${this.windowMs}, ${delta})`);
    const row = r.rows[0]!;
    return { totalHits: Number(row.hits), resetTime: new Date(row.reset_at) };
  }

  increment(key: string) { return this.hit(key, 1); }
  async decrement(key: string) { await this.hit(key, -1); }
  async resetKey(key: string) { await this.db.execute(sql`select rate_limit_reset(${`${this.prefix}:${key}`})`); }
}
