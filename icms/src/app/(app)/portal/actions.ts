"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser, requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

/**
 * Worker self-service change request (PRD Module 22 / ICMS-091).
 * Captures a worker-submitted update into a Pending queue. No master-record
 * change happens here — all changes require HR/Compliance approval (ICMS-092).
 */
export async function submitSelfServiceRequest(formData: FormData) {
  const user = await requireUser();
  const workerId = String(formData.get("workerId"));
  const field = String(formData.get("field"));
  const newValue = String(formData.get("newValue") ?? "").trim();

  const worker = await prisma.worker.findUnique({ where: { id: workerId } });
  if (!worker) throw new Error("Worker not found");

  const oldValue =
    field === "address" ? worker.address
    : field === "phone" ? worker.phone
    : field === "passport" ? worker.passportNumber
    : null;

  await prisma.selfServiceRequest.create({
    data: {
      workerId,
      workerName: worker.legalName,
      field,
      oldValue: oldValue ?? undefined,
      newValue,
      status: "Pending",
    },
  });

  await recordAudit({
    actor: user,
    action: "selfservice.submit",
    entityType: "SelfServiceRequest",
    entityId: workerId,
    summary: `Self-service update submitted for ${worker.legalName} (${field})`,
    oldValue: oldValue ?? undefined,
    newValue,
  });

  revalidatePath("/portal");
}

/**
 * HR/Compliance review of a pending self-service request (ICMS-092).
 * Approving a request that maps to a real master-record column applies the
 * change to the Worker; other fields (share code / absence / emergency contact)
 * are simply approved as there is no direct column.
 */
export async function reviewSelfServiceRequest(formData: FormData) {
  const user = await requirePermission("selfservice.review");
  const requestId = String(formData.get("requestId"));
  const decision = String(formData.get("decision"));

  const request = await prisma.selfServiceRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new Error("Self-service request not found");

  const now = new Date();

  if (decision === "approve") {
    await prisma.selfServiceRequest.update({
      where: { id: requestId },
      data: { status: "Approved", reviewedBy: user.displayName, reviewedAt: now },
    });

    const masterUpdate =
      request.field === "address" ? { address: request.newValue }
      : request.field === "phone" ? { phone: request.newValue }
      : request.field === "passport" ? { passportNumber: request.newValue }
      : null;

    if (masterUpdate) {
      await prisma.worker.update({ where: { id: request.workerId }, data: masterUpdate });
    }
  } else {
    await prisma.selfServiceRequest.update({
      where: { id: requestId },
      data: { status: "Rejected", reviewedBy: user.displayName, reviewedAt: now },
    });
  }

  await recordAudit({
    actor: user,
    action: "selfservice.review",
    entityType: "SelfServiceRequest",
    entityId: requestId,
    summary: `Self-service request ${decision === "approve" ? "approved" : "rejected"} for ${request.workerName} (${request.field})`,
    oldValue: request.oldValue ?? undefined,
    newValue: decision,
  });

  revalidatePath("/portal");
}
