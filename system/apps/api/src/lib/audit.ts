import type { Tx } from "../db/client";
import { activity, auditLog } from "../db/schema/index";

export interface Actor { userId: string | null; role: string; requestId?: string }

/** Appends to audit_log. The app role can't update or delete these rows. */
export async function audit(
  tx: Tx,
  actor: Actor,
  entry: { action: string; entity: string; entityId?: string; companyId?: string | null; before?: unknown; after?: unknown },
) {
  await tx.insert(auditLog).values({
    actorId: actor.userId,
    actorRole: actor.role,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    companyId: entry.companyId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    requestId: actor.requestId,
  });
}

/** Adds a line to the company timeline. */
export async function addActivity(tx: Tx, companyId: string, text: string, actorId: string | null = null) {
  await tx.insert(activity).values({ companyId, text, actorId });
}
