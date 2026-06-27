import { useMemo, useState } from "react";
import { useStore } from "../store/store";
import { Badge, Button, Card, CqcChip, Field, Meter, Modal } from "../components/ui";
import { Icon, type IconName } from "../components/Icon";
import { byDomain, compliancePct, missingEvidence, overdue } from "../lib/analytics";
import { fmtDate } from "../lib/domain";
import { AiChip, AiPanel, AiThinking, useAiTask } from "../components/ai";
import { aiCqcNarrative, aiInspectionSummary } from "../lib/ai";

const REPORTS: { id: string; title: string; desc: string; icon: IconName; tone: string }[] = [
  { id: "matrix", title: "Full training matrix", desc: "Every staff member against every applicable module with RAG status.", icon: "matrix", tone: "brand" },
  { id: "compliance", title: "Staff compliance report", desc: "Per-staff compliance percentages and outstanding training.", icon: "users2", tone: "green" },
  { id: "overdue", title: "Overdue training report", desc: "All mandatory training past its expiry date, by team.", icon: "alert", tone: "red" },
  { id: "duesoon", title: "Training due soon", desc: "Renewals falling due within the next 90 days for planning.", icon: "clock", tone: "amber" },
  { id: "cqc", title: "CQC evidence pack", desc: "Inspection-ready evidence mapped to the five Key Questions.", icon: "shield", tone: "violet" },
  { id: "induction", title: "New starter induction", desc: "Care Certificate and induction progress for new staff.", icon: "flag", tone: "blue" },
  { id: "review", title: "Annual review report", desc: "Matrix review history, changes and sign-off.", icon: "clipboard", tone: "brand" },
  { id: "dbs", title: "DBS & right-to-work", desc: "DBS, visa and right-to-work expiry monitoring.", icon: "file", tone: "green" },
];

const TONE_BG: Record<string, { bg: string; fg: string }> = {
  brand: { bg: "var(--brand-50)", fg: "var(--brand-700)" },
  green: { bg: "var(--green-bg)", fg: "var(--green-ink)" },
  red: { bg: "var(--red-bg)", fg: "var(--red-ink)" },
  amber: { bg: "var(--amber-bg)", fg: "var(--amber-ink)" },
  violet: { bg: "var(--violet-bg)", fg: "var(--violet-ink)" },
  blue: { bg: "var(--blue-bg)", fg: "var(--blue-ink)" },
};

