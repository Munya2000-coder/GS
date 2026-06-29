"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts";
import { parseCsv } from "@/lib/csv";

const REQUIRED_COLUMNS = ["wcid", "period", "grossPay", "hoursPaid"] as const;

/**
 * Import a monthly BrightPay payroll export and reconcile it against CoS salary
 * (PRD Module 9 / ICMS-039, ICMS-040).
 *
 * All-or-nothing (ICMS-088): the entire batch is validated up front and rejected
 * with a specific reason before any database write happens.
 */
export async function importBrightPay(formData: FormData) {
  const user = await requirePermission("payroll.manage");

  const csv = String(formData.get("csv") ?? "");
  const rows = parseCsv(csv);
  if (rows.length === 0) {
    throw new Error("BrightPay import rejected: no data rows found.");
  }

  // Validate header columns are all present (ICMS-088, all-or-nothing).
  const headerKeys = Object.keys(rows[0]);
  const missingColumns = REQUIRED_COLUMNS.filter((c) => !headerKeys.includes(c));
  if (missingColumns.length > 0) {
    throw new Error(
      `BrightPay import rejected: missing required column(s) ${missingColumns.join(", ")}. Expected header: ${REQUIRED_COLUMNS.join(", ")}.`,
    );
  }

  // Pre-validate every row (parse + worker lookup) before writing anything.
  type Parsed = { wcid: string; period: string; grossPay: number; hoursPaid: number };
  const parsed: Parsed[] = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2; // +1 for header, +1 for 1-based
    const wcid = (r.wcid ?? "").trim();
    const period = (r.period ?? "").trim();
    if (!wcid) throw new Error(`BrightPay import rejected: missing wcid on row ${line}.`);
    if (!period) throw new Error(`BrightPay import rejected: missing period on row ${line}.`);

    const grossPay = parseFloat(r.grossPay);
    if (Number.isNaN(grossPay)) {
      throw new Error(`BrightPay import rejected: grossPay "${r.grossPay}" on row ${line} is not a number.`);
    }
    const hoursPaid = parseFloat(r.hoursPaid);
    if (Number.isNaN(hoursPaid)) {
      throw new Error(`BrightPay import rejected: hoursPaid "${r.hoursPaid}" on row ${line} is not a number.`);
    }
    parsed.push({ wcid, period, grossPay, hoursPaid });
  }

  // Resolve all workers up front; reject the whole batch if any WCID is unknown.
  const resolved = await Promise.all(
    parsed.map(async (p) => {
      const worker = await prisma.worker.findUnique({ where: { wcid: p.wcid } });
      if (!worker) {
        throw new Error(`BrightPay import rejected: no worker found for WCID ${p.wcid}.`);
      }
      const expectedGross = Math.round(((worker.salary ?? 0) / 12) * 100) / 100;
      const exception = p.grossPay < expectedGross * 0.99 ? "Underpayment against CoS salary" : null;
      return { ...p, workerId: worker.id, expectedGross, exception };
    }),
  );

  // Persist the validated batch.
  for (const row of resolved) {
    const existing = await prisma.payrollRecord.findFirst({
      where: { workerId: row.workerId, payPeriod: row.period },
    });
    const data = {
      grossPay: row.grossPay,
      hoursPaid: row.hoursPaid,
      expectedGross: row.expectedGross,
      exception: row.exception,
      resolved: false,
    };
    if (existing) {
      await prisma.payrollRecord.update({ where: { id: existing.id }, data });
    } else {
      await prisma.payrollRecord.create({
        data: { workerId: row.workerId, payPeriod: row.period, ...data },
      });
    }
  }

  // One reconciliation per period — the import covers a single period in practice,
  // but group defensively in case rows span periods.
  const periods = Array.from(new Set(resolved.map((r) => r.period)));
  for (const period of periods) {
    const inPeriod = resolved.filter((r) => r.period === period);
    const totalRecords = inPeriod.length;
    const exceptionsCount = inPeriod.filter((r) => r.exception).length;

    const existing = await prisma.payrollReconciliation.findFirst({ where: { period } });
    if (existing) {
      await prisma.payrollReconciliation.update({
        where: { id: existing.id },
        data: { runAt: new Date(), runBy: user.displayName, totalRecords, exceptionsCount, status: "Completed" },
      });
    } else {
      await prisma.payrollReconciliation.create({
        data: { period, runBy: user.displayName, totalRecords, exceptionsCount, status: "Completed" },
      });
    }

    await recordAudit({
      actor: user,
      action: "payroll.import",
      entityType: "PayrollReconciliation",
      summary: `BrightPay import: ${totalRecords} records, ${exceptionsCount} exceptions for ${period}`,
    });
  }

  revalidatePath("/payroll-rota");
}

/**
 * Resolve a payroll exception with a documented investigation (PRD ICMS-042).
 * Closure is blocked unless an investigation note is supplied.
 */
export async function resolvePayrollException(formData: FormData) {
  const user = await requirePermission("payroll.manage");

  const recordId = String(formData.get("recordId") ?? "");
  const investigation = String(formData.get("investigation") ?? "").trim();
  if (!investigation) {
    throw new Error("A documented investigation is required before a payroll exception can be closed (ICMS-042).");
  }

  await prisma.payrollRecord.update({
    where: { id: recordId },
    data: { resolved: true, investigation, resolvedBy: user.displayName },
  });

  await recordAudit({
    actor: user,
    action: "payroll.exception.resolve",
    entityType: "PayrollRecord",
    entityId: recordId,
    summary: `Payroll exception resolved with documented investigation`,
  });

  revalidatePath("/payroll-rota");
}

/**
 * Re-run reconciliation for a period and escalate any unresolved discrepancies
 * to the Authorising Officer (PRD ICMS-043/044).
 */
export async function runReconciliation(formData: FormData) {
  const user = await requirePermission("payroll.manage");

  let period = String(formData.get("period") ?? "").trim();
  if (!period) {
    const latest = await prisma.payrollRecord.findFirst({ orderBy: { createdAt: "desc" } });
    period = latest?.payPeriod ?? "";
  }
  if (!period) throw new Error("No payroll period available to reconcile.");

  const records = await prisma.payrollRecord.findMany({ where: { payPeriod: period } });
  const totalRecords = records.length;
  const exceptionsCount = records.filter((r) => r.exception).length;
  const unresolved = records.filter((r) => r.exception && !r.resolved).length;

  const existing = await prisma.payrollReconciliation.findFirst({ where: { period } });
  if (existing) {
    await prisma.payrollReconciliation.update({
      where: { id: existing.id },
      data: { runAt: new Date(), runBy: user.displayName, totalRecords, exceptionsCount, status: "Completed" },
    });
  } else {
    await prisma.payrollReconciliation.create({
      data: { period, runBy: user.displayName, totalRecords, exceptionsCount, status: "Completed" },
    });
  }

  if (unresolved > 0) {
    await sendAlert({
      alertType: "payroll.escalation",
      severity: "warning",
      subject: "Payroll discrepancies unresolved",
      body: "Escalated to Authorising Officer (ICMS-043).",
      channel: "email",
    });
  }

  await recordAudit({
    actor: user,
    action: "payroll.reconcile",
    entityType: "PayrollReconciliation",
    summary: `Reconciliation re-run for ${period}: ${exceptionsCount} exceptions, ${unresolved} unresolved`,
  });

  revalidatePath("/payroll-rota");
}
