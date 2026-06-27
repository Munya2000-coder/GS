import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { Avatar, Badge, Button, Card, CardHead, CqcChip, Empty, Kpi, Tabs } from "../components/ui";
import { Icon } from "../components/Icon";
import { cqcColor, fmtDate, relativeExpiry } from "../lib/domain";
import { dueSoon, missingEvidence, overdue } from "../lib/analytics";
import { AiPanel, AiThinking, useAiTask } from "../components/ai";
import { aiLapseRisk, aiPlanTraining } from "../lib/ai";

const REMINDER_STAGES = [
  { d: "90 days", who: "Ops & Training Manager notified · added to planner", tone: "blue" as const },
  { d: "60 days", who: "External provider booked · staff notified", tone: "blue" as const },
  { d: "30 days", who: "Email + SMS to staff · manager escalation if unbooked", tone: "amber" as const },
  { d: "7 days", who: "Final reminder · dashboard turns Amber", tone: "amber" as const },
  { d: "Expired", who: "Status Red · escalation to Ops Manager", tone: "red" as const },
];

export function Overdue() {
  const { computed, pushToast } = useStore();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"overdue" | "soon" | "missing">("overdue");

  const data = useMemo(
    () => ({
      overdue: overdue(computed),
      soon: dueSoon(computed),
      missing: missingEvidence(computed),
    }),
    [computed],
  );

  const rows = tab === "overdue" ? data.overdue : tab === "soon" ? data.soon : data.missing;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Overdue &amp; Due Soon</h1>
          <p>Proactive training planning — never miss a mandatory renewal. Reminders fire automatically by email, SMS and dashboard.</p>
        </div>
        <Button variant="primary" icon="bell" onClick={() => pushToast({ kind: "success", title: "Reminders sent", body: `Notified staff & managers for ${data.overdue.length + data.soon.length} items.` })}>
          Send reminders now
        </Button>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <Kpi label="Overdue" value={data.overdue.length} icon="alert" tone="red" sub="status Red" />
        <Kpi label="Due within 60 days" value={data.soon.length} icon="clock" tone="amber" sub="status Amber" />
        <Kpi label="Missing evidence" value={data.missing.length} icon="file" tone="blue" sub="certificate required" />
      </div>

      {/* Reminder schedule */}
      <Card style={{ marginBottom: 18 }}>
        <CardHead title="Automated reminder schedule" sub="From the configurable training-planning workflow" icon="zap" />
        <div className="card-body row gap-8 wrap">
          {REMINDER_STAGES.map((s, i, arr) => (
            <div key={s.d} className="row gap-8 flex-1" style={{ minWidth: 200 }}>
              <div style={{ flex: 1 }}>
                <Badge tone={s.tone} dot>{s.d}</Badge>
                <div className="tiny muted" style={{ marginTop: 6 }}>{s.who}</div>
              </div>
              {i < arr.length - 1 && <Icon name="chevronRight" size={16} style={{ color: "var(--muted-2)" }} />}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", marginBottom: 18 }}>
        <LapseRiskAi />
        <TrainingPlannerAi />
      </div>

      <div style={{ marginBottom: 14 }}>
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "overdue", label: `Overdue (${data.overdue.length})` },
            { key: "soon", label: `Due soon (${data.soon.length})` },
            { key: "missing", label: `Missing evidence (${data.missing.length})` },
          ]}
        />
      </div>

      <Card>
        {rows.length === 0 ? (
          <Empty icon="checkCircle" title="All clear" hint="No items in this category right now." />
        ) : (
          <div className="table-wrap">
            <table className="tbl clickable">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Training</th>
                  <th>CQC</th>
                  <th>Expiry</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => navigate(`/staff/${r.staffId}`)}>
                    <td>
                      <div className="cell-person">
                        <Avatar first={r.staff.firstName} last={r.staff.lastName} color={r.staff.avatarColor} size="sm" />
                        <div className="meta">
                          <b>{r.staff.firstName} {r.staff.lastName}</b>
                          <span>{r.staff.roleLabel} · {r.staff.branch}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="td-strong">{r.module.title}</span><div className="tiny muted">{r.module.category}</div></td>
                    <td><CqcChip domain={r.module.cqcDomain} color={cqcColor(r.module.cqcDomain)} /></td>
                    <td className="td-muted">{fmtDate(r.expiryDate)}</td>
                    <td>
                      {tab === "missing" ? (
                        <Badge tone="blue" dot>Evidence required</Badge>
                      ) : (
                        <Badge tone={r.rag === "red" ? "red" : "amber"} dot>{relativeExpiry(r.daysToExpiry)}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function LapseRiskAi() {
  const { computed, staff } = useStore();
  const navigate = useNavigate();
  const { loading, data, run } = useAiTask(() => aiLapseRisk(computed, staff));
  const top = (data ?? []).filter((r) => r.band !== "low").slice(0, 5);

  return (
    <AiPanel
      title="Lapse-risk radar"
      sub="Predicts who is most likely to let mandatory training lapse"
      icon="target"
      right={
        !data && (
          <button className="btn ai sm" onClick={run} disabled={loading}>
            <Icon name="sparkle" size={13} /> {loading ? "Scoring…" : "Predict"}
          </button>
        )
      }
    >
      {!data && !loading && (
        <div className="small" style={{ color: "#5b4b86" }}>
          AI weighs overdue history, upcoming renewals, contract type and induction status to flag staff
          to chase <i>before</i> they slip — so you act early, not late.
        </div>
      )}
      {loading && <AiThinking label="Scoring lapse risk across the workforce…" />}
      {data && (
        <div className="col gap-8">
          {top.length === 0 && <div className="small muted">No elevated-risk staff — the team is on track. 🎉</div>}
          {top.map((r) => (
            <div key={r.staff.id} className="ai-field" style={{ cursor: "pointer" }} onClick={() => navigate(`/staff/${r.staff.id}`)}>
              <Avatar first={r.staff.firstName} last={r.staff.lastName} color={r.staff.avatarColor} size="sm" />
              <div className="flex-1" style={{ minWidth: 0 }}>
                <b className="small">{r.staff.firstName} {r.staff.lastName}</b>
                <div className="tiny muted truncate">{r.drivers[0]}{r.drivers[1] ? ` · ${r.drivers[1]}` : ""}</div>
              </div>
              <span className={`risk-tag ${r.band}`}>{r.band === "high" ? "High" : "Medium"} · {r.score}</span>
            </div>
          ))}
        </div>
      )}
    </AiPanel>
  );
}

function TrainingPlannerAi() {
  const { computed, pushToast } = useStore();
  const { loading, data, run } = useAiTask(() => aiPlanTraining(computed));

  return (
    <AiPanel
      title="Smart training planner"
      sub="Groups upcoming renewals into cost-saving booking suggestions"
      icon="stars"
      right={
        !data && (
          <button className="btn ai sm" onClick={run} disabled={loading}>
            <Icon name="sparkle" size={13} /> {loading ? "Planning…" : "Plan"}
          </button>
        )
      }
    >
      {!data && !loading && (
        <div className="small" style={{ color: "#5b4b86" }}>
          AI clusters classroom &amp; provider-led renewals coming due into suggested group sessions —
          fewer bookings, lower cost, less admin.
        </div>
      )}
      {loading && <AiThinking label="Building the optimal training plan…" />}
      {data && (
        <div className="col gap-8">
          {data.length === 0 && <div className="small muted">No provider-led sessions need booking right now.</div>}
          {data.slice(0, 4).map((s) => (
            <div key={s.module.id} className="ai-field">
              <div className="flex-1" style={{ minWidth: 0 }}>
                <b className="small">{s.module.title}</b>
                <div className="tiny muted truncate">{s.count} staff · {s.suggestedDate} · {s.module.provider}</div>
              </div>
              <button
                className="btn ai-outline sm"
                style={{ flexShrink: 0 }}
                onClick={() => pushToast({ kind: "success", title: "Session booked", body: `${s.module.title} — ${s.count} staff on ${s.suggestedDate}.` })}
              >
                <Icon name="calendar" size={13} /> Book
              </button>
            </div>
          ))}
        </div>
      )}
    </AiPanel>
  );
}
