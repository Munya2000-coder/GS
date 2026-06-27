import type {
  AnnualReview,
  AuditEntry,
  NotificationItem,
  Staff,
  TrainingModule,
  TrainingRecord,
} from "./types";
import { ROLE_LABELS, TODAY, addByFrequency, iso, parse } from "../lib/domain";

/* ------------------------------------------------------------------ */
/* Training module catalogue (the configurable CQC matrix)            */
/* ------------------------------------------------------------------ */
export const MODULES: TrainingModule[] = [
  { id: "m-induction", code: "IND-01", title: "Care Certificate Induction", category: "Mandatory Induction", cqcDomain: "Effective", refresh: "Once only", mandatory: true, delivery: "Blended", appliesTo: [], evidenceRequired: true, provider: "ELMS Internal", description: "15-standard Care Certificate covering the foundations of safe, effective care for all new starters." },
  { id: "m-safeguard-a", code: "SG-ADL", title: "Safeguarding Adults (Level 2)", category: "Mandatory Ongoing", cqcDomain: "Safe", refresh: "Annual", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: true, provider: "ELMS Internal", description: "Recognising, responding to and reporting abuse and neglect of adults at risk." },
  { id: "m-safeguard-c", code: "SG-CHD", title: "Safeguarding Children (Level 2)", category: "Mandatory Ongoing", cqcDomain: "Safe", refresh: "Every 2 years", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: true, provider: "ELMS Internal", description: "Duties to protect children in households where care is delivered." },
  { id: "m-moving", code: "MH-01", title: "Moving & Handling", category: "Mandatory Ongoing", cqcDomain: "Safe", refresh: "Annual", mandatory: true, delivery: "Classroom", appliesTo: [], evidenceRequired: true, provider: "SafeLift Training", description: "Safe people-handling techniques and use of equipment to prevent injury." },
  { id: "m-bls", code: "BLS-01", title: "Basic Life Support & First Aid", category: "Mandatory Ongoing", cqcDomain: "Safe", refresh: "Annual", mandatory: true, delivery: "Classroom", appliesTo: [], evidenceRequired: true, provider: "St John Ambulance", description: "CPR, choking and emergency first aid for the care setting." },
  { id: "m-infection", code: "IPC-01", title: "Infection Prevention & Control", category: "Mandatory Ongoing", cqcDomain: "Safe", refresh: "Annual", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: true, provider: "ELMS Internal", description: "Hand hygiene, PPE and preventing the spread of infection." },
  { id: "m-medication", code: "MED-01", title: "Safe Administration of Medication", category: "Specialist Care Training", cqcDomain: "Effective", refresh: "Annual", mandatory: true, delivery: "Blended", appliesTo: ["senior_carer", "care_worker", "livein_carer", "registered_manager"], evidenceRequired: true, provider: "MedCare Academy", description: "Safe handling, administration and recording of medication (MAR charts)." },
  { id: "m-mca", code: "MCA-01", title: "Mental Capacity Act & DoLS", category: "Mandatory Ongoing", cqcDomain: "Caring", refresh: "Every 2 years", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: true, provider: "ELMS Internal", description: "Capacity assessment, best-interest decisions and Deprivation of Liberty Safeguards." },
  { id: "m-dignity", code: "PCC-01", title: "Person-Centred Care & Dignity", category: "Mandatory Ongoing", cqcDomain: "Caring", refresh: "Every 2 years", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: false, provider: "ELMS Internal", description: "Promoting dignity, choice, privacy and independence." },
  { id: "m-equality", code: "EDI-01", title: "Equality, Diversity & Inclusion", category: "Mandatory Ongoing", cqcDomain: "Responsive", refresh: "Every 2 years", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: false, provider: "ELMS Internal", description: "Anti-discriminatory practice and inclusive care." },
  { id: "m-fire", code: "FS-01", title: "Fire Safety Awareness", category: "Mandatory Ongoing", cqcDomain: "Safe", refresh: "Annual", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: false, provider: "ELMS Internal", description: "Fire prevention, evacuation and use of extinguishers." },
  { id: "m-foodhyg", code: "FH-01", title: "Food Hygiene & Nutrition", category: "Role-Specific Training", cqcDomain: "Effective", refresh: "Every 3 years", mandatory: false, delivery: "eLearning", appliesTo: ["care_worker", "livein_carer", "senior_carer"], evidenceRequired: false, provider: "ELMS Internal", description: "Safe food preparation and supporting good nutrition and hydration." },
  { id: "m-dementia", code: "DEM-01", title: "Dementia Care Awareness", category: "Specialist Care Training", cqcDomain: "Caring", refresh: "Every 2 years", mandatory: false, delivery: "Blended", appliesTo: ["care_worker", "livein_carer", "senior_carer"], evidenceRequired: true, provider: "Dementia UK", description: "Understanding dementia and delivering compassionate, tailored support." },
  { id: "m-peg", code: "PEG-01", title: "PEG Feeding Competency", category: "Specialist Care Training", cqcDomain: "Effective", refresh: "Annual", mandatory: false, delivery: "External provider", appliesTo: ["senior_carer", "livein_carer"], evidenceRequired: true, provider: "District Nursing Team", description: "Safe percutaneous endoscopic gastrostomy feeding for specific care packages." },
  { id: "m-epilepsy", code: "EPI-01", title: "Epilepsy & Buccal Midazolam", category: "Specialist Care Training", cqcDomain: "Effective", refresh: "Annual", mandatory: false, delivery: "External provider", appliesTo: ["senior_carer", "livein_carer", "care_worker"], evidenceRequired: true, provider: "Epilepsy Action", description: "Seizure management and administration of rescue medication." },
  { id: "m-positive", code: "PBS-01", title: "Positive Behaviour Support", category: "Specialist Care Training", cqcDomain: "Caring", refresh: "Every 2 years", mandatory: false, delivery: "Classroom", appliesTo: ["senior_carer", "care_worker"], evidenceRequired: true, provider: "BILD", description: "Proactive, least-restrictive approaches to behaviours of distress." },
  { id: "m-lead", code: "LDR-01", title: "Leadership & Management in Care", category: "Manager / Leadership", cqcDomain: "Well-Led", refresh: "Every 3 years", mandatory: true, delivery: "Blended", appliesTo: ["registered_manager", "compliance_lead", "training_manager", "senior_carer"], evidenceRequired: true, provider: "Skills for Care", description: "Leading teams, governance and continuous improvement." },
  { id: "m-supervision", code: "SUP-01", title: "Effective Supervision & Appraisal", category: "Manager / Leadership", cqcDomain: "Well-Led", refresh: "Annual", mandatory: false, delivery: "eLearning", appliesTo: ["registered_manager", "compliance_lead", "senior_carer"], evidenceRequired: false, provider: "ELMS Internal", description: "Conducting meaningful supervisions and appraisals." },
  { id: "m-gdpr", code: "GOV-01", title: "GDPR & Data Protection", category: "Compliance & Governance", cqcDomain: "Well-Led", refresh: "Annual", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: false, provider: "ELMS Internal", description: "Handling personal and special-category data lawfully." },
  { id: "m-whistle", code: "GOV-02", title: "Whistleblowing & Duty of Candour", category: "Compliance & Governance", cqcDomain: "Well-Led", refresh: "Every 2 years", mandatory: true, delivery: "eLearning", appliesTo: [], evidenceRequired: false, provider: "ELMS Internal", description: "Raising concerns and being open when things go wrong." },
];

