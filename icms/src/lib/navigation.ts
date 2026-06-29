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
  { label: "Recruitment", href: "/recruitment", iconName: "Briefcase", permission: "worker.view", ready: false },
  { label: "Payroll & Rota", href: "/payroll-rota", iconName: "Wallet", permission: "worker.view", ready: false },
  { label: "Audits & CAPA", href: "/audits-capa", iconName: "ClipboardList", permission: "worker.view", ready: false },
  { label: "Risk Register", href: "/risk-register", iconName: "AlertTriangle", permission: "worker.view", ready: false },
  { label: "Governance", href: "/governance", iconName: "Landmark", permission: "worker.view", ready: false },
  { label: "Inspection Mode", href: "/inspection", iconName: "ScanSearch", permission: "inspection.run", ready: false },
  { label: "Reports", href: "/reports", iconName: "BarChart3", permission: "worker.view", ready: false },
  { label: "Settings", href: "/settings", iconName: "Settings", permission: "config.manage", ready: false },
];
