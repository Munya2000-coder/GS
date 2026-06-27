/* ===========================================================================
   ELMS · AI engine
   ---------------------------------------------------------------------------
   This module is the single seam between the UI and "the model". Today each
   function is a grounded, deterministic simulation over the in-memory data so
   the demo is coherent and offline-safe. To go live, swap each body for a
   Claude API call (see callClaude stub) — the return shapes stay identical, so
   no UI changes are required.
   =========================================================================== */
import type { ComputedRecord, CqcDomain, Staff, TrainingModule } from "../data/types";
import { CQC_DOMAINS, fmtDate, relativeExpiry } from "./domain";
import { byDomain, compliancePct, dueSoon, overdue } from "./analytics";

/** Simulated latency so the UI can show a realistic "thinking" state. */
export function think<T>(value: T, ms = 850): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms));
}

/* ---------------------------------------------------------------------------
   LIVE SEAM — replace `think(simulated)` with this in production.
   --------------------------------------------------------------------------- */
// async function callClaude(system: string, prompt: string, schema?: object) {
//   const r = await fetch("/api/ai", {
//     method: "POST",
//     headers: { "content-type": "application/json" },
//     body: JSON.stringify({ model: "claude-opus-4-8", system, prompt, schema }),
//   });
//   return r.json(); // server proxies to the Anthropic Messages API with tool/JSON output
// }

const seed = (s: string) => Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 100000, 7);

/* =========================================================================
   1. Certificate intelligence
   ========================================================================= */
export interface CertExtraction {
  learnerName: string;
  course: string;
  provider: string;
  completionDate: string | null;
  expiryDate: string | null;
  confidence: number;
  recommendation: "approve" | "review" | "return";
  flags: string[];
  reason: string;
}

export function aiExtractCertificate(rec: ComputedRecord): Promise<CertExtraction> {
  const m = rec.module;
  const s = rec.staff;
  const flags: string[] = [];
  const h = seed(rec.id);
  const conf = 78 + (h % 21); // 78–98

  if (!rec.evidence) flags.push("No document attached");
  if (m.refresh !== "Once only" && !rec.expiryDate) flags.push("Expiry date not detected on document");
  if (h % 7 === 0) flags.push("Learner name differs slightly from staff record");
  if (h % 11 === 0) flags.push(`Provider "${m.provider}" not on the approved list`);

  let recommendation: CertExtraction["recommendation"] = "approve";
  if (flags.length >= 2 || conf < 82) recommendation = "return";
  else if (flags.length === 1 || conf < 90) recommendation = "review";

  const reason =
    recommendation === "approve"
      ? "High-confidence match: learner, course and dates all align with the assigned module."
      : recommendation === "review"
        ? "Mostly clean, but one detail needs a human check before approval."
        : "Multiple issues detected — recommend returning to the staff member.";

  return think({
    learnerName: `${s.firstName} ${s.lastName}`,
    course: m.title,
    provider: m.provider ?? "External provider",
    completionDate: rec.completionDate,
    expiryDate: rec.expiryDate,
    confidence: conf,
    recommendation,
    flags,
    reason,
  });
}

/* =========================================================================
   2. CQC evidence-pack narrative
   ========================================================================= */
export interface DomainNarrative {
  domain: CqcDomain;
  color: string;
  pct: number;
  text: string;
}

export function aiCqcNarrative(records: ComputedRecord[]): Promise<DomainNarrative[]> {
  const out = byDomain(records).map((d) => {
    const subset = records.filter((r) => r.module.cqcDomain === d.domain);
    const od = subset.filter((r) => r.rag === "red").length;
    const soon = subset.filter((r) => r.rag === "amber").length;
    const verb = d.pct >= 90 ? "strong" : d.pct >= 75 ? "broadly sound" : "an area for improvement";
    const text =
      `Training mapped to the ${d.domain} key question is ${verb} at ${d.pct}% compliant ` +
      `across ${subset.length} records. ` +
      (od > 0
        ? `${od} item${od > 1 ? "s are" : " is"} overdue and ${od > 1 ? "have" : "has"} been escalated to the Operations Manager. `
        : `No mandatory training is currently overdue. `) +
      (soon > 0 ? `${soon} renewal${soon > 1 ? "s fall" : " falls"} due within 60 days and ${soon > 1 ? "are" : "is"} booked or scheduled.` : `No renewals are imminent.`);
    return { domain: d.domain as CqcDomain, color: d.color, pct: d.pct, text };
  });
  return think(out, 1100);
}

