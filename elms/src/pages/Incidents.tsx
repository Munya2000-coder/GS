import { useState } from "react";
import { useStore } from "../store/store";
import { Badge, Button, Card, CardHead, CqcChip, Empty, Field, Kpi } from "../components/ui";
import { Icon } from "../components/Icon";
import { AiChip, AiPanel, AiThinking, useAiTask } from "../components/ai";
import { aiIncidentAnalysis, type IncidentAnalysis } from "../lib/ai";
import { cqcColor, fmtDate } from "../lib/domain";

interface LoggedIncident {
  id: string;
  date: string;
  summary: string;
  analysis: IncidentAnalysis;
}

const SAMPLE_INCIDENTS: LoggedIncident[] = [
  {
    id: "i1",
    date: "2026-06-22",
    summary: "Resident received a double dose of morning medication; carer did not cross-check the MAR chart during a busy round.",
    analysis: {
      category: "Medication error",
      severity: "high",
      rootCauses: ["Administration not cross-checked against the MAR chart", "Time pressure during the round"],
      recommendedModules: [{ title: "Safe Administration of Medication", why: "Refresh safe administration and recording" }],
      correctiveActions: ["Assign medication refresher to the carer", "Medication competency spot-check within 30 days", "Share lesson at team meeting"],
      cqcDomains: ["Safe", "Effective"],
    },
  },
];

export function Incidents() {
  const { modules } = useStore();
  const [incidents, setIncidents] = useState<LoggedIncident[]>(SAMPLE_INCIDENTS);
  const [text, setText] = useState("");
  const { loading, data, run, reset } = useAiTask(() => aiIncidentAnalysis(text, modules));

  const sevTone = (s: string) => (s === "high" ? "red" : s === "medium" ? "amber" : "green");

  function logIt() {
    if (!data) return;
    setIncidents((prev) => [
      { id: `i${prev.length + 1}`, date: "2026-06-27", summary: text, analysis: data },
      ...prev,
    ]);
    setText("");
    reset();
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Incidents &amp; Learning</h1>
          <p>
            Report incidents and let AI identify likely root causes and the training that prevents a
            recurrence — closing the governance loop CQC expects under Well-Led.
          </p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <Kpi label="Incidents logged" value={incidents.length} icon="flag" tone="brand" />
        <Kpi label="Training actions raised" value={incidents.reduce((a, i) => a + i.analysis.recommendedModules.length, 0)} icon="award" tone="violet" />
        <Kpi label="High severity" value={incidents.filter((i) => i.analysis.severity === "high").length} icon="alert" tone="red" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" }}>
        {/* Reporter */}
        <div className="col gap-16">
          <Card>
            <CardHead title="Report an incident" sub="Describe what happened in plain English" icon="flag" />
            <div className="card-body col gap-12">
              <Field label="What happened?">
                <textarea
                  className="textarea"
                  style={{ minHeight: 120 }}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="e.g. A resident had a fall in the bathroom during a transfer; the hoist was not used."
                />
              </Field>
              <div className="row gap-8 wrap">
                {["Medication double-dose not cross-checked on the MAR chart", "Resident fall during a transfer without the hoist", "Possible safeguarding concern — unexplained bruising noticed", "PPE not worn during personal care"].map((s) => (
                  <button key={s} className="btn sm" style={{ fontWeight: 400, textAlign: "left", height: "auto", padding: "7px 10px" }} onClick={() => setText(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <button className="btn ai" onClick={run} disabled={!text.trim() || loading}>
                <Icon name="sparkle" size={15} /> {loading ? "Analysing…" : "Analyse with AI"}
              </button>
            </div>
          </Card>

          {(loading || data) && (
            <AiPanel title="AI analysis" sub="Root cause & recommended learning" icon="brain" right={data && <AiChip />}>
              {loading && <AiThinking label="Identifying root causes and training needs…" />}
              {data && (
                <div className="col gap-14">
                  <div className="row gap-8 wrap">
                    <Badge tone={sevTone(data.severity) as "red"} dot>{data.severity} severity</Badge>
                    <span className="ai-chip soft">{data.category}</span>
                    {data.cqcDomains.map((d) => <CqcChip key={d} domain={d} color={cqcColor(d)} />)}
                  </div>

                  <div>
                    <div className="section-title" style={{ marginBottom: 7 }}>Likely root causes</div>
                    <div className="col gap-6">
                      {data.rootCauses.map((c) => (
                        <div key={c} className="row gap-8 small" style={{ color: "var(--ink-2)" }}>
                          <Icon name="target" size={14} style={{ color: "var(--ai-1)", marginTop: 2, flexShrink: 0 }} /> {c}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="section-title" style={{ marginBottom: 7 }}>Recommended training</div>
                    <div className="col gap-8">
                      {data.recommendedModules.map((m) => (
                        <div key={m.title} className="ai-field">
                          <Icon name="award" size={16} style={{ color: "var(--ai-1)", flexShrink: 0 }} />
                          <div className="flex-1">
                            <b className="small">{m.title}</b>
                            <div className="tiny muted">{m.why}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="section-title" style={{ marginBottom: 7 }}>Corrective actions</div>
                    <div className="col gap-6">
                      {data.correctiveActions.map((a) => (
                        <div key={a} className="row gap-8 small" style={{ color: "var(--ink-2)" }}>
                          <Icon name="checkCircle" size={14} style={{ color: "var(--green)", marginTop: 2, flexShrink: 0 }} /> {a}
                        </div>
                      ))}
                    </div>
                  </div>

                  <Button variant="primary" icon="check" onClick={logIt}>Log incident &amp; raise training actions</Button>
                </div>
              )}
            </AiPanel>
          )}
        </div>

        {/* Log */}
        <Card>
          <CardHead title="Incident log" sub={`${incidents.length} recorded`} icon="history" />
          <div className="card-body">
            {incidents.length === 0 ? (
              <Empty icon="flag" title="No incidents logged" />
            ) : (
              <div className="timeline">
                {incidents.map((i) => (
                  <div className={`tl-item ${i.analysis.severity === "high" ? "red" : ""}`} key={i.id}>
                    <div className="tl-time">{fmtDate(i.date)}</div>
                    <div className="row gap-8" style={{ margin: "2px 0 5px" }}>
                      <b className="small">{i.analysis.category}</b>
                      <Badge tone={sevTone(i.analysis.severity) as "red"}>{i.analysis.severity}</Badge>
                    </div>
                    <p className="small muted" style={{ margin: "0 0 7px" }}>{i.summary}</p>
                    <div className="row gap-6 wrap">
                      {i.analysis.recommendedModules.map((m) => (
                        <span key={m.title} className="cqc-chip"><Icon name="award" size={11} /> {m.title}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
