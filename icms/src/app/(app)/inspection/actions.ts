"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

/**
 * Inspection Mode server actions (PRD Module 18).
 *  - ICMS-079: time-limited (max 72h) read-only Inspector accounts, fully logged.
 */

/** Create a 72-hour, read-only external Inspector account. */
export async function createInspector(formData: FormData) {
  const user = await requirePermission("inspection.run");
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!email || !displayName) {
    throw new Error("Inspector email and display name are required.");
  }

  const accessExpiresAt = new Date(Date.now() + 72 * 3600 * 1000);

  const created = await prisma.user.create({
    data: {
      email,
      displayName,
      roles: "INSPECTOR",
      isExternal: true,
      accessExpiresAt,
    },
  });

  await recordAudit({
    actor: user,
    action: "inspector.create",
    entityType: "User",
    entityId: created.id,
    summary: `72-hour Inspector account created for ${displayName} (${email})`,
    newValue: accessExpiresAt.toISOString(),
  });

  revalidatePath("/inspection");
}

/** Revoke (deactivate + expire) an Inspector account. */
export async function revokeInspector(formData: FormData) {
  const user = await requirePermission("inspection.run");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Inspector userId is required.");

  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false, accessExpiresAt: new Date(Date.now() - 1000) },
  });

  await recordAudit({
    actor: user,
    action: "inspector.revoke",
    entityType: "User",
    entityId: userId,
    summary: "Inspector account access revoked",
  });

  revalidatePath("/inspection");
}