export function aiInspectionSummary(records: ComputedRecord[], staffCount: number): Promise<string> {
  const pct = compliancePct(records);
  const od = overdue(records).length;
  const verdict = pct >= 90 ? "well-prepared for inspection" : pct >= 80 ? "in a reasonable position" : "carrying notable compliance risk";
  return think(
    `ELMS Health Solutions is ${verdict}, with overall mandatory training compliance at ${pct}% across ${staffCount} active staff. ` +
      `${od === 0 ? "There is no overdue mandatory training." : `${od} overdue item${od > 1 ? "s are" : " is"} under active remediation with booked refreshers.`} ` +
      `Evidence is mapped to all five CQC key questions, certificate approvals follow a verified workflow, and every change is captured in the audit trail.`,
    1000,
  );
}

/* =========================================================================
   3. Ask-your-data assistant (grounded NL → query)
   ========================================================================= */
export interface AiAnswer {
  text: string;
  rows: { primary: string; secondary: string; tag?: string; tagTone?: "red" | "amber" | "green" | "grey" }[];
  citations: string[];
}

export function aiAnswerQuery(q: string, records: ComputedRecord[], staff: Staff[]): Promise<AiAnswer> {
  const t = q.toLowerCase();
  const cite = (s: string) => s;
  let pool = records;
  const citations: string[] = [];

  // domain filter
  const dom = CQC_DOMAINS.find((d) => t.includes(d.key.toLowerCase()));
  if (dom) {
    pool = pool.filter((r) => r.module.cqcDomain === dom.key);
    citations.push(cite(`CQC domain: ${dom.key}`));
  }
  // team filter
  const teams = Array.from(new Set(staff.map((s) => s.branch)));
  const team = teams.find((b) => t.includes(b.toLowerCase().replace(" team", "")));
  if (team) {
    pool = pool.filter((r) => r.staff.branch === team);
    citations.push(cite(`Team: ${team}`));
  }
  // module keyword
  const moduleHit = records.find((r) => {
    const w = r.module.title.toLowerCase().split(/\W+/).filter((x) => x.length > 4);
    return w.some((word) => t.includes(word));
  });
  if (moduleHit && (t.includes("medic") || t.includes("safegu") || t.includes("moving") || t.includes("fire") || t.includes("first aid") || t.includes("dementia"))) {
    pool = pool.filter((r) => r.moduleId === moduleHit.moduleId);
    citations.push(cite(`Module: ${moduleHit.module.title}`));
  }

  // intent
  let subset = pool;
  let label = "matching records";
  if (t.includes("overdue") || t.includes("expired") || t.includes("red")) {
    subset = pool.filter((r) => r.rag === "red");
    label = "overdue training items";
  } else if (t.includes("due") || t.includes("expir") || t.includes("soon") || t.includes("amber")) {
    subset = pool.filter((r) => r.rag === "amber");
    label = "items due soon";
  } else if (t.includes("missing") || t.includes("evidence") || t.includes("certificate")) {
    subset = pool.filter((r) => r.module.evidenceRequired && !r.evidence);
    label = "records missing evidence";
  } else if (t.includes("pending") || t.includes("approv")) {
    subset = pool.filter((r) => r.approval === "pending");
    label = "certificates awaiting approval";
  } else if (t.includes("compliant") || t.includes("in date") || t.includes("green")) {
    subset = pool.filter((r) => r.rag === "green");
    label = "in-date training records";
  }

  // DBS / right to work special case (staff-level)
  if (t.includes("dbs") || t.includes("right to work") || t.includes("visa")) {
    const field: "dbsExpiry" | "rightToWorkExpiry" | "visaExpiry" = t.includes("dbs")
      ? "dbsExpiry"
      : t.includes("visa")
        ? "visaExpiry"
        : "rightToWorkExpiry";
    const flagged = staff
      .filter((s) => s.employmentStatus !== "Left" && s[field])
      .map((s) => ({ s, d: new Date(s[field] as string) }))
      .filter((x) => (x.d.getTime() - new Date("2026-06-27").getTime()) / 86400000 < 120)
      .sort((a, b) => a.d.getTime() - b.d.getTime());
    return think({
      text: `${flagged.length} staff have ${field === "dbsExpiry" ? "a DBS" : field === "visaExpiry" ? "a visa" : "a right-to-work"} document expiring within the next 120 days. Earliest first:`,
      rows: flagged.map((x) => ({
        primary: `${x.s.firstName} ${x.s.lastName}`,
        secondary: `${x.s.roleLabel} · ${x.s.branch} · expires ${fmtDate(x.s[field] as string)}`,
        tag: "Expiring",
        tagTone: "amber" as const,
      })),
      citations: [cite("Staff register · document expiry")],
    });
  }

  const rows = subset.slice(0, 12).map((r) => ({
    primary: `${r.staff.firstName} ${r.staff.lastName}`,
    secondary: `${r.module.title} · ${r.rag === "red" ? relativeExpiry(r.daysToExpiry) : fmtDate(r.expiryDate)}`,
    tag: r.rag === "red" ? "Overdue" : r.rag === "amber" ? "Due soon" : r.rag === "green" ? "In date" : "—",
    tagTone: (r.rag === "red" ? "red" : r.rag === "amber" ? "amber" : r.rag === "green" ? "green" : "grey") as
      | "red"
      | "amber"
      | "green"
      | "grey",
  }));

  const text =
    subset.length === 0
      ? `Good news — I found no ${label}${dom ? ` for ${dom.key}` : ""}${team ? ` in the ${team}` : ""}.`
      : `I found ${subset.length} ${label}${dom ? ` mapped to ${dom.key}` : ""}${team ? ` in the ${team}` : ""}${moduleHit && citations.some((c) => c.startsWith("Module")) ? ` for ${moduleHit.module.title}` : ""}.${subset.length > 12 ? " Showing the first 12." : ""}`;

  if (citations.length === 0) citations.push(cite("Training matrix · all records"));
  return think({ text, rows, citations });
}

