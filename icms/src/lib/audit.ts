import { prisma } from "./db";
import type { SessionUser } from "./auth";

/**
 * Tamper-evident audit trail (PRD Module 20 / ICMS-085..087).
 *
 * Every significant action funnels through `recordAudit`. Audit rows are
 * append-only by application contract: there are no update/delete code paths,
 * and the UI exposes read + export only. In production on Postgres this should
 * be backed by a row-level-security policy or an append-only table grant so the
 * guarantee holds at the database layer too.
 */

export type AuditInput = {
  actor: Pick<SessionUser, "id" | "displayName"> | { id: null; displayName: string };
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  ipAddress?: string | null;
};

export async function recordAudit(input: AuditInput) {
  return prisma.auditTrail.create({
    data: {
      actorId: input.actor.id ?? undefined,
      actorName: input.actor.displayName,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? undefined,
      summary: input.summary,
      oldValue: input.oldValue ?? undefined,
      newValue: input.newValue ?? undefined,
      reason: input.reason ?? undefined,
      ipAddress: input.ipAddress ?? undefined,
    },
  });
}
