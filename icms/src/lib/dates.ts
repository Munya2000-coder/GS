import { differenceInCalendarDays, format } from "date-fns";

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy");
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return format(new Date(d), "dd MMM yyyy HH:mm");
}

export function daysUntil(d: Date | string | null | undefined): number | null {
  if (!d) return null;
  return differenceInCalendarDays(new Date(d), new Date());
}

// Standard ICMS expiry-alert schedule (PRD ICMS-061/100): 180, 90, 60, 30, 14, 7, 0...
export const ALERT_THRESHOLDS = [180, 90, 60, 30, 14, 7, 0];

/** Returns the RAG band for a days-until-expiry value. */
export function expiryRag(days: number | null): "Green" | "Amber" | "Red" | "Critical" {
  if (days === null) return "Amber";
  if (days < 0) return "Critical";
  if (days <= 30) return "Red";
  if (days <= 90) return "Amber";
  return "Green";
}