/* ------------------------------------------------------------------ */
/* Staff register                                                     */
/* ------------------------------------------------------------------ */
const COLORS = [
  "#0f766e", "#2563eb", "#db2777", "#d97706", "#7c3aed",
  "#0891b2", "#dc2626", "#16a34a", "#9333ea", "#ea580c",
  "#0284c7", "#65a30d", "#c026d3", "#0d9488", "#e11d48",
];

function color(i: number) {
  return COLORS[i % COLORS.length];
}

const rawStaff: Array<
  Pick<Staff, "firstName" | "lastName" | "role"> & {
    contract: Staff["contractType"];
    status?: Staff["employmentStatus"];
    branch?: string;
    manager?: string | null;
    start: string;
    dbs: string;
    rtw: string;
    visa?: string | null;
  }
> = [
  { firstName: "Amara", lastName: "Okafor", role: "registered_manager", contract: "Full-time", branch: "Head Office", manager: null, start: "2019-03-04", dbs: "2025-09-12", rtw: "2030-01-01" },
  { firstName: "David", lastName: "Mensah", role: "compliance_lead", contract: "Full-time", branch: "Head Office", manager: "s1", start: "2020-06-15", dbs: "2025-11-20", rtw: "2029-05-01" },
  { firstName: "Priya", lastName: "Sharma", role: "training_manager", contract: "Full-time", branch: "Head Office", manager: "s1", start: "2021-01-11", dbs: "2026-02-01", rtw: "2031-08-01" },
  { firstName: "Grace", lastName: "Adeyemi", role: "senior_carer", contract: "Full-time", branch: "North Team", manager: "s1", start: "2021-09-01", dbs: "2025-08-04", rtw: "2028-03-15", visa: "2027-09-01" },
  { firstName: "Tomasz", lastName: "Kowalski", role: "senior_carer", contract: "Full-time", branch: "South Team", manager: "s1", start: "2022-02-14", dbs: "2026-04-22", rtw: "2030-11-01" },
  { firstName: "Fatima", lastName: "Ali", role: "care_worker", contract: "Part-time", branch: "North Team", manager: "s4", start: "2023-05-08", dbs: "2026-07-30", rtw: "2027-12-01" },
  { firstName: "James", lastName: "Whitfield", role: "care_worker", contract: "Full-time", branch: "South Team", manager: "s5", start: "2022-11-21", dbs: "2025-07-10", rtw: "2029-01-01" },
  { firstName: "Chloe", lastName: "Bennett", role: "care_worker", contract: "Bank", branch: "North Team", manager: "s4", start: "2024-01-15", dbs: "2026-09-01", rtw: "2030-06-01" },
  { firstName: "Mohammed", lastName: "Rahman", role: "livein_carer", contract: "Live-in", branch: "Live-in Team", manager: "s5", start: "2021-07-19", dbs: "2025-10-05", rtw: "2028-08-01", visa: "2026-08-12" },
  { firstName: "Sofia", lastName: "Marchetti", role: "livein_carer", contract: "Live-in", branch: "Live-in Team", manager: "s5", start: "2023-03-27", dbs: "2026-06-10", rtw: "2026-09-30", visa: "2026-09-30" },
  { firstName: "Daniel", lastName: "Owusu", role: "care_worker", contract: "Full-time", branch: "South Team", manager: "s5", start: "2024-09-02", status: "Onboarding", dbs: "2026-05-18", rtw: "2031-02-01" },
  { firstName: "Holly", lastName: "Pearson", role: "personal_assistant", contract: "Part-time", branch: "North Team", manager: "s4", start: "2023-10-30", dbs: "2026-01-09", rtw: "2029-09-01" },
  { firstName: "Ravi", lastName: "Patel", role: "care_worker", contract: "Full-time", branch: "North Team", manager: "s4", start: "2022-08-08", dbs: "2025-12-15", rtw: "2028-07-01" },
  { firstName: "Eleanor", lastName: "Foster", role: "office_admin", contract: "Full-time", branch: "Head Office", manager: "s2", start: "2020-11-02", dbs: "2026-03-21", rtw: "2030-10-01" },
  { firstName: "Lukas", lastName: "Novak", role: "care_worker", contract: "Agency", branch: "South Team", manager: "s5", status: "On leave", start: "2023-06-12", dbs: "2026-08-19", rtw: "2027-04-01", visa: "2027-04-01" },
];

