import { useMemo, useState } from "react";
import { useStore } from "../store/store";
import { Avatar, Badge, Button, Card, CqcChip, Modal, RagBadge } from "../components/ui";
import { Icon } from "../components/Icon";
import { CQC_DOMAINS, cqcColor, fmtDate, relativeExpiry } from "../lib/domain";
import type { ComputedRecord, RagStatus, Staff, TrainingModule } from "../data/types";

const CELL_CLASS: Record<RagStatus, string> = {
  green: "mx-g",
  amber: "mx-a",
  red: "mx-r",
  grey: "mx-grey",
  na: "mx-na",
};

export function TrainingMatrix() {
  const { staff, modules, computed } = useStore();
  const [domain, setDomain] = useState<string>("all");
  const [team, setTeam] = useState<string>("all");
  const [detail, setDetail] = useState<ComputedRecord | null>(null);

  const activeStaff = staff.filter((s) => s.employmentStatus !== "Left" && (team === "all" || s.branch === team));
  const activeModules = modules.filter((m) => !m.retired && (domain === "all" || m.cqcDomain === domain));

  const lookup = useMemo(() => {
    const map = new Map<string, ComputedRecord>();
    for (const r of computed) map.set(`${r.staffId}:${r.moduleId}`, r);
    return map;
  }, [computed]);

  function appliesTo(m: TrainingModule, s: Staff) {
    return m.appliesTo.length === 0 || m.appliesTo.includes(s.role);
  }

  const teams = Array.from(new Set(staff.map((s) => s.branch)));

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Training Matrix</h1>
          <p>
            The live CQC training matrix — every applicable module per staff member, colour-coded by
            compliance. Click any cell for detail.
          </p>
        </div>
        <Button icon="download">Export matrix</Button>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div className="card-pad row gap-12 wrap between">
          <div className="row gap-12 wrap">
            <select className="select" style={{ width: 190 }} value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="all">All CQC domains</option>
              {CQC_DOMAINS.map((d) => <option key={d.key} value={d.key}>{d.key}</option>)}
            </select>
            <select className="select" style={{ width: 170 }} value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="all">All teams</option>
              {teams.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="row gap-14 wrap small">
            {[
              { c: "var(--green)", l: "In date" },
              { c: "var(--amber)", l: "Due soon" },
              { c: "var(--red)", l: "Overdue" },
              { c: "var(--blue)", l: "Pending" },
              { c: "#cbd5e1", l: "Not started" },
              { c: "#e2e8f0", l: "N/A" },
            ].map((x) => (
              <span className="row gap-6" key={x.l}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: x.c }} /> {x.l}
              </span>
            ))}
          </div>
        </div>
      </Card>

      <Card style={{ overflow: "hidden" }}>
        <div className="matrix-scroll">
          <table className="matrix">
            <thead>
              <tr>
                <th className="corner">Staff member</th>
                {activeModules.map((m) => (
                  <th key={m.id} title={m.title}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: cqcColor(m.cqcDomain) }} />
                      <span style={{ fontSize: 10.5, lineHeight: 1.2 }}>{m.code}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeStaff.map((s) => (
                <tr key={s.id}>
                  <td className="person-col">
                    <div className="cell-person">
                      <Avatar first={s.firstName} last={s.lastName} color={s.avatarColor} size="sm" />
                      <div className="meta">
                        <b>{s.firstName} {s.lastName}</b>
                        <span>{s.roleLabel}</span>
                      </div>
                    </div>
                  </td>
                  {activeModules.map((m) => {
                    if (!appliesTo(m, s)) {
                      return (
                        <td key={m.id} style={{ padding: 0 }}>
                          <div className="mx-cell mx-na" title="Not applicable to this role" />
                        </td>
                      );
                    }
                    const rec = lookup.get(`${s.id}:${m.id}`);
                    const rag: RagStatus = rec?.rag ?? "na";
                    const pending = rec?.approval === "pending";
                    const rejected = rec?.approval === "rejected";
                    return (
                      <td key={m.id} style={{ padding: 0 }}>
                        <div
                          className={`mx-cell ${pending ? "" : CELL_CLASS[rag]}`}
                          style={pending ? { background: "var(--blue-bg)" } : rejected ? { background: "var(--red-bg)" } : undefined}
                          title={`${s.firstName} — ${m.title}`}
                          onClick={() => rec && setDetail(rec)}
                        >
                          <CellMark rag={rag} pending={pending} rejected={rejected} notStarted={rec?.recordStatus === "not_started"} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {detail && <CellDetail rec={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function CellMark({
  rag,
  pending,
  rejected,
  notStarted,
}: {
  rag: RagStatus;
  pending?: boolean;
  rejected?: boolean;
  notStarted?: boolean;
}) {
  if (pending)
    return <span className="pill" style={{ background: "rgba(37,99,235,.16)", color: "var(--blue-ink)" }}><Icon name="clock" size={13} /></span>;
  if (rejected)
    return <span className="pill" style={{ background: "rgba(220,38,38,.16)", color: "var(--red-ink)" }}><Icon name="x" size={13} /></span>;
  if (notStarted || rag === "na") return <span style={{ color: "var(--muted-2)", fontSize: 13 }}>–</span>;
  const map: Record<string, { c: string; i: "check" | "clock" | "alert" }> = {
    green: { c: "var(--green-ink)", i: "check" },
    amber: { c: "var(--amber-ink)", i: "clock" },
    red: { c: "var(--red-ink)", i: "alert" },
    grey: { c: "var(--grey-ink)", i: "check" },
  };
  const m = map[rag] ?? map.grey;
  return (
    <span className="pill" style={{ background: "rgba(255,255,255,.5)", color: m.c }}>
      <Icon name={m.i} size={13} />
    </span>
  );
}

function CellDetail({ rec, onClose }: { rec: ComputedRecord; onClose: () => void }) {
  return (
    <Modal title="Training record" icon="matrix" onClose={onClose} footer={<Button variant="primary" onClick={onClose}>Close</Button>}>
      <div className="row gap-12" style={{ marginBottom: 16 }}>
        <Avatar first={rec.staff.firstName} last={rec.staff.lastName} color={rec.staff.avatarColor} size="md" />
        <div>
          <b>{rec.staff.firstName} {rec.staff.lastName}</b>
          <div className="tiny muted">{rec.staff.roleLabel} · {rec.staff.branch}</div>
        </div>
        <div className="ml-auto">
          {rec.approval === "pending" ? <Badge tone="blue" dot>Pending approval</Badge>
            : rec.approval === "rejected" ? <Badge tone="red" dot>Rejected</Badge>
            : <RagBadge rag={rec.rag} />}
        </div>
      </div>
      <div className="col gap-12">
        <Row label="Module" value={<><b>{rec.module.title}</b> <span className="tiny muted">({rec.module.code})</span></>} />
        <Row label="Category" value={rec.module.category} />
        <Row label="CQC domain" value={<CqcChip domain={rec.module.cqcDomain} color={cqcColor(rec.module.cqcDomain)} />} />
        <Row label="Refresh frequency" value={rec.module.refresh} />
        <Row label="Completed" value={fmtDate(rec.completionDate)} />
        <Row label="Expires" value={`${fmtDate(rec.expiryDate)} · ${relativeExpiry(rec.daysToExpiry)}`} />
        <Row label="Evidence" value={rec.evidence ? `${rec.evidence.fileName} ${rec.evidence.verified ? "✓ verified" : "(unverified)"}` : "No evidence on file"} />
        {rec.notes && <Row label="Notes" value={rec.notes} />}
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="row between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 9 }}>
      <span className="small muted">{label}</span>
      <span className="small" style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}