export const SUGGESTED_QUERIES = [
  "Who is overdue on medication training?",
  "Show staff whose DBS expires soon",
  "Which Safe-domain training is due in the North team?",
  "List certificates awaiting approval",
  "What evidence is missing?",
];

/* =========================================================================
   4. Predictive lapse risk
   ========================================================================= */
export interface RiskScore {
  staff: Staff;
  score: number; // 0-100
  band: "high" | "med" | "low";
  drivers: string[];
}

export function aiLapseRisk(records: ComputedRecord[], staff: Staff[]): Promise<RiskScore[]> {
  const scored = staff
    .filter((s) => s.employmentStatus !== "Left")
    .map((s) => {
      const mine = records.filter((r) => r.staffId === s.id);
      const od = mine.filter((r) => r.rag === "red").length;
      const soon = mine.filter((r) => r.rag === "amber").length;
      const notStarted = mine.filter((r) => r.recordStatus === "not_started").length;
      const drivers: string[] = [];
      let score = od * 22 + soon * 9 + notStarted * 7;
      if (od) drivers.push(`${od} already overdue`);
      if (soon) drivers.push(`${soon} due within 60 days`);
      if (notStarted) drivers.push(`${notStarted} not yet started`);
      if (s.contractType === "Bank" || s.contractType === "Agency") {
        score += 12;
        drivers.push(`${s.contractType} contract — harder to schedule`);
      }
      if (s.employmentStatus === "Onboarding") {
        score += 8;
        drivers.push("Still in induction window");
      }
      score = Math.min(99, score);
      const band: RiskScore["band"] = score >= 55 ? "high" : score >= 28 ? "med" : "low";
      if (drivers.length === 0) drivers.push("All training on track");
      return { staff: s, score, band, drivers };
    })
    .sort((a, b) => b.score - a.score);
  return think(scored, 950);
}

