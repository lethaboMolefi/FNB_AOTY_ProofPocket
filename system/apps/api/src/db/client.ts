import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Who the database should treat the current request as. Read by the RLS policies. */
export interface DbContext {
  role: "founder" | "funder" | "adviser" | "buyer" | "admin" | "public" | "joining" | "auth" | "anonymous";
  userId?: string | null;
  firebaseUid?: string | null;
  payRequestId?: string | null;
}

export function createDb(url: string) {
  const pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30_000 });
  return { pool, db: drizzle(pool, { schema }) };
}

/** Runs `fn` in one transaction with SET LOCAL app.* so row-level security sees the caller. */
export function withContext<T>(db: Db, ctx: DbContext, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select
      set_config('app.role', ${ctx.role}, true),
      set_config('app.user_id', ${ctx.userId ?? ""}, true),
      set_config('app.firebase_uid', ${ctx.firebaseUid ?? ""}, true),
      set_config('app.pay_request_id', ${ctx.payRequestId ?? ""}, true)`);
    return fn(tx);
  });
}
