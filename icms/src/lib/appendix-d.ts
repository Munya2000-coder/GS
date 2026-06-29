/**
 * Appendix D document checklist template (PRD Module 12 / ICMS-058).
 * Configurable by the System Administrator to reflect future Home Office
 * guidance changes (ICMS-062) — centralised here as data.
 */
export type AppendixDTemplateItem = { key: string; label: string; required: boolean; tracksExpiry: boolean };

export const APPENDIX_D_TEMPLATE: AppendixDTemplateItem[] = [
  { key: "passport", label: "Passport", required: true, tracksExpiry: true },
  { key: "visa_evisa", label: "Visa / eVisa evidence", required: true, tracksExpiry: true },
  { key: "rtw_check", label: "Right-to-work check", required: true, tracksExpiry: true },
  { key: "contact_details", label: "Contact details", required: true, tracksExpiry: false },
  { key: "address", label: "Address", required: true, tracksExpiry: false },
  { key: "ni_number", label: "National Insurance number", required: true, tracksExpiry: false },
  { key: "employment_contract", label: "Employment contract", required: true, tracksExpiry: true },
  { key: "cos", label: "Certificate of Sponsorship", required: true, tracksExpiry: true },
  { key: "recruitment_evidence", label: "Recruitment evidence", required: true, tracksExpiry: false },
  { key: "qualifications", label: "Qualifications", required: true, tracksExpiry: false },
  { key: "professional_registration", label: "Professional registration (NMC/HCPC)", required: false, tracksExpiry: true },
  { key: "dbs", label: "DBS evidence", required: false, tracksExpiry: true },
  { key: "payslips", label: "Payslips", required: true, tracksExpiry: false },
  { key: "payroll_records", label: "Payroll records", required: true, tracksExpiry: false },
  { key: "p60", label: "P60", required: false, tracksExpiry: false },
  { key: "absence_records", label: "Absence records", required: true, tracksExpiry: false },
  { key: "rotas", label: "Rotas", required: true, tracksExpiry: false },
  { key: "training_records", label: "Training records", required: true, tracksExpiry: false },
  { key: "ho_correspondence", label: "Home Office correspondence", required: false, tracksExpiry: false },
];

// Document status values (ICMS-059).
export const DOC_STATUSES = [
  "Required",
  "Uploaded (pending review)",
  "Approved",
  "Missing",
  "Expired",
  "Not Applicable",
  "Rejected",
] as const;
