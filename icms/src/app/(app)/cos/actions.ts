"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { COS_STAGES } from "@/lib/rbac";
import { checkSalaryCompliance } from "@/lib/salary-compliance";

/**
 * Advance / reject / return a CoS approval stage (PRD Module 2).
 * Enforces:
 *  - ICMS-009: no stage-skipping — only the current stage can be actioned
 *  - ICMS-011: the submitter cannot final-approve their own request
 *  - per-stage RBAC: the actor must hold the stage's permission
 *  - ICMS-012: cannot reach Approved while mandatory evidence is missing
 *  - ICMS-010: approval records are immutable (decision set once)
 */
export async function actionCosStage(formData: FormData) {
  const cosId = String(formData.get("cosId"));
  const decision = String(formData.get("decision")) as "approved" | "rejected" | "returned";
  const comments = String(formData.get("comments") ?? "");
  const user = await requireUser();

  const cos = await prisma.cos.findUnique({
    where: { id: cosId },
    include: { approvals: { orderBy: { stage: "asc" } }, worker: { include: { appendixD: true } } },
  });
  if (!cos) throw new Error("CoS not found");

  // Current stage = the first approval row without a decision.
  const current = cos.approvals.find((a) => !a.decision);
  if (!current) throw new Error("All stages already actioned");

  const stageDef = COS_STAGES.find((s) => s.stage === current.stage);
  if (!stageDef) throw new Error("Unknown stage");

  // Per-stage RBAC.
  if (!user.permissions.has(stageDef.permission)) {
    throw new Error(`FORBIDDEN: your role cannot action the "${current.stageName}" stage`);
  }

  // Salary & hours compliance gate at the Finance stage (ICMS-034,035).
  if (current.stage === 3 && decision === "approved") {
    const salary = await checkSalaryCompliance({
      socCode: cos.socCode,
      salary: cos.salary,
      contractedHours: cos.contractedHours,
    });
    if (salary.blocking) {
      const failed = salary.checks.filter((c) => !c.pass).map((c) => c.label).join(", ");
      throw new Error(`Cannot approve: salary below mandatory threshold (${failed}). Override requires documented Compliance Manager exception (ICMS-035).`);
    }
  }

  // Separation of duties at final AO approval (ICMS-011).
  if (current.stage === 5 && decision === "approved" && cos.submittedById === user.id) {
    throw new Error("Separation of duties: the submitter cannot final-approve their own CoS request (ICMS-011).");
  }

  // Evidence gate at final approval (ICMS-012).
  if (current.stage === 5 && decision === "approved") {
    const missing = (cos.worker?.appendixD ?? []).filter(
      (d) => d.required && (d.status === "Missing" || d.status === "Expired"),
    );
    if (missing.length > 0) {
      throw new Error(
        `Cannot approve: ${missing.length} mandatory Appendix D document(s) missing/expired (ICMS-012).`,
      );
    }
  }

  // Record the immutable stage decision.
  await prisma.cosApproval.update({
    where: { id: current.id },
    data: {
      approverId: user.id,
      approverName: user.displayName,
      approverRole: user.roles[0],
      decision,
      comments,
      decidedAt: new Date(),
    },
  });

  // Transition CoS state.
  let newStatus = cos.status;
  if (decision === "rejected") {
    newStatus = "Rejected";
  } else if (decision === "returned") {
    newStatus = "Draft";
  } else if (current.stage === 5) {
    newStatus = "Approved";
  } else {
    newStatus = "Pending Approval";
  }

  await prisma.cos.update({
    where: { id: cosId },
    data: { status: newStatus, currentStage: decision === "approved" ? current.stage + 1 : current.stage },
  });

  await recordAudit({
    actor: user,
    action: `cos.${decision}`,
    entityType: "Cos",
    entityId: cosId,
    summary: `${current.stageName} ${decision} for ${cos.candidateName ?? cos.jobTitle}`,
    newValue: newStatus,
    reason: comments || null,
  });

  if (newStatus === "Approved") {
    await sendAlert({
      alertType: "cos.approved",
      severity: "info",
      subject: `CoS approved: ${cos.candidateName ?? cos.jobTitle}`,
      body: `Final AO approval granted by ${user.displayName}.`,
      entityType: "Cos",
      entityId: cosId,
    });
  }

  revalidatePath(`/cos/${cosId}`);
  revalidatePath("/cos");
}