/* =========================================================================
   5. Smart training planner
   ========================================================================= */
export interface BookingSuggestion {
  module: TrainingModule;
  count: number;
  staffNames: string[];
  suggestedDate: string;
  rationale: string;
}

export function aiPlanTraining(records: ComputedRecord[]): Promise<BookingSuggestion[]> {
  const pool = [...dueSoon(records), ...overdue(records)];
  const byModule = new Map<string, ComputedRecord[]>();
  for (const r of pool) {
    if (r.module.delivery === "Classroom" || r.module.delivery === "External provider" || r.module.delivery === "Blended") {
      const list = byModule.get(r.moduleId) ?? [];
      list.push(r);
      byModule.set(r.moduleId, list);
    }
  }
  const dates = ["10 Jul 2026", "17 Jul 2026", "24 Jul 2026", "31 Jul 2026", "07 Aug 2026"];
  const suggestions = Array.from(byModule.entries())
    .map(([, recs], i) => {
      const m = recs[0].module;
      return {
        module: m,
        count: recs.length,
        staffNames: recs.map((r) => `${r.staff.firstName} ${r.staff.lastName}`),
        suggestedDate: dates[i % dates.length],
        rationale:
          recs.length >= 2
            ? `Group ${recs.length} staff into a single ${m.provider ?? "provider"} session to cut cost and admin.`
            : `Book ${m.title} with ${m.provider ?? "the provider"} before expiry.`,
      };
    })
    .filter((x) => x.count >= 1)
    .sort((a, b) => b.count - a.count);
  return think(suggestions, 1000);
}

/* =========================================================================
   6. Annual review co-pilot
   ========================================================================= */
export function aiDraftReview(modules: TrainingModule[]): Promise<{ changes: string; domains: CqcDomain[]; scope: string }> {
  const recent = modules.slice(-3);
  const specialist = modules.filter((m) => m.category === "Specialist Care Training").length;
  const domains = Array.from(new Set(recent.map((m) => m.cqcDomain))) as CqcDomain[];
  return think({
    scope: "Full training matrix — annual review of all roles and modules",
    changes:
      `Reviewed all ${modules.length} active modules against current CQC guidance and the latest care packages. ` +
      `Confirmed mandatory training assignments by role and validated refresh frequencies. ` +
      `${specialist} specialist competencies (e.g. ${recent.map((m) => m.title).slice(0, 2).join(", ")}) were checked against live service needs. ` +
      `No modules retired this cycle; CQC domain mappings remain accurate.`,
    domains: domains.length ? domains : ["Safe", "Effective", "Well-Led"],
  });
}

/* =========================================================================
   7. AI knowledge checks (quiz generation)
   ========================================================================= */
export interface QuizQ {
  q: string;
  options: string[];
  answer: number;
}

export function aiGenerateQuiz(m: TrainingModule): Promise<QuizQ[]> {
  const base: Record<string, QuizQ[]> = {
    Safe: [
      { q: `Under "${m.title}", what is your first action on identifying a risk of harm?`, options: ["Wait until the next supervision", "Record and report it without delay", "Tell only a colleague", "Take no action if unsure"], answer: 1 },
      { q: "Who is responsible for safeguarding in your day-to-day role?", options: ["Only the manager", "Only the CQC", "Every member of staff", "Only senior carers"], answer: 2 },
    ],
    Effective: [
      { q: `A key principle of "${m.title}" is to:`, options: ["Follow routine regardless of need", "Base care on current evidence and the person's needs", "Avoid recording outcomes", "Defer all decisions"], answer: 1 },
      { q: "Before administering medication you must always:", options: ["Check the MAR chart and the 'rights' of administration", "Ask another resident", "Rely on memory", "Skip recording"], answer: 0 },
    ],
    Caring: [
      { q: `"${m.title}" promotes dignity by:`, options: ["Making choices for people", "Respecting privacy, choice and independence", "Rushing care tasks", "Ignoring preferences"], answer: 1 },
    ],
    Responsive: [
      { q: `"${m.title}" helps services to:`, options: ["Treat everyone identically", "Respond to individual and changing needs", "Reduce communication", "Limit access"], answer: 1 },
    ],
    "Well-Led": [
      { q: `Good governance under "${m.title}" means:`, options: ["Hiding mistakes", "Open culture, learning and clear accountability", "Avoiding audits", "No record-keeping"], answer: 1 },
    ],
  };
  const set = base[m.cqcDomain] ?? base.Safe;
  return think(set, 1100);
}

