import { prisma } from "./db";
import { daysUntil } from "./dates";

/**
 * Worker compliance score (PRD Module 14 / ICMS-066..068).
 *
 * Weighted across the compliance dimensions the PRD lists. Banding:
 *   Green    95–100 : fully compliant
 *   Amber    80–94  : action required
 *   Red      <80    : significant risk
 *   Critical        : illegal-working risk / expired visa → immediate AO escalation
 *
 * Weights are intentionally simple and centralised so they can later be made
 * configurable by the System Administrator (PRD §17 "Compliance score weighting").
 */

export type RagStatus = "Green" | "Amber" | "Red" | "Critical";

const WEIGHTS = {
  rightToWork: 20,
  visa: 20,
  cos: 15,
  appendixD: 20,
  payroll: 10,
  sms: 10,
  auditFindings: 5,
} as const;

export type ScoreBreakdown = {
  score: number;
  rag: RagStatus;
  critical: boolean;
  factors: { key: string; label: string; weight: number; earned: number; note: string }[];
};

export async function computeWorkerScore(workerId: string): Promise<ScoreBreakdown> {
  const worker = await prisma.worker.findUnique({
    where: { id: workerId },
    include: {
      visas: true,
      rtwChecks: true,
      cosRecords: true,
      appendixD: true,
      reportableEvents: true,
      payrollRecords: true,
    },
  });
  if (!worker) throw new Error("worker not found");

  const factors: ScoreBreakdown["factors"] = [];
  let critical = false;

  // --- Right to work ---
  const latestRtw = worker.rtwChecks.sort(
    (a, b) => +new Date(b.checkDate) - +new Date(a.checkDate),
  )[0];
  {
    const w = WEIGHTS.rightToWork;
    let earned = 0;
    let note = "No RTW check on file";
    if (latestRtw) {
      const d = daysUntil(latestRtw.repeatCheckDate);
      if (latestRtw.status === "Expired" || (d !== null && d < 0)) {
        earned = 0;
        note = "RTW check expired — illegal-working risk";
        critical = true; // ICMS-029/067
      } else if (latestRtw.status === "Unreviewed") {
        earned = w * 0.5;
        note = "RTW check unreviewed";
      } else {
        earned = w;
        note = "RTW check valid";
      }
    }
    factors.push({ key: "rtw", label: "Right to Work", weight: w, earned, note });
  }

  // --- Visa ---
  {
    const w = WEIGHTS.visa;
    const visa = worker.visas.sort((a, b) => +new Date(b.expiryDate) - +new Date(a.expiryDate))[0];
    let earned = 0;
    let note = "No visa record";
    if (visa) {
      const d = daysUntil(visa.expiryDate);
      if (d !== null && d < 0) {
        earned = 0;
        note = "Visa expired — immediate escalation";
        critical = true; // ICMS-067 Critical band
      } else if (d !== null && d <= 30) {
        earned = w * 0.6;
        note = `Visa expires in ${d} days`;
      } else {
        earned = w;
        note = "Visa valid";
      }
    }
    factors.push({ key: "visa", label: "Visa status", weight: w, earned, note });
  }

  // --- CoS validity ---
  {
    const w = WEIGHTS.cos;
    const approved = worker.cosRecords.find((c) =>
      ["Approved", "Assigned", "Used", "Worker Started"].includes(c.status),
    );
    const earned = approved ? w : 0;
    factors.push({
      key: "cos",
      label: "CoS validity",
      weight: w,
      earned,
      note: approved ? `CoS ${approved.cosNumber ?? "(assigned)"}` : "No approved CoS",
    });
  }

  // --- Appendix D completeness ---
  {
    const w = WEIGHTS.appendixD;
    const items = worker.appendixD;
    const required = items.filter((i) => i.required && i.status !== "Not Applicable");
    const ok = required.filter((i) => i.status === "Approved").length;
    const expired = required.some((i) => i.status === "Expired");
    const ratio = required.length ? ok / required.length : 0;
    const earned = Math.round(w * ratio);
    if (expired) critical = critical || false; // expired docs block Compliant but not auto-Critical
    factors.push({
      key: "appendixD",
      label: "Appendix D documents",
      weight: w,
      earned,
      note: `${ok}/${required.length} required documents approved`,
    });
  }

  // --- Payroll ---
  {
    const w = WEIGHTS.payroll;
    const openExceptions = worker.payrollRecords.filter((p) => p.exception && !p.resolved).length;
    const earned = openExceptions === 0 ? w : Math.max(0, w - openExceptions * 4);
    factors.push({
      key: "payroll",
      label: "Payroll compliance",
      weight: w,
      earned,
      note: openExceptions === 0 ? "No open payroll exceptions" : `${openExceptions} open payroll exception(s)`,
    });
  }

  // --- SMS reporting duties ---
  {
    const w = WEIGHTS.sms;
    const open = worker.reportableEvents.filter((e) => e.status !== "Closed");
    const overdue = open.filter((e) => {
      const d = daysUntil(e.reportingDeadline);
      return d !== null && d < 0;
    }).length;
    let earned: number = w;
    if (overdue > 0) {
      earned = 0;
    } else if (open.length > 0) {
      earned = w * 0.6;
    }
    factors.push({
      key: "sms",
      label: "SMS reporting",
      weight: w,
      earned,
      note: overdue > 0 ? `${overdue} overdue reportable event(s)` : open.length ? `${open.length} open event(s)` : "No open events",
    });
  }

  // --- Open audit findings (placeholder: full link in Audit module) ---
  factors.push({
    key: "audit",
    label: "Open audit findings",
    weight: WEIGHTS.auditFindings,
    earned: WEIGHTS.auditFindings,
    note: "No worker-linked findings",
  });

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((s, f) => s + f.earned, 0))));
  const rag = bandFor(score, critical);
  return { score, rag, critical, factors };
}

export function bandFor(score: number, critical: boolean): RagStatus {
  if (critical) return "Critical";
  if (score >= 95) return "Green";
  if (score >= 80) return "Amber";
  return "Red";
}

/** Recompute and persist the worker's score + RAG. Returns the breakdown. */
export async function refreshWorkerScore(workerId: string): Promise<ScoreBreakdown> {
  const breakdown = await computeWorkerScore(workerId);
  await prisma.worker.update({
    where: { id: workerId },
    data: { complianceScore: breakdown.score, ragStatus: breakdown.rag },
  });
  return breakdown;
}
