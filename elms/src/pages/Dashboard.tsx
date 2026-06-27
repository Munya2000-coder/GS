import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { Avatar, Badge, Button, Card, CardHead, Donut, Kpi, Meter, ProgressRing } from "../components/ui";
import { Icon } from "../components/Icon";
import {
  byDomain,
  byStaff,
  compliancePct,
  dueSoon,
  missingEvidence,
  overdue,
  pendingApprovals,
  ragCounts,
} from "../lib/analytics";
import { CQC_DOMAINS, fmtDate, relativeExpiry } from "../lib/domain";

export function Dashboard() {
  const { computed, staff, user } = useStore();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const pct = compliancePct(computed);
    const counts = ragCounts(computed);
    return {
      pct,
      counts,
      overdue: overdue(computed),
      dueSoon: dueSoon(computed),
      missing: missingEvidence(computed),
      pending: pendingApprovals(computed),
      domains: byDomain(computed),
      staffRank: byStaff(computed, staff),
      activeStaff: staff.filter((s) => s.employmentStatus !== "Left").length,
    };
  }, [computed, staff]);

  const donutSegs = [
    { value: stats.counts.green, color: "#16a34a", label: "In date" },
    { value: stats.counts.amber, color: "#d97706", label: "Due soon" },
    { value: stats.counts.red, color: "#dc2626", label: "Overdue" },
    { value: stats.counts.na, color: "#cbd5e1", label: "Awaiting" },
  ];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Good morning, {user?.name.split(" ")[0]} 👋</h1>
          <p>
            Organisation-wide training compliance for ELMS Health Solutions, refreshed{" "}
            {fmtDate("2026-06-27")}. {stats.overdue.length} items need attention today.
          </p>
        </div>
        <div className="row gap-8">
          <Button icon="download" onClick={() => navigate("/reports")}>
            Export
          </Button>
          <Button variant="primary" icon="shield" onClick={() => navigate("/reports")}>
            CQC evidence pack
          </Button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid" style={{ gridTemplateColumns: "repeat(5, 1fr)", marginBottom: 18 }}>
        <Kpi
          label="Overall compliance"
          value={`${stats.pct}%`}
          icon="trendingUp"
          tone={stats.pct >= 90 ? "green" : stats.pct >= 75 ? "amber" : "red"}
          trend={{ dir: "up", value: "3.2%", good: true }}
          sub="vs last month"
        />
        <Kpi label="Overdue training" value={stats.overdue.length} icon="alert" tone="red" sub="mandatory at risk" />
        <Kpi label="Due within 60 days" value={stats.dueSoon.length} icon="clock" tone="amber" sub="needs booking" />
        <Kpi label="Pending approvals" value={stats.pending.length} icon="upload" tone="blue" sub="awaiting review" />
        <Kpi label="Active staff" value={stats.activeStaff} icon="staff" tone="brand" sub="across 4 teams" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)" }}>
        {/* LEFT column */}
        <div className="col gap-16">
          {/* compliance breakdown */}
          <Card>
            <CardHead title="Compliance overview" sub="Every applicable training record, by RAG status" icon="activity" />
            <div className="card-body row gap-24" style={{ alignItems: "center" }}>
              <Donut
                segments={donutSegs}
                size={168}
                stroke={22}
                centerTop={<b style={{ color: stats.pct >= 90 ? "#16a34a" : stats.pct >= 75 ? "#d97706" : "#dc2626" }}>{stats.pct}%</b>}
                centerBottom="compliant"
              />
              <div className="flex-1 legend">
                {donutSegs.map((s) => {
                  const total = stats.counts.total || 1;
                  return (
                    <div className="legend-item" key={s.label}>
                      <span className="sw" style={{ background: s.color }} />
                      <span>{s.label}</span>
                      <b>
                        {s.value}{" "}
                        <span className="tiny muted">({Math.round((s.value / total) * 100)}%)</span>
                      </b>
                    </div>
                  );
                })}
                <div className="divider" style={{ margin: "4px 0" }} />
                <div className="legend-item">
                  <span style={{ color: "var(--muted)" }}>Missing evidence</span>
                  <b>{stats.missing.length}</b>
                </div>
                <div className="legend-item">
                  <span style={{ color: "var(--muted)" }}>Total tracked records</span>
                  <b>{stats.counts.total}</b>
                </div>
              </div>
            </div>
          </Card>

          {/* CQC domains */}
          <Card>
            <CardHead
              title="Compliance by CQC domain"
              sub="Mapped to the five Key Questions"
              icon="shield"
              right={<Button size="sm" icon="report" onClick={() => navigate("/reports")}>Report</Button>}
            />
            <div className="card-body col gap-16">
              {stats.domains.map((d) => (
                <div key={d.domain}>
                  <div className="row between" style={{ marginBottom: 7 }}>
                    <span className="row gap-8" style={{ fontSize: 13, fontWeight: 600 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: d.color }} />
                      {d.domain}
                      <span className="tiny muted" style={{ fontWeight: 400 }}>
                        {CQC_DOMAINS.find((c) => c.key === d.domain)?.blurb}
                      </span>
                    </span>
                    <b className="mono" style={{ fontSize: 13 }}>{d.pct}%</b>
                  </div>
                  <Meter value={d.pct} color={d.color} />
                </div>
              ))}
            </div>
          </Card>

          {/* overdue list */}
          <Card>
            <CardHead
              title="Action required"
              sub={`${stats.overdue.length} overdue items`}
              icon="alert"
              right={<Button size="sm" iconRight="chevronRight" onClick={() => navigate("/overdue")}>View all</Button>}
            />
            <div className="table-wrap">
              <table className="tbl clickable">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Training</th>
                    <th>CQC</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.overdue.slice(0, 6).map((r) => (
                    <tr key={r.id} onClick={() => navigate(`/staff/${r.staffId}`)}>
                      <td>
                        <div className="cell-person">
                          <Avatar first={r.staff.firstName} last={r.staff.lastName} color={r.staff.avatarColor} size="sm" />
                          <div className="meta">
                            <b>{r.staff.firstName} {r.staff.lastName}</b>
                            <span>{r.staff.roleLabel}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="td-strong">{r.module.title}</span>
                        <div className="tiny muted">{r.module.code}</div>
                      </td>
                      <td>
                        <span className="cqc-chip">
                          <span className="d" style={{ background: CQC_DOMAINS.find((c) => c.key === r.module.cqcDomain)?.color }} />
                          {r.module.cqcDomain}
                        </span>
                      </td>
                      <td>
                        <Badge tone="red" dot>{relativeExpiry(r.daysToExpiry)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* RIGHT column */}
        <div className="col gap-16">
          {/* quick actions */}
          <Card className="card-pad">
            <div className="section-title" style={{ marginBottom: 12 }}>Quick actions</div>
            <div className="col gap-8">
              <Button block icon="upload" style={{ justifyContent: "flex-start" }} onClick={() => navigate("/evidence")}>
                Review {stats.pending.length} pending certificates
              </Button>
              <Button block icon="staff" style={{ justifyContent: "flex-start" }} onClick={() => navigate("/staff")}>
                Add a staff member
              </Button>
              <Button block icon="book" style={{ justifyContent: "flex-start" }} onClick={() => navigate("/catalogue")}>
                Configure training matrix
              </Button>
              <Button block icon="clipboard" style={{ justifyContent: "flex-start" }} onClick={() => navigate("/reviews")}>
                Annual review sign-off
              </Button>
            </div>
          </Card>

          {/* lowest compliance staff */}
          <Card>
            <CardHead title="Lowest compliance" sub="Staff needing follow-up" icon="users2" />
            <div className="card-body col gap-14">
              {stats.staffRank.slice(0, 6).map((s) => (
                <div
                  key={s.staff.id}
                  className="row gap-10"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/staff/${s.staff.id}`)}
                >
                  <Avatar first={s.staff.firstName} last={s.staff.lastName} color={s.staff.avatarColor} size="sm" />
                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <div className="row between">
                      <span className="truncate" style={{ fontWeight: 600, fontSize: 13 }}>
                        {s.staff.firstName} {s.staff.lastName}
                      </span>
                      <b className="mono tiny">{s.pct}%</b>
                    </div>
                    <Meter value={s.pct} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* compliance health card */}
          <Card className="card-pad">
            <div className="row between">
              <div>
                <div className="section-title">Inspection readiness</div>
                <div className="muted small" style={{ marginTop: 4 }}>
                  Based on mandatory training & evidence
                </div>
              </div>
              <ProgressRing value={Math.min(99, stats.pct + 4)} size={84} stroke={9} />
            </div>
            <div className="col gap-8" style={{ marginTop: 14 }}>
              {[
                { label: "Mandatory training current", ok: stats.overdue.length < 5 },
                { label: "Evidence on file", ok: stats.missing.length < 10 },
                { label: "Annual review signed off", ok: true },
                { label: "DBS & RTW in date", ok: true },
              ].map((x) => (
                <div className="row gap-8 small" key={x.label}>
                  <span style={{ color: x.ok ? "var(--green)" : "var(--amber)", display: "grid", placeItems: "center" }}>
                    <Icon name={x.ok ? "checkCircle" : "alert"} size={16} />
                  </span>
                  {x.label}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
