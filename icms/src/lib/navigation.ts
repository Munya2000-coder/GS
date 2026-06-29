import type { Permission } from "./rbac";

export type NavItem = {
  label: string;
  href: string;
  iconName: string; // resolved to a lucide icon client-side (see Sidebar)
  permission?: Permission;
  /** true once the module is fully implemented in this build; others are scaffolded placeholders. */
  ready: boolean;
};

// Left-side navigation (PRD §8.2). `ready` marks the vertical-slice MVP modules.
export const NAV: NavItem[] = [
  { label: "Dashboard", href: "/", iconName: "LayoutDashboard", permission: "dashboard.view", ready: true },
  { label: "Sponsored Workers", href: "/workers", iconName: "Users", permission: "worker.view", ready: true },
  { label: "CoS Management", href: "/cos", iconName: "FileCheck2", permission: "cos.view", ready: true },
  { label: "Right to Work", href: "/right-to-work", iconName: "ShieldCheck", permission: "rtw.view", ready: true },
  { label: "Documents", href: "/documents", iconName: "FolderOpen", permission: "document.view", ready: true },
  { label: "SMS Reporting", href: "/sms-reporting", iconName: "Send", permission: "sms.view", ready: true },
  { label: "Audit Trail", href: "/audit-trail", iconName: "ClipboardCheck", permission: "audittrail.view", ready: true },
  { label: "Recruitment", href: "/recruitment", iconName: "Briefcase", permission: "recruitment.view", ready: true },
  { label: "Payroll & Rota", href: "/payroll-rota", iconName: "Wallet", permission: "payroll.view", ready: true },
  { label: "Audits & CAPA", href: "/audits-capa", iconName: "ClipboardList", permission: "worker.view", ready: true },
  { label: "Risk Register", href: "/risk-register", iconName: "AlertTriangle", permission: "worker.view", ready: true },
  { label: "Governance", href: "/governance", iconName: "Landmark", permission: "worker.view", ready: true },
  { label: "Inspection Mode", href: "/inspection", iconName: "ScanSearch", permission: "inspection.run", ready: true },
  { label: "Reports", href: "/reports", iconName: "BarChart3", permission: "reports.view", ready: true },
  { label: "AI Review", href: "/ai-review", iconName: "Sparkles", permission: "ai.review", ready: true },
  { label: "CQC Mapping", href: "/cqc", iconName: "HeartPulse", permission: "cqc.view", ready: true },
  { label: "Policies", href: "/policies", iconName: "BookCheck", permission: "policy.view", ready: true },
  { label: "Self-Service", href: "/portal", iconName: "UserCircle", permission: "selfservice.review", ready: true },
  { label: "Settings", href: "/settings", iconName: "Settings", permission: "config.manage", ready: true },
];