export const STAFF: Staff[] = rawStaff.map((r, i) => {
  const id = `s${i + 1}`;
  return {
    id,
    firstName: r.firstName,
    lastName: r.lastName,
    role: r.role,
    roleLabel: ROLE_LABELS[r.role],
    email: `${r.firstName.toLowerCase()}.${r.lastName.toLowerCase()}@elmshealth.co.uk`,
    phone: `+44 7${String(700000000 + i * 111111).slice(0, 9)}`,
    startDate: r.start,
    contractType: r.contract,
    employmentStatus: r.status ?? "Active",
    dbsCheckDate: iso(new Date(parse(r.dbs)!.getTime() - 1000 * 60 * 60 * 24 * 365 * 3)),
    dbsExpiry: r.dbs,
    rightToWorkExpiry: r.rtw,
    visaExpiry: r.visa ?? null,
    managerId: r.manager === null ? null : r.manager ?? "s1",
    branch: r.branch ?? "Head Office",
    avatarColor: color(i),
  };
});

/* ------------------------------------------------------------------ */
/* Training records — generated deterministically with a varied RAG   */
/* spread so the dashboard tells a realistic compliance story.        */
/* ------------------------------------------------------------------ */
function appliesToStaff(m: TrainingModule, s: Staff): boolean {
  return m.appliesTo.length === 0 || m.appliesTo.includes(s.role);
}

/* status plan keyed by (staffIndex*moduleIndex) hashing → spread */
type Plan = "green" | "amber" | "red" | "pending" | "notstarted" | "rejected";

