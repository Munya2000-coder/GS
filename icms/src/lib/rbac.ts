// Role-based access control (PRD Module 19 / §13).
// Least-privilege, enforced at both API and UI layers (PRD §10.1).

export type RoleKey =
  | "SYSTEM_ADMIN"
  | "AUTHORISING_OFFICER"
  | "KEY_CONTACT"
  | "LEVEL_1_SMS"
  | "LEVEL_2_SMS"
  | "HR_MANAGER"
  | "HR_OFFICER"
  | "COMPLIANCE_MANAGER"
  | "FINANCE_MANAGER"
  | "CARE_OPS_MANAGER"
  | "LINE_MANAGER"
  | "AUDITOR"
  | "LEGAL_ADVISER"
  | "INSPECTOR"
  | "WORKER_SELF_SERVICE";

export const ROLES: Record<RoleKey, { label: string; description: string }> = {
  SYSTEM_ADMIN: { label: "System Administrator", description: "Full access, configuration, audit export, emergency overrides (with AO approval)" },
  AUTHORISING_OFFICER: { label: "Authorising Officer", description: "Final CoS approval, governance sign-off, inspection packs, escalation receipt" },
  KEY_CONTACT: { label: "Key Contact / Level 1 SMS", description: "SMS reporting, CoS submission, worker file management" },
  LEVEL_1_SMS: { label: "Level 1 SMS User", description: "SMS reporting actions, reporting event creation" },
  LEVEL_2_SMS: { label: "Level 2 SMS User", description: "Limited SMS actions" },
  HR_MANAGER: { label: "HR Manager", description: "Recruitment, worker files, RTW checks, absence, Appendix D" },
  HR_OFFICER: { label: "HR Officer", description: "Worker file maintenance, document upload" },
  COMPLIANCE_MANAGER: { label: "Compliance Manager", description: "Audits, CAPA, risk register, CoS compliance review, document approval" },
  FINANCE_MANAGER: { label: "Finance Manager", description: "Salary compliance, payroll reconciliation, BrightPay import" },
  CARE_OPS_MANAGER: { label: "Care Operations Manager", description: "Rota review, care package evidence, genuine vacancy, CareLineLive" },
  LINE_MANAGER: { label: "Line Manager", description: "Attendance, absence reporting for assigned workers only" },
  AUDITOR: { label: "Auditor (internal)", description: "Read all compliance records, create audits/findings/CAPA" },
  LEGAL_ADVISER: { label: "Legal Adviser (external)", description: "Read-only on assigned matters; upload legal opinions — time-limited" },
  INSPECTOR: { label: "Read-Only Inspector", description: "Read-only inspection-mode output — time-limited (max 72h)" },
  WORKER_SELF_SERVICE: { label: "Worker Self-Service", description: "Own record only: contact updates, document uploads (pending HR approval)" },
};

// Permission keys used throughout the app.
export type Permission =
  | "dashboard.view"
  | "worker.view"
  | "worker.edit"
  | "cos.view"
  | "cos.submit"
  | "cos.approve.hr"
  | "cos.approve.finance"
  | "cos.approve.compliance"
  | "cos.approve.ao"
  | "rtw.view"
  | "rtw.edit"
  | "document.view"
  | "document.upload"
  | "document.approve"
  | "document.delete"
  | "sms.view"
  | "sms.manage"
  | "sms.close"
  | "audittrail.view"
  | "audittrail.export"
  | "governance.manage"
  | "config.manage"
  | "inspection.run";

const ALL: Permission[] = [
  "dashboard.view", "worker.view", "worker.edit", "cos.view", "cos.submit",
  "cos.approve.hr", "cos.approve.finance", "cos.approve.compliance", "cos.approve.ao",
  "rtw.view", "rtw.edit", "document.view", "document.upload", "document.approve",
  "document.delete", "sms.view", "sms.manage", "sms.close", "audittrail.view",
  "audittrail.export", "governance.manage", "config.manage", "inspection.run",
];

// Role → granted permissions. Kept explicit for auditability.
const ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  SYSTEM_ADMIN: ALL,
  AUTHORISING_OFFICER: [
    "dashboard.view", "worker.view", "cos.view", "cos.approve.ao", "rtw.view",
    "document.view", "document.approve", "sms.view", "sms.close", "audittrail.view",
    "audittrail.export", "governance.manage", "inspection.run",
  ],
  KEY_CONTACT: [
    "dashboard.view", "worker.view", "worker.edit", "cos.view", "cos.submit",
    "rtw.view", "rtw.edit", "document.view", "document.upload", "sms.view",
    "sms.manage", "audittrail.view",
  ],
  LEVEL_1_SMS: ["dashboard.view", "worker.view", "cos.view", "cos.submit", "sms.view", "sms.manage", "rtw.view", "document.view"],
  LEVEL_2_SMS: ["dashboard.view", "worker.view", "cos.view", "sms.view", "document.view"],
  HR_MANAGER: [
    "dashboard.view", "worker.view", "worker.edit", "cos.view", "cos.approve.hr",
    "rtw.view", "rtw.edit", "document.view", "document.upload", "document.approve", "sms.view",
  ],
  HR_OFFICER: ["dashboard.view", "worker.view", "worker.edit", "rtw.view", "rtw.edit", "document.view", "document.upload"],
  COMPLIANCE_MANAGER: [
    "dashboard.view", "worker.view", "worker.edit", "cos.view", "cos.approve.compliance",
    "rtw.view", "document.view", "document.approve", "document.delete", "sms.view",
    "sms.manage", "sms.close", "audittrail.view", "audittrail.export", "inspection.run",
  ],
  FINANCE_MANAGER: ["dashboard.view", "worker.view", "cos.view", "cos.approve.finance", "document.view"],
  CARE_OPS_MANAGER: ["dashboard.view", "worker.view", "cos.view", "document.view"],
  LINE_MANAGER: ["dashboard.view", "worker.view", "cos.view", "document.view"],
  AUDITOR: ["dashboard.view", "worker.view", "cos.view", "rtw.view", "document.view", "sms.view", "audittrail.view"],
  LEGAL_ADVISER: ["worker.view", "cos.view", "document.view"],
  INSPECTOR: ["dashboard.view", "worker.view", "cos.view", "rtw.view", "document.view", "sms.view"],
  WORKER_SELF_SERVICE: [],
};

export function parseRoles(roles: string): RoleKey[] {
  return roles
    .split("|")
    .map((r) => r.trim())
    .filter((r): r is RoleKey => r in ROLES);
}

export function permissionsFor(roles: RoleKey[]): Set<Permission> {
  const set = new Set<Permission>();
  for (const role of roles) {
    for (const p of ROLE_PERMISSIONS[role] ?? []) set.add(p);
  }
  return set;
}

export function can(roles: RoleKey[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

// The five CoS approval stages (ICMS-008). Maps stage number → required permission.
export const COS_STAGES: { stage: number; name: string; permission: Permission }[] = [
  { stage: 1, name: "Hiring Manager", permission: "cos.submit" },
  { stage: 2, name: "HR", permission: "cos.approve.hr" },
  { stage: 3, name: "Finance salary review", permission: "cos.approve.finance" },
  { stage: 4, name: "Compliance review", permission: "cos.approve.compliance" },
  { stage: 5, name: "Authorising Officer final approval", permission: "cos.approve.ao" },
];
