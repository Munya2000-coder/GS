"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

/**
 * Approve a documented recruitment-evidence exception (PRD Module 4 / ICMS-021).
 *
 * CoS approval is blocked where mandatory recruitment documents are missing
 * unless a Compliance Manager / HR Manager signs off a documented exception.
 */
export async function approveRecruitmentException(formData: FormData) {
  const user = await requirePermission("recruitment.manage");
  const workerId = String(formData.get("workerId") ?? "").trim();
  if (!workerId) throw new Error("A worker reference is required to approve a recruitment exception.");

  await prisma.recruitmentRecord.update({
    where: { workerId },
    data: {
      exceptionApproved: true,
      exceptionApprovedBy: user.displayName,
    },
  });

  await recordAudit({
    actor: user,
    action: "recruitment.exception.approve",
    entityType: "RecruitmentRecord",
    entityId: workerId,
    summary: `Recruitment evidence exception approved for worker ${workerId}`,
  });

  revalidatePath("/recruitment");
}
