import { addDays } from "date-fns";

/**
 * SMS reportable events + deadline calculator (PRD Module 11 / ICMS-052,053,057).
 *
 * Deadline rules are configurable in the PRD ("Deadline rules shall be
 * configurable by the System Administrator"). They are centralised here as data
 * so they can be lifted into the Settings module without code changes.
 */

export type ReportableEventType = {
  key: string;
  label: string;
  /** Working/calendar days from event date to the SMS reporting deadline. */
  deadlineDays: number;
};

// Per current Home Office sponsor guidance: most changes are reportable within
// 10 working days; some sponsor-detail changes within 20. Configurable.
export const REPORTABLE_EVENT_TYPES: ReportableEventType[] = [
  { key: "no_start", label: "Worker does not start", deadlineDays: 10 },
  { key: "start_delayed", label: "Worker start delayed", deadlineDays: 10 },
  { key: "resignation", label: "Resignation", deadlineDays: 10 },
  { key: "dismissal", label: "Dismissal", deadlineDays: 10 },
  { key: "sponsorship_withdrawal", label: "Sponsorship withdrawal", deadlineDays: 10 },
  { key: "salary_change", label: "Salary change", deadlineDays: 10 },
  { key: "job_title_change", label: "Job title change", deadlineDays: 10 },
  { key: "duties_change", label: "Significant duties change", deadlineDays: 10 },
  { key: "location_change", label: "Work location change", deadlineDays: 10 },
  { key: "long_unpaid_leave", label: "Long-term unpaid leave (10+ working days)", deadlineDays: 10 },
  { key: "ownership_change", label: "Business ownership change", deadlineDays: 20 },
  { key: "address_change", label: "Sponsor address change", deadlineDays: 20 },
  { key: "ao_kc_sms_change", label: "AO / Key Contact / SMS user change", deadlineDays: 20 },
];

export function eventTypeLabel(key: string): string {
  return REPORTABLE_EVENT_TYPES.find((t) => t.key === key)?.label ?? key;
}

/** Compute the SMS reporting deadline for an event (ICMS-057 calculator). */
export function calcReportingDeadline(eventKey: string, eventDate: Date): Date {
  const type = REPORTABLE_EVENT_TYPES.find((t) => t.key === eventKey);
  const days = type?.deadlineDays ?? 10;
  return addDays(eventDate, days);
}

// SMS event lifecycle states (ICMS-054).
export const SMS_STATUSES = [
  "Identified",
  "Investigated",
  "AO Approved",
  "SMS Submitted",
  "Closed",
] as const;
