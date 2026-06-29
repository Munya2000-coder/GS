import { prisma } from "./db";

/**
 * System configuration store (PRD §17).
 * Values are JSON-encoded in the Configuration table. `getConfig` returns the
 * stored value or a provided default; `setConfig` upserts and is expected to be
 * called only from approved, audit-logged server actions.
 */

export async function getConfig<T>(category: string, key: string, fallback: T): Promise<T> {
  const row = await prisma.configuration.findUnique({ where: { category_key: { category, key } } });
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export async function setConfig(input: {
  category: string;
  key: string;
  value: unknown;
  label?: string;
  updatedBy?: string;
  approvedBy?: string;
}) {
  return prisma.configuration.upsert({
    where: { category_key: { category: input.category, key: input.key } },
    create: {
      category: input.category,
      key: input.key,
      value: JSON.stringify(input.value),
      label: input.label,
      updatedBy: input.updatedBy,
      approvedBy: input.approvedBy,
      approvedAt: input.approvedBy ? new Date() : null,
    },
    update: {
      value: JSON.stringify(input.value),
      label: input.label,
      updatedBy: input.updatedBy,
      approvedBy: input.approvedBy,
      approvedAt: input.approvedBy ? new Date() : null,
    },
  });
}

// Editable configuration groups surfaced in the Settings UI (PRD §17).
export const CONFIG_GROUPS = [
  {
    category: "salary_thresholds",
    title: "Salary thresholds",
    description: "Immigration floor, NMW, and going rates used by salary-compliance checks (Module 8).",
    fields: [
      { key: "immigration_floor_annual", label: "Immigration salary floor (£/yr)", type: "number", default: 23200 },
      { key: "nmw_hourly", label: "National Minimum Wage (£/hr)", type: "number", default: 11.44 },
      { key: "wtr_max_weekly_hours", label: "WTR max weekly hours", type: "number", default: 48 },
    ],
  },
  {
    category: "alert_periods",
    title: "Expiry alert schedule",
    description: "Days-before-expiry at which reminders fire (ICMS-061/100).",
    fields: [
      { key: "thresholds_days", label: "Alert thresholds (comma-separated days)", type: "text", default: "180,90,60,30,14,7" },
    ],
  },
  {
    category: "score_weights",
    title: "Compliance score weighting",
    description: "Relative weight of each dimension in the worker compliance score (Module 14).",
    fields: [
      { key: "right_to_work", label: "Right to work", type: "number", default: 20 },
      { key: "visa", label: "Visa status", type: "number", default: 20 },
      { key: "appendix_d", label: "Appendix D documents", type: "number", default: 20 },
      { key: "cos", label: "CoS validity", type: "number", default: 15 },
      { key: "payroll", label: "Payroll compliance", type: "number", default: 10 },
      { key: "sms", label: "SMS reporting", type: "number", default: 10 },
    ],
  },
] as const;
