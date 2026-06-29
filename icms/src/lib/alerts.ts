import { prisma } from "./db";

/**
 * Pluggable alert delivery (PRD Module 21 / ICMS-088..090).
 *
 * ALERT_MODE=log   — persist to the Alert table + console (default).
 * ALERT_MODE=graph — Microsoft Graph API for M365 email + Teams Adaptive Cards
 *                    (boundary stubbed). On Graph failure the PRD requires local
 *                    queue + retry — modelled by the persisted Alert row.
 */

export type AlertInput = {
  alertType: string;
  severity?: "info" | "warning" | "critical";
  channel?: "dashboard" | "email" | "teams" | "push";
  recipient?: string;
  subject: string;
  body?: string;
  entityType?: string;
  entityId?: string;
};

export async function sendAlert(input: AlertInput) {
  const row = await prisma.alert.create({
    data: {
      alertType: input.alertType,
      severity: input.severity ?? "info",
      channel: input.channel ?? "dashboard",
      recipient: input.recipient,
      subject: input.subject,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId,
    },
  });

  if ((process.env.ALERT_MODE ?? "log") === "graph") {
    // Boundary: dispatch via Microsoft Graph (email) / Teams Adaptive Card.
    // On failure, leave the row unacknowledged for the retry worker to pick up.
  }
  return row;
}