/* =========================================================================
   8. Incident → learning analysis
   ========================================================================= */
export interface IncidentAnalysis {
  category: string;
  severity: "low" | "medium" | "high";
  rootCauses: string[];
  recommendedModules: { title: string; why: string }[];
  correctiveActions: string[];
  cqcDomains: CqcDomain[];
}

export function aiIncidentAnalysis(text: string, modules: TrainingModule[]): Promise<IncidentAnalysis> {
  const t = text.toLowerCase();
  const pick = (kw: string[], fallback: string) =>
    modules.find((m) => kw.some((k) => m.title.toLowerCase().includes(k)))?.title ?? fallback;

  let category = "General care incident";
  const rootCauses: string[] = [];
  const recommendedModules: { title: string; why: string }[] = [];
  const cqcDomains: CqcDomain[] = ["Safe"];

  if (t.includes("medic") || t.includes("med error") || t.includes("dose")) {
    category = "Medication error";
    rootCauses.push("Administration not cross-checked against the MAR chart", "Time pressure during the round");
    recommendedModules.push({ title: pick(["medication"], "Safe Administration of Medication"), why: "Refresh safe administration and recording" });
    cqcDomains.push("Effective");
  }
  if (t.includes("fall") || t.includes("fell") || t.includes("slip")) {
    category = "Slip, trip or fall";
    rootCauses.push("Moving & handling technique not followed", "Environmental hazard not assessed");
    recommendedModules.push({ title: pick(["moving"], "Moving & Handling"), why: "Reinforce safe people-handling and risk assessment" });
  }
  if (t.includes("safeguard") || t.includes("abuse") || t.includes("neglect") || t.includes("bruis")) {
    category = "Safeguarding concern";
    rootCauses.push("Indicators of harm not recognised early", "Reporting pathway unclear to staff");
    recommendedModules.push({ title: pick(["safeguarding adults"], "Safeguarding Adults"), why: "Strengthen recognition and reporting duties" });
  }
  if (t.includes("infection") || t.includes("ppe") || t.includes("hygiene")) {
    category = "Infection control";
    rootCauses.push("PPE / hand-hygiene steps missed");
    recommendedModules.push({ title: pick(["infection"], "Infection Prevention & Control"), why: "Refresh IPC and PPE practice" });
  }
  if (rootCauses.length === 0) {
    rootCauses.push("Procedure not followed as trained", "Gap between policy and day-to-day practice");
    recommendedModules.push({ title: pick(["person-centred", "dignity"], "Person-Centred Care & Dignity"), why: "Reinforce expected standards of care" });
  }

  const severity: IncidentAnalysis["severity"] = t.includes("hospital") || t.includes("serious") || t.includes("injury") ? "high" : t.includes("near miss") ? "low" : "medium";

  return think({
    category,
    severity,
    rootCauses,
    recommendedModules,
    correctiveActions: [
      "Assign the recommended refresher training to the staff involved",
      "Add a targeted spot-check / competency observation within 30 days",
      "Share the lesson learned at the next team meeting",
    ],
    cqcDomains: Array.from(new Set(cqcDomains)) as CqcDomain[],
  }, 1300);
}
