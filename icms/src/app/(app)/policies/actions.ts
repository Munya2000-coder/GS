"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

/**
 * Electronic policy acknowledgement (PRD Module 29 / ICMS-104).
 * Records a tamper-evident attestation that the current user has read and
 * acknowledged a controlled compliance policy. Idempotent per [policy, user].
 */
export async function attestPolicy(formData: FormData) {
  const user = await requireUser();
  const policyId = String(formData.get("policyId"));

  await prisma.policyAttestation.upsert({
    where: { policyId_userName: { policyId, userName: user.displayName } },
    create: { policyId, userName: user.displayName, role: user.roles[0] },
    update: {},
  });

  await recordAudit({
    actor: user,
    action: "policy.attest",
    entityType: "PolicyDocument",
    entityId: policyId,
    summary: `Policy acknowledged by ${user.displayName}`,
  });

  revalidatePath("/policies");
}
