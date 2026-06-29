/**
 * Recruitment evidence checklist (PRD Module 4 / ICMS-020).
 * The set of documents that must be present for every sponsored worker.
 */
export type RecruitmentItem = { key: string; label: string };

export const RECRUITMENT_ITEMS: RecruitmentItem[] = [
  { key: "advert", label: "Job advert" },
  { key: "job_description", label: "Job description" },
  { key: "person_spec", label: "Person specification" },
  { key: "application_form", label: "Application form" },
  { key: "cv", label: "CV" },
  { key: "interview_notes", label: "Interview notes" },
  { key: "scoring_matrix", label: "Scoring matrix" },
  { key: "selection_justification", label: "Selection justification" },
  { key: "references", label: "References" },
  { key: "qualifications", label: "Qualifications" },
  { key: "professional_registration", label: "Professional registration" },
  { key: "dbs", label: "DBS evidence" },
];

export type RecruitmentStatus = "Approved" | "Uploaded" | "Missing";

export function parseItems(json: string): Record<string, RecruitmentStatus> {
  try {
    return JSON.parse(json) as Record<string, RecruitmentStatus>;
  } catch {
    return {};
  }
}

export function recruitmentCompleteness(items: Record<string, RecruitmentStatus>): {
  approved: number;
  total: number;
  missing: string[];
} {
  const missing = RECRUITMENT_ITEMS.filter((i) => (items[i.key] ?? "Missing") === "Missing").map((i) => i.label);
  const approved = RECRUITMENT_ITEMS.filter((i) => items[i.key] === "Approved").length;
  return { approved, total: RECRUITMENT_ITEMS.length, missing };
}