function planFor(si: number, mi: number, mandatory: boolean): Plan {
  const h = (si * 7 + mi * 13 + si * mi) % 100;
  if (h < 62) return "green";
  if (h < 74) return "amber";
  if (h < 84) return mandatory ? "red" : "amber";
  if (h < 90) return "pending";
  if (h < 96) return "notstarted";
  return "rejected";
}

let recCounter = 0;
function recId() {
  recCounter += 1;
  return `r${recCounter}`;
}

export const RECORDS: TrainingRecord[] = [];

STAFF.forEach((s, si) => {
  if (s.employmentStatus === "Left") return;
  MODULES.forEach((m, mi) => {
    if (m.retired) return;
    if (!appliesToStaff(m, s)) return;
    const plan = planFor(si, mi, m.mandatory);
    let completionDate: string | null = null;
    let expiryDate: string | null = null;
    let approval: TrainingRecord["approval"] = "approved";
    let evidence: TrainingRecord["evidence"] = null;

    const mkEvidence = (daysAgo: number, verified: boolean): TrainingRecord["evidence"] =>
      m.evidenceRequired
        ? {
            id: `e${recCounter}`,
            fileName: `${m.code}_${s.lastName}_certificate.pdf`,
            fileType: "PDF",
            uploadedBy: `${s.firstName} ${s.lastName}`,
            uploadedAt: iso(new Date(TODAY.getTime() - daysAgo * 86400000)),
            verified,
          }
        : null;

    const completeOn = (daysAgo: number) => {
      const c = new Date(TODAY.getTime() - daysAgo * 86400000);
      completionDate = iso(c);
      const exp = addByFrequency(c, m.refresh);
      expiryDate = exp ? iso(exp) : null;
    };

    switch (plan) {
      case "green":
        completeOn(120 + (mi % 5) * 20);
        evidence = mkEvidence(120, true);
        break;
      case "amber": {
        // completed but expiring within ~45 days → recompute completion so expiry is soon
        const exp = new Date(TODAY.getTime() + (15 + (mi % 30)) * 86400000);
        expiryDate = iso(exp);
        const back = addByFrequency(new Date(exp), m.refresh);
        completionDate = back ? iso(new Date(exp.getTime() - (back.getTime() - exp.getTime()))) : iso(new Date(TODAY.getTime() - 300 * 86400000));
        // simpler: completion = expiry minus 1 cycle
        completionDate = iso(new Date(exp.getTime() - 365 * 86400000));
        evidence = mkEvidence(200, true);
        break;
      }
      case "red": {
        const exp = new Date(TODAY.getTime() - (10 + (mi % 40)) * 86400000);
        expiryDate = iso(exp);
        completionDate = iso(new Date(exp.getTime() - 365 * 86400000));
        evidence = mkEvidence(380, true);
        break;
      }
      case "pending":
        completeOn(8 + (mi % 5));
        approval = "pending";
        evidence = mkEvidence(7, false);
        break;
      case "rejected":
        approval = "rejected";
        evidence = mkEvidence(12, false);
        completionDate = null;
        expiryDate = null;
        break;
      case "notstarted":
        approval = "none";
        completionDate = null;
        expiryDate = null;
        break;
    }

    RECORDS.push({
      id: recId(),
      staffId: s.id,
      moduleId: m.id,
      completionDate,
      expiryDate,
      approval,
      evidence,
      notes: plan === "rejected" ? "Certificate illegible — please re-upload a clear copy." : undefined,
    });
  });
});

/* ------------------------------------------------------------------ */
/* Annual review log                                                  */
/* ------------------------------------------------------------------ */
export const REVIEWS: AnnualReview[] = [
  { id: "rv1", reviewDate: "2026-04-01", reviewedBy: "Amara Okafor", scope: "Full training matrix — all roles", changes: "Added Positive Behaviour Support for supported-living packages; moved Fire Safety to annual refresh.", domains: ["Safe", "Effective", "Well-Led"], nextReviewDue: "2027-04-01", status: "Approved" },
  { id: "rv2", reviewDate: "2025-10-12", reviewedBy: "David Mensah", scope: "Specialist care modules", changes: "Introduced PEG Feeding and Epilepsy competencies linked to two new care packages.", domains: ["Effective"], nextReviewDue: "2026-10-12", status: "Approved" },
  { id: "rv3", reviewDate: "2026-06-20", reviewedBy: "Priya Sharma", scope: "Mandatory induction pathway", changes: "Reviewing Care Certificate delivery split (eLearning vs shadowing) for new starters.", domains: ["Effective", "Caring"], nextReviewDue: "2027-06-20", status: "Awaiting sign-off" },
];

