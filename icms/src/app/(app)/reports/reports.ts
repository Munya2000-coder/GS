import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/dates";

/**
 * Shared report definitions + query helpers for the Reports module (PRD Module 31).
 * Used by both the CSV export route handler and the printable view page so the two
 * always render the same data (ICMS-107: reports include generation metadata).
 */

export type ReportKey =
  | "worker-register"
  | "cos-register"
  | "visa-expiry"
  | "rtw"
  | "appendix-d-missing"
  | "payroll-exception"
  | "sms-status"
  | "risk-register"
  | "capa-status";

export const REPORTS: { key: ReportKey; title: string; description: string }[] = [
  { key: "worker-register", title: "Worker register", description: "All sponsored workers with compliance score and RAG status." },
  { key: "cos-register", title: "CoS register", description: "Certificates of Sponsorship with workflow status and salary." },
  { key: "visa-expiry", title: "Visa expiry", description: "Workers with their visa route and expiry dates." },
  { key: "rtw", title: "Right to work", description: "Right-to-work checks with status and repeat-check dates." },
  { key: "appendix-d-missing", title: "Appendix D gaps", description: "Required Appendix D items that are missing or expired." },
  { key: "payroll-exception", title: "Payroll exceptions", description: "Payroll records flagged with an unresolved exception." },
  { key: "sms-status", title: "SMS reporting status", description: "Reportable events with lifecycle status and deadlines." },
  { key: "risk-register", title: "Risk register", description: "Open and closed risk register entries with mitigation." },
  { key: "capa-status", title: "CAPA status", description: "Corrective and preventive actions with owners and due dates." },
];

export function reportTitle(key: string): string {
  return REPORTS.find((r) => r.key === key)?.title ?? key;
}

export function isReportKey(key: string): key is ReportKey {
  return REPORTS.some((r) => r.key === key);
}

/** Build the rows for a given report. Returns null for an unknown type. */
export async function getReportRows(type: string): Promise<Record<string, unknown>[] | null> {
  switch (type as ReportKey) {
    case "worker-register": {
      const workers = await prisma.worker.findMany({ orderBy: { wcid: "asc" } });
      return workers.map((w) => ({
        wcid: w.wcid,
        legalName: w.legalName,
        jobTitle: w.jobTitle ?? "",
        socCode: w.socCode ?? "",
        workLocation: w.workLocation ?? "",
        sponsorshipStatus: w.sponsorshipStatus,
        complianceScore: w.complianceScore,
        ragStatus: w.ragStatus,
      }));
    }
    case "cos-register": {
      const records = await prisma.cos.findMany({ orderBy: { createdAt: "desc" } });
      return records.map((c) => ({
        cosNumber: c.cosNumber ?? "",
        candidateName: c.candidateName ?? "",
        jobTitle: c.jobTitle,
        socCode: c.socCode,
        salary: c.salary,
        status: c.status,
      }));
    }
    case "visa-expiry": {
      const workers = await prisma.worker.findMany({
        include: { visas: { orderBy: { expiryDate: "asc" } } },
        orderBy: { wcid: "asc" },
      });
      return workers.flatMap((w) =>
        w.visas.length === 0
          ? [{ wcid: w.wcid, legalName: w.legalName, route: "", expiryDate: "" }]
          : w.visas.map((v) => ({
              wcid: w.wcid,
              legalName: w.legalName,
              route: v.route,
              expiryDate: fmtDate(v.expiryDate),
            })),
      );
    }
    case "rtw": {
      const checks = await prisma.rightToWorkCheck.findMany({
        include: { worker: true },
        orderBy: { checkDate: "desc" },
      });
      return checks.map((c) => ({
        wcid: c.worker.wcid,
        legalName: c.worker.legalName,
        checkType: c.checkType,
        checkDate: fmtDate(c.checkDate),
        status: c.status,
        repeatCheckDate: fmtDate(c.repeatCheckDate),
      }));
    }
    case "appendix-d-missing": {
      const items = await prisma.appendixDItem.findMany({
        where: { required: true, status: { in: ["Missing", "Expired"] } },
        include: { worker: true },
        orderBy: { updatedAt: "desc" },
      });
      return items.map((i) => ({
        wcid: i.worker.wcid,
        legalName: i.worker.legalName,
        item: i.label,
        status: i.status,
        expiryDate: fmtDate(i.expiryDate),
      }));
    }
    case "payroll-exception": {
      const records = await prisma.payrollRecord.findMany({
        where: { exception: { not: null } },
        include: { worker: true },
        orderBy: { payPeriod: "desc" },
      });
      return records.map((r) => ({
        wcid: r.worker.wcid,
        legalName: r.worker.legalName,
        payPeriod: r.payPeriod,
        grossPay: r.grossPay,
        expectedGross: r.expectedGross,
        exception: r.exception ?? "",
        resolved: r.resolved ? "Yes" : "No",
      }));
    }
    case "sms-status": {
      const events = await prisma.reportableEvent.findMany({
        include: { worker: true },
        orderBy: { reportingDeadline: "asc" },
      });
      return events.map((e) => ({
        wcid: e.worker?.wcid ?? "",
        worker: e.worker?.legalName ?? "",
        eventType: e.eventType,
        eventDate: fmtDate(e.eventDate),
        reportingDeadline: fmtDate(e.reportingDeadline),
        status: e.status,
        smsReference: e.smsReference ?? "",
      }));
    }
    case "risk-register": {
      const entries = await prisma.riskRegisterEntry.findMany({ orderBy: { createdAt: "desc" } });
      return entries.map((r) => ({
        description: r.description,
        owner: r.owner ?? "",
        likelihood: r.likelihood ?? "",
        impact: r.impact ?? "",
        mitigation: r.mitigation ?? "",
        reviewDate: fmtDate(r.reviewDate),
        status: r.status,
      }));
    }
    case "capa-status": {
      const capas = await prisma.capa.findMany({ orderBy: { createdAt: "desc" } });
      return capas.map((c) => ({
        reference: c.reference,
        rootCause: c.rootCause ?? "",
        correctiveAction: c.correctiveAction ?? "",
        owner: c.owner ?? "",
        dueDate: fmtDate(c.dueDate),
        status: c.status,
      }));
    }
    default:
      return null;
  }
}
