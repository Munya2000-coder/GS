import type { ComputedRecord, CqcDomain, RagStatus, Staff } from "../data/types";
import { CQC_DOMAINS } from "./domain";

export interface RagCounts {
  green: number;
  amber: number;
  red: number;
  na: number;
  total: number;
}

export function ragCounts(records: ComputedRecord[]): RagCounts {
  const c: RagCounts = { green: 0, amber: 0, red: 0, na: 0, total: 0 };
  for (const r of records) {
    if (r.rag === "grey") continue;
    c.total++;
    if (r.rag === "green") c.green++;
    else if (r.rag === "amber") c.amber++;
    else if (r.rag === "red") c.red++;
    else c.na++;
  }
  return c;
}

/** Compliance % = green / (all applicable records). */
export function compliancePct(records: ComputedRecord[]): number {
  const c = ragCounts(records);
  if (c.total === 0) return 100;
  return Math.round((c.green / c.total) * 100);
}

export function pendingApprovals(records: ComputedRecord[]): ComputedRecord[] {
  return records.filter((r) => r.approval === "pending");
}

export function overdue(records: ComputedRecord[]): ComputedRecord[] {
  return records
    .filter((r) => r.rag === "red")
    .sort((a, b) => (a.daysToExpiry ?? 0) - (b.daysToExpiry ?? 0));
}

export function dueSoon(records: ComputedRecord[]): ComputedRecord[] {
  return records
    .filter((r) => r.rag === "amber" && r.recordStatus === "due_soon")
    .sort((a, b) => (a.daysToExpiry ?? 999) - (b.daysToExpiry ?? 999));
}

export function missingEvidence(records: ComputedRecord[]): ComputedRecord[] {
  return records.filter((r) => r.module.evidenceRequired && !r.evidence);
}

export function byDomain(records: ComputedRecord[]) {
  return CQC_DOMAINS.map((d) => {
    const subset = records.filter((r) => r.module.cqcDomain === (d.key as CqcDomain));
    return { domain: d.key, color: d.color, pct: compliancePct(subset), counts: ragCounts(subset) };
  });
}

export function byStaff(records: ComputedRecord[], staff: Staff[]) {
  return staff
    .filter((s) => s.employmentStatus !== "Left")
    .map((s) => {
      const subset = records.filter((r) => r.staffId === s.id);
      return { staff: s, pct: compliancePct(subset), counts: ragCounts(subset) };
    })
    .sort((a, b) => a.pct - b.pct);
}

export function byCategory(records: ComputedRecord[]) {
  const cats = Array.from(new Set(records.map((r) => r.module.category)));
  return cats.map((cat) => {
    const subset = records.filter((r) => r.module.category === cat);
    return { category: cat, pct: compliancePct(subset), counts: ragCounts(subset) };
  });
}

export function ragColor(rag: RagStatus): string {
  return { green: "#16a34a", amber: "#d97706", red: "#dc2626", grey: "#94a3b8", na: "#94a3b8" }[rag];
}
