"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";

/**
 * Close a CAPA (PRD Module 17 / ICMS-076).
 * CAPAs cannot be closed without uploaded evidence and Compliance Manager approval.
 */
export async function closeCapa(formData: FormData) {
  const user = await requirePermission("capa.manage");
  const capaId = String(formData.get("capaId") ?? "").trim();
  const evidence = String(formData.get("evidence") ?? "").trim();

  if (!evidence) {
    throw new Error("CAPAs cannot be closed without uploaded evidence and Compliance Manager approval (ICMS-076).");
  }

  const capa = await prisma.capa.findUnique({ where: { id: capaId } });
  if (!capa) throw new Error("CAPA not found");

  await prisma.capa.update({
    where: { id: capaId },
    data: { status: "Closed", evidence },
  });

  await recordAudit({
    actor: user,
    action: "capa.close",
    entityType: "Capa",
    entityId: capaId,
    summary: `CAPA ${capa.reference} closed with evidence`,
    oldValue: capa.status,
    newValue: "Closed",
  });

  revalidatePath("/audits-capa");
}

/**
 * Close an audit finding (PRD Module 16 / ICMS-074).
 * Evidence-based closure is required. Critical/Major findings require Compliance
 * Manager sign-off — enforced via the `capa.manage` permission.
 */
export async function closeFinding(formData: FormData) {
  const user = await requirePermission("capa.manage");
  const findingId = String(formData.get("findingId") ?? "").trim();
  const closureEvidence = String(formData.get("closureEvidence") ?? "").trim();

  const finding = await prisma.auditFinding.findUnique({ where: { id: findingId } });
  if (!finding) throw new Error("Audit finding not found");

  if (!closureEvidence) {
    throw new Error("Evidence-based closure is required (ICMS-074).");
  }

  await prisma.auditFinding.update({
    where: { id: findingId },
    data: { status: "Closed", closureEvidence },
  });

  await recordAudit({
    actor: user,
    action: "finding.close",
    entityType: "AuditFinding",
    entityId: findingId,
    summary: `Audit finding ${finding.reference} closed with evidence`,
    oldValue: finding.status,
    newValue: "Closed",
  });

  revalidatePath("/audits-capa");
}
