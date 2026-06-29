"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { SMS_STATUSES } from "@/lib/sms";

/**
 * Advance a reportable event through its lifecycle (PRD Module 11).
 *  - ICMS-054: Identified → Investigated → AO Approved → SMS Submitted → Closed
 *  - ICMS-055: cannot reach Closed without an SMS reference number + evidence
 */
export async function advanceReportableEvent(formData: FormData) {
  const id = String(formData.get("eventId"));
  const smsReference = String(formData.get("smsReference") ?? "").trim();
  const user = await requirePermission("sms.manage");

  const event = await prisma.reportableEvent.findUnique({ where: { id } });
  if (!event) throw new Error("Reportable event not found");

  const idx = SMS_STATUSES.indexOf(event.status as (typeof SMS_STATUSES)[number]);
  if (idx === -1 || idx >= SMS_STATUSES.length - 1) throw new Error("Event already closed");
  const next = SMS_STATUSES[idx + 1];

  // Closing requires an SMS reference (ICMS-055). The transition into "Closed"
  // happens from "SMS Submitted"; capture the reference at the SMS-submitted step.
  if (next === "SMS Submitted" && !smsReference && !event.smsReference) {
    throw new Error("An SMS submission reference number is required before the event can progress (ICMS-055).");
  }

  // Closing is an AO-gated action.
  if (next === "Closed") {
    await requirePermission("sms.close");
    if (!event.smsReference && !smsReference) {
      throw new Error("Cannot close without SMS submission evidence and reference number (ICMS-055).");
    }
  }

  await prisma.reportableEvent.update({
    where: { id },
    data: {
      status: next,
      smsReference: smsReference || event.smsReference,
      closedAt: next === "Closed" ? new Date() : null,
    },
  });

  await recordAudit({
    actor: user,
    action: "sms.advance",
    entityType: "ReportableEvent",
    entityId: id,
    summary: `Reportable event advanced to "${next}"`,
    oldValue: event.status,
    newValue: next,
  });

  if (next === "Closed") {
    await sendAlert({
      alertType: "sms.closed",
      subject: "SMS reportable event closed",
      body: `Event ${id} closed with SMS reference ${smsReference || event.smsReference}.`,
      entityType: "ReportableEvent",
      entityId: id,
    });
  }

  revalidatePath("/sms-reporting");
}
