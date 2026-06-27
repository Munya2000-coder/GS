/* ===========================================================================
   ELMS Training Management System — domain model
   =========================================================================== */

export type CqcDomain = "Safe" | "Effective" | "Caring" | "Responsive" | "Well-Led";

export type RagStatus = "green" | "amber" | "red" | "grey" | "na";

export type RoleKey =
  | "registered_manager"
  | "compliance_lead"
  | "training_manager"
  | "senior_carer"
  | "care_worker"
  | "livein_carer"
  | "personal_assistant"
  | "office_admin"
  | "director"
  | "cqc_reviewer";

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: RoleKey;
  roleLabel: string;
  avatarColor: string;
}

export type ContractType = "Full-time" | "Part-time" | "Bank" | "Live-in" | "Agency";
export type EmploymentStatus = "Active" | "On leave" | "Onboarding" | "Left";

export interface Staff {
  id: string;
  firstName: string;
  lastName: string;
  role: RoleKey;
  roleLabel: string;
  email: string;
  phone: string;
  startDate: string; // ISO
  contractType: ContractType;
  employmentStatus: EmploymentStatus;
  dbsCheckDate: string;
  dbsExpiry: string;
  rightToWorkExpiry: string;
  visaExpiry?: string | null;
  managerId: string | null;
  branch: string;
  avatarColor: string;
  notes?: string;
}

export type TrainingCategory =
  | "Mandatory Induction"
  | "Mandatory Ongoing"
  | "Role-Specific Training"
  | "Specialist Care Training"
  | "Manager / Leadership"
  | "Compliance & Governance";

export type RefreshFrequency =
  | "Once only"
  | "Annual"
  | "Every 2 years"
  | "Every 3 years"
  | "Every 6 months";

export type DeliveryMode = "eLearning" | "Classroom" | "External provider" | "Blended";

export interface TrainingModule {
  id: string;
  code: string;
  title: string;
  category: TrainingCategory;
  cqcDomain: CqcDomain;
  refresh: RefreshFrequency;
  mandatory: boolean;
  delivery: DeliveryMode;
  appliesTo: RoleKey[]; // [] = all roles
  evidenceRequired: boolean;
  provider?: string;
  retired?: boolean;
  description: string;
}

export type RecordStatus = "completed" | "due_soon" | "overdue" | "not_started" | "na";
export type ApprovalStatus = "approved" | "pending" | "rejected" | "returned" | "none";

export interface TrainingRecord {
  id: string;
  staffId: string;
  moduleId: string;
  completionDate: string | null;
  expiryDate: string | null;
  approval: ApprovalStatus;
  evidence: Evidence | null;
  notes?: string;
}

export interface Evidence {
  id: string;
  fileName: string;
  fileType: "PDF" | "JPG" | "PNG" | "DOCX";
  uploadedBy: string;
  uploadedAt: string;
  verified: boolean;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  entity: string;
  field?: string;
  previous?: string;
  next?: string;
  category: "training" | "evidence" | "staff" | "matrix" | "review" | "report" | "access";
}

export interface AnnualReview {
  id: string;
  reviewDate: string;
  reviewedBy: string;
  scope: string;
  changes: string;
  domains: CqcDomain[];
  nextReviewDue: string;
  status: "Approved" | "Draft" | "Awaiting sign-off";
}

export interface NotificationItem {
  id: string;
  type: "expiry" | "approval" | "review" | "escalation" | "booking" | "system";
  title: string;
  body: string;
  time: string;
  read: boolean;
  channel: ("Email" | "SMS" | "In-system")[];
  priority: "high" | "medium" | "low";
}

/* Computed status for a record at render time */
export interface ComputedRecord extends TrainingRecord {
  module: TrainingModule;
  staff: Staff;
  rag: RagStatus;
  recordStatus: RecordStatus;
  daysToExpiry: number | null;
}
