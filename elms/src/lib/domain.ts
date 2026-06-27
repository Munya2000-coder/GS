import type {
  CqcDomain,
  RagStatus,
  RecordStatus,
  RefreshFrequency,
  RoleKey,
  TrainingRecord,
} from "../data/types";

/* Fixed "today" so the seeded data tells a consistent story. */
export const TODAY = new Date("2026-06-27T09:00:00Z");

export const DUE_SOON_DAYS = 60; // amber window

export const ROLE_LABELS: Record<RoleKey, string> = {
  registered_manager: "Registered Manager",
  compliance_lead: "Compliance Lead",
  training_manager: "Training Manager",
  senior_carer: "Senior Carer",
  care_worker: "Care Worker",
  livein_carer: "Live-in Carer",
  personal_assistant: "Personal Assistant",
  office_admin: "Office / Admin",
  director: "Director",
  cqc_reviewer: "CQC Reviewer",
};

export const CQC_DOMAINS: { key: CqcDomain; color: string; blurb: string }[] = [
  { key: "Safe", color: "#16a34a", blurb: "Protected from abuse and avoidable harm" },
  { key: "Effective", color: "#2563eb", blurb: "Care achieves good outcomes" },
  { key: "Caring", color: "#db2777", blurb: "Staff treat people with compassion" },
  { key: "Responsive", color: "#d97706", blurb: "Services meet people's needs" },
  { key: "Well-Led", color: "#7c3aed", blurb: "Leadership, governance and culture" },
];

export function cqcColor(d: CqcDomain): string {
  return CQC_DOMAINS.find((x) => x.key === d)?.color ?? "#94a3b8";
}

export const RAG_META: Record<RagStatus, { label: string; color: string; bg: string; ink: string }> =
  {
    green: { label: "In date", color: "#16a34a", bg: "var(--green-bg)", ink: "var(--green-ink)" },
    amber: { label: "Due soon", color: "#d97706", bg: "var(--amber-bg)", ink: "var(--amber-ink)" },
    red: { label: "Overdue", color: "#dc2626", bg: "var(--red-bg)", ink: "var(--red-ink)" },
    grey: { label: "Not applicable", color: "#94a3b8", bg: "var(--grey-bg)", ink: "var(--grey-ink)" },
    na: { label: "Awaiting data", color: "#94a3b8", bg: "var(--grey-bg)", ink: "var(--grey-ink)" },
  };

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function parse(d: string | null): Date | null {
  return d ? new Date(d + (d.length === 10 ? "T00:00:00Z" : "")) : null;
}

export function daysToExpiry(expiry: string | null): number | null {
  const e = parse(expiry);
  return e ? daysBetween(TODAY, e) : null;
}

/** Core RAG engine: derive a record's status from its dates + approval. */
export function computeRag(record: TrainingRecord): {
  rag: RagStatus;
  recordStatus: RecordStatus;
  days: number | null;
} {
  if (record.approval === "pending" || record.approval === "returned") {
    return { rag: "amber", recordStatus: "due_soon", days: daysToExpiry(record.expiryDate) };
  }
  if (!record.completionDate) {
    return { rag: "na", recordStatus: "not_started", days: null };
  }
  const d = daysToExpiry(record.expiryDate);
  if (d === null) {
    // completed, no expiry (once-only) → green
    return { rag: "green", recordStatus: "completed", days: null };
  }
  if (d < 0) return { rag: "red", recordStatus: "overdue", days: d };
  if (d <= DUE_SOON_DAYS) return { rag: "amber", recordStatus: "due_soon", days: d };
  return { rag: "green", recordStatus: "completed", days: d };
}

export function addByFrequency(from: Date, freq: RefreshFrequency): Date | null {
  const d = new Date(from);
  switch (freq) {
    case "Once only":
      return null;
    case "Every 6 months":
      d.setMonth(d.getMonth() + 6);
      return d;
    case "Annual":
      d.setFullYear(d.getFullYear() + 1);
      return d;
    case "Every 2 years":
      d.setFullYear(d.getFullYear() + 2);
      return d;
    case "Every 3 years":
      d.setFullYear(d.getFullYear() + 3);
      return d;
  }
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = parse(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateLong(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = parse(d);
  if (!dt) return "—";
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export function relativeExpiry(days: number | null): string {
  if (days === null) return "No expiry";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

export function initials(first: string, last: string): string {
  return (first[0] ?? "") + (last[0] ?? "");
}

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