export function Reports() {
  const { computed, staff, pushToast, inspectionMode } = useStore();
  const [inspectModal, setInspectModal] = useState(false);

  const summary = useMemo(
    () => ({
      pct: compliancePct(computed),
      domains: byDomain(computed),
      overdue: overdue(computed).length,
      missing: missingEvidence(computed).length,
      staff: staff.filter((s) => s.employmentStatus !== "Left").length,
    }),
    [computed, staff],
  );

  function exportAs(report: string, fmt: string) {
    pushToast({ kind: "success", title: `${fmt} export started`, body: `“${report}” will download shortly.` });
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Reports &amp; CQC Export</h1>
          <p>Generate inspection-ready evidence in minutes. Export any report as PDF, Excel or CSV.</p>
        </div>
        {!inspectionMode && (
          <Button variant="primary" icon="eye" onClick={() => setInspectModal(true)}>
            Grant inspector access
          </Button>
        )}
      </div>

      {/* CQC summary banner */}
      <Card style={{ marginBottom: 18, overflow: "hidden" }}>
        <div className="card-pad row gap-24 wrap" style={{ background: "linear-gradient(135deg, var(--brand-50), #fff)" }}>
          <div style={{ minWidth: 200 }}>
            <div className="section-title">CQC inspection readiness</div>
            <div style={{ fontSize: 40, fontWeight: 780, letterSpacing: "-0.03em", color: "var(--brand-700)", lineHeight: 1.1, marginTop: 4 }}>
              {summary.pct}%
            </div>
            <div className="small muted">Overall compliance · {summary.staff} active staff</div>
            <div className="row gap-8" style={{ marginTop: 12 }}>
              <Button variant="primary" size="sm" icon="download" onClick={() => exportAs("CQC evidence pack", "PDF")}>Evidence pack</Button>
              <Badge tone={summary.overdue ? "red" : "green"} dot>{summary.overdue} overdue</Badge>
            </div>
          </div>
          <div className="flex-1" style={{ minWidth: 280 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>By CQC Key Question</div>
            <div className="col gap-12">
              {summary.domains.map((d) => (
                <div key={d.domain}>
                  <div className="row between" style={{ marginBottom: 5 }}>
                    <CqcChip domain={d.domain} color={d.color} />
                    <b className="mono small">{d.pct}%</b>
                  </div>
                  <Meter value={d.pct} color={d.color} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div style={{ marginBottom: 18 }}>
        <CqcNarrativeAi />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
        {REPORTS.map((r) => {
          const t = TONE_BG[r.tone];
          return (
            <Card key={r.id} className="card-pad">
              <div className="row gap-12 items-start">
                <span className="kpi-icon" style={{ background: t.bg, color: t.fg, flexShrink: 0 }}>
                  <Icon name={r.icon} size={20} />
                </span>
                <div className="flex-1">
                  <b>{r.title}</b>
                  <p className="small muted" style={{ margin: "3px 0 0" }}>{r.desc}</p>
                </div>
              </div>
              <div className="row gap-8" style={{ marginTop: 14 }}>
                <Button size="sm" icon="file" onClick={() => exportAs(r.title, "PDF")}>PDF</Button>
                <Button size="sm" icon="grid" onClick={() => exportAs(r.title, "Excel")}>Excel</Button>
                <Button size="sm" icon="download" onClick={() => exportAs(r.title, "CSV")}>CSV</Button>
                <Button size="sm" variant="ghost" icon="eye" style={{ marginLeft: "auto" }} onClick={() => exportAs(r.title, "Preview")}>Preview</Button>
              </div>
            </Card>
          );
        })}
      </div>

      {inspectModal && <InspectionAccessModal onClose={() => setInspectModal(false)} />}
    </>
  );
}

function CqcNarrativeAi() {
  const { computed, staff, pushToast } = useStore();
  const narrative = useAiTask(() => aiCqcNarrative(computed));
  const summary = useAiTask(() => aiInspectionSummary(computed, staff.filter((s) => s.employmentStatus !== "Left").length));

  const run = () => { narrative.run(); summary.run(); };
  const busy = narrative.loading || summary.loading;
  const has = narrative.data || summary.data;

  return (
    <AiPanel
      title="AI inspection narrative"
      sub="Auto-drafts the evidence-pack commentary, mapped to the five CQC key questions"
      icon="brain"
      right={
        !has ? (
          <button className="btn ai sm" onClick={run} disabled={busy}>
            <Icon name="sparkle" size={13} /> {busy ? "Drafting…" : "Draft narrative"}
          </button>
        ) : (
          <button className="btn ai-outline sm" onClick={() => pushToast({ kind: "success", title: "Narrative added to pack", body: "The AI commentary is included in the CQC evidence export." })}>
            <Icon name="plus" size={13} /> Add to pack
          </button>
        )
      }
    >
      {!has && !busy && (
        <div className="small" style={{ color: "#5b4b86" }}>
          Generate a plain-English summary an inspector expects — overall readiness plus a paragraph
          per key question — written from your live data and ready to drop into the evidence pack.
        </div>
      )}
      {busy && <AiThinking label="Writing the inspection narrative…" />}
      {summary.data && (
        <div style={{ background: "rgba(255,255,255,0.7)", border: "1px solid rgba(124,58,237,0.14)", borderRadius: 10, padding: "12px 14px", marginBottom: narrative.data ? 14 : 0 }}>
          <div className="row gap-8" style={{ marginBottom: 6 }}>
            <Icon name="award" size={15} style={{ color: "var(--ai-1)" }} />
            <b className="small" style={{ color: "#3a2a6b" }}>Executive summary</b>
          </div>
          <p className="small" style={{ margin: 0, color: "var(--ink-2)", lineHeight: 1.6 }}>{summary.data}</p>
        </div>
      )}
      {narrative.data && (
        <div className="col gap-10">
          {narrative.data.map((d) => (
            <div key={d.domain} className="row gap-12 items-start" style={{ background: "rgba(255,255,255,0.6)", borderRadius: 10, padding: "11px 13px" }}>
              <span style={{ width: 9, height: 9, borderRadius: "50%", background: d.color, marginTop: 5, flexShrink: 0 }} />
              <div className="flex-1">
                <div className="row gap-8" style={{ marginBottom: 2 }}>
                  <b className="small">{d.domain}</b>
                  <span className="tiny mono" style={{ color: "var(--muted)" }}>{d.pct}%</span>
                </div>
                <p className="small" style={{ margin: 0, color: "var(--ink-2)", lineHeight: 1.55 }}>{d.text}</p>
              </div>
            </div>
          ))}
          <div className="row gap-6 tiny muted" style={{ marginTop: 2 }}>
            <AiChip label="AI-generated" /> Review before sharing — drafted from live data, not a substitute for your professional judgement.
          </div>
        </div>
      )}
    </AiPanel>
  );
}

function InspectionAccessModal({ onClose }: { onClose: () => void }) {
  const { pushToast } = useStore();
  const [name, setName] = useState("");
  const [days, setDays] = useState("7");
  const [created, setCreated] = useState(false);

  return (
    <Modal
      title="Grant CQC inspector access"
      icon="shield"
      onClose={onClose}
      footer={
        created ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              icon="check"
              disabled={!name}
              onClick={() => {
                setCreated(true);
                pushToast({ kind: "success", title: "Inspection access created", body: `Read-only account for ${name} expires in ${days} days.` });
              }}
            >
              Create access
            </Button>
          </>
        )
      }
    >
      {!created ? (
        <>
          <p className="small muted" style={{ marginTop: 0 }}>
            Create a secure, time-limited <b style={{ color: "var(--ink)" }}>read-only</b> account. Inspectors can view selected reports and download evidence packs only — no editing. All activity is audit-logged and the account expires automatically.
          </p>
          <div className="col gap-16">
            <Field label="Inspector name / reference"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. CQC Inspector — J. Smith" /></Field>
            <Field label="Access period">
              <select className="select" value={days} onChange={(e) => setDays(e.target.value)}>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </Field>
            <div className="col gap-8">
              {["Read-only — no editing permissions", "Restricted to selected reports & evidence", "Inspector activity audit-logged", "Automatic expiry after the inspection period"].map((x) => (
                <div className="row gap-8 small" key={x}>
                  <Icon name="checkCircle" size={16} style={{ color: "var(--green)" }} /> {x}
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="col center gap-12" style={{ textAlign: "center", padding: "16px 0" }}>
          <span className="kpi-icon" style={{ background: "var(--green-bg)", color: "var(--green-ink)", width: 56, height: 56 }}>
            <Icon name="checkCircle" size={28} />
          </span>
          <b style={{ fontSize: 16 }}>Access link generated</b>
          <p className="small muted" style={{ margin: 0 }}>
            A secure invite has been sent. {name} now has read-only access for {days} days.
          </p>
          <div className="row gap-8" style={{ background: "var(--surface-2)", padding: "10px 14px", borderRadius: 8, fontFamily: "monospace", fontSize: 12.5 }}>
            <Icon name="link" size={15} />
            elmshealth.co.uk/inspect/{name.toLowerCase().replace(/[^a-z]+/g, "-").slice(0, 16)}
          </div>
          <div className="tiny muted">Expires {fmtDate("2026-07-04")}</div>
        </div>
      )}
    </Modal>
  );
}