/* ------------------------------------------------------------------ */
/* Audit trail                                                        */
/* ------------------------------------------------------------------ */
export const AUDIT: AuditEntry[] = [
  { id: "a1", timestamp: "2026-06-27T08:42:00Z", user: "Priya Sharma", action: "Approved certificate", entity: "Moving & Handling · G. Adeyemi", category: "evidence", field: "Approval", previous: "Pending", next: "Approved" },
  { id: "a2", timestamp: "2026-06-27T08:15:00Z", user: "System", action: "Status changed to Overdue", entity: "Safe Administration of Medication · J. Whitfield", category: "training", field: "RAG", previous: "Amber", next: "Red" },
  { id: "a3", timestamp: "2026-06-26T16:30:00Z", user: "David Mensah", action: "Exported CQC evidence pack", entity: "Inspection pack · North Team", category: "report" },
  { id: "a4", timestamp: "2026-06-26T14:05:00Z", user: "Fatima Ali", action: "Uploaded certificate", entity: "Infection Prevention & Control", category: "evidence", field: "Evidence", previous: "—", next: "IPC-01_Ali_certificate.pdf" },
  { id: "a5", timestamp: "2026-06-25T11:20:00Z", user: "Amara Okafor", action: "Updated staff profile", entity: "Mohammed Rahman", category: "staff", field: "Visa expiry", previous: "12 Aug 2025", next: "12 Aug 2026" },
  { id: "a6", timestamp: "2026-06-24T09:50:00Z", user: "Priya Sharma", action: "Added training module", entity: "Positive Behaviour Support (PBS-01)", category: "matrix", field: "Module", previous: "—", next: "Created" },
  { id: "a7", timestamp: "2026-06-23T15:42:00Z", user: "Priya Sharma", action: "Rejected certificate", entity: "Basic Life Support · D. Owusu", category: "evidence", field: "Approval", previous: "Pending", next: "Rejected" },
  { id: "a8", timestamp: "2026-06-20T10:00:00Z", user: "Amara Okafor", action: "Signed off annual review", entity: "Annual matrix review 2026", category: "review", field: "Status", previous: "Draft", next: "Approved" },
  { id: "a9", timestamp: "2026-06-19T13:11:00Z", user: "CQC Reviewer (temp)", action: "Viewed evidence pack", entity: "Read-only inspection access", category: "access" },
];

/* ------------------------------------------------------------------ */
/* Notifications                                                      */
/* ------------------------------------------------------------------ */
export const NOTIFICATIONS: NotificationItem[] = [
  { id: "n1", type: "escalation", title: "Overdue mandatory training", body: "James Whitfield — Safe Administration of Medication expired 14 days ago. Escalated to Operations Manager.", time: "2026-06-27T08:15:00Z", read: false, channel: ["Email", "In-system"], priority: "high" },
  { id: "n2", type: "approval", title: "3 certificates awaiting approval", body: "Pending verification for Moving & Handling, IPC and Fire Safety submissions.", time: "2026-06-27T07:55:00Z", read: false, channel: ["In-system"], priority: "high" },
  { id: "n3", type: "expiry", title: "Training due in 30 days", body: "Grace Adeyemi — DBS check expires 04 Aug 2026. Renewal reminder sent by email & SMS.", time: "2026-06-26T09:00:00Z", read: false, channel: ["Email", "SMS"], priority: "medium" },
  { id: "n4", type: "booking", title: "External training booked", body: "Moving & Handling classroom session booked with SafeLift for 10 Jul 2026 (4 seats).", time: "2026-06-25T14:20:00Z", read: true, channel: ["Email"], priority: "low" },
  { id: "n5", type: "review", title: "Annual review awaiting sign-off", body: "Mandatory induction pathway review prepared by Priya Sharma needs Registered Manager approval.", time: "2026-06-20T16:00:00Z", read: true, channel: ["In-system"], priority: "medium" },
  { id: "n6", type: "expiry", title: "Right to work expiring", body: "Sofia Marchetti — visa / right-to-work expires 30 Sep 2026. Begin renewal process.", time: "2026-06-18T10:30:00Z", read: true, channel: ["Email", "In-system"], priority: "high" },
];

export const ORG = {
  name: "ELMS Health Solutions Ltd",
  cqcId: "1-101234567",
  branches: ["Head Office", "North Team", "South Team", "Live-in Team"],
};
