import { useMemo, useState } from "react";
import { useStore } from "../store/store";
import { Avatar, Button, Card, CardHead, CqcChip, Empty, Field, Kpi, Modal, Tabs } from "../components/ui";
import { Icon } from "../components/Icon";
import { cqcColor, fmtDate } from "../lib/domain";
import type { ComputedRecord } from "../data/types";

export function Evidence() {
  const { computed, approveRecord, rejectRecord, inspectionMode } = useStore();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [rejecting, setRejecting] = useState<ComputedRecord | null>(null);

  const groups = useMemo(() => {
    const withEvidence = computed.filter((r) => r.evidence);
    return {
      pending: withEvidence.filter((r) => r.approval === "pending"),
      approved: withEvidence.filter((r) => r.approval === "approved"),
      rejected: withEvidence.filter((r) => r.approval === "rejected"),
    };
  }, [computed]);

  const list = groups[tab];

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Evidence &amp; Approvals</h1>
          <p>
            Certificate approval workflow. Uploaded evidence is verified by the Operations Manager
            before training status updates and expiry is recalculated.
          </p>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <Kpi label="Awaiting approval" value={groups.pending.length} icon="clock" tone="blue" sub="action needed" />
        <Kpi label="Approved this cycle" value={groups.approved.length} icon="checkCircle" tone="green" />
        <Kpi label="Returned / rejected" value={groups.rejected.length} icon="xCircle" tone="red" />
      </div>

      {/* Workflow strip */}
      <Card className="card-pad" style={{ marginBottom: 18 }}>
        <div className="row between wrap gap-12">
          {[
            { i: "upload" as const, t: "Upload", s: "Staff submits certificate" },
            { i: "clock" as const, t: "Pending", s: "Operations Manager review" },
            { i: "checkCircle" as const, t: "Approve / return", s: "Verify or request more info" },
            { i: "refresh" as const, t: "Auto-update", s: "Status & expiry recalculated" },
            { i: "history" as const, t: "Audit", s: "Logged with timestamp" },
          ].map((s, i, arr) => (
            <div className="row gap-12 flex-1" key={s.t} style={{ minWidth: 150 }}>
              <span className="kpi-icon" style={{ background: "var(--brand-50)", color: "var(--brand-700)", flexShrink: 0 }}>
                <Icon name={s.i} size={18} />
              </span>
              <div>
                <b className="small">{s.t}</b>
                <div className="tiny muted">{s.s}</div>
              </div>
              {i < arr.length - 1 && <Icon name="chevronRight" size={16} style={{ color: "var(--muted-2)", marginLeft: "auto" }} />}
            </div>
          ))}
        </div>
      </Card>

      <div style={{ marginBottom: 14 }}>
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "pending", label: `Pending (${groups.pending.length})` },
            { key: "approved", label: `Approved (${groups.approved.length})` },
            { key: "rejected", label: `Rejected (${groups.rejected.length})` },
          ]}
        />
      </div>

      <Card>
        <CardHead title={`${tab[0].toUpperCase()}${tab.slice(1)} certificates`} icon="upload" />
        {list.length === 0 ? (
          <Empty icon="checkCircle" title="Nothing here" hint="All caught up — no items in this queue." />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Module</th>
                  <th>CQC</th>
                  <th>Evidence</th>
                  <th>Uploaded</th>
                  {!inspectionMode && tab === "pending" && <th style={{ textAlign: "right" }}>Decision</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="cell-person">
                        <Avatar first={r.staff.firstName} last={r.staff.lastName} color={r.staff.avatarColor} size="sm" />
                        <div className="meta">
                          <b>{r.staff.firstName} {r.staff.lastName}</b>
                          <span>{r.staff.roleLabel}</span>
                        </div>
                      </div>
                    </td>
                    <td><span className="td-strong">{r.module.title}</span><div className="tiny muted">{r.module.code}</div></td>
                    <td><CqcChip domain={r.module.cqcDomain} color={cqcColor(r.module.cqcDomain)} /></td>
                    <td>
                      <span className="row gap-7">
                        <Icon name="file" size={15} style={{ color: "var(--red-ink)" }} />
                        <span className="truncate small" style={{ maxWidth: 180 }}>{r.evidence?.fileName}</span>
                      </span>
                    </td>
                    <td className="td-muted small">{fmtDate(r.evidence?.uploadedAt)}</td>
                    {!inspectionMode && tab === "pending" && (
                      <td>
                        <div className="row gap-8 end">
                          <Button size="sm" variant="ghost" icon="x" onClick={() => setRejecting(r)}>Return</Button>
                          <Button size="sm" variant="primary" icon="check" onClick={() => approveRecord(r.id)}>Approve</Button>
                        </div>
                      </td>
                    )}
                    {tab === "rejected" && r.notes && (
                      <td className="small" style={{ color: "var(--red-ink)" }}>{r.notes}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {rejecting && (
        <RejectModal
          rec={rejecting}
          onClose={() => setRejecting(null)}
          onReject={(reason) => {
            rejectRecord(rejecting.id, reason);
            setRejecting(null);
          }}
        />
      )}
    </>
  );
}

function RejectModal({
  rec,
  onClose,
  onReject,
}: {
  rec: ComputedRecord;
  onClose: () => void;
  onReject: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const presets = [
    "Certificate illegible — please re-upload a clear copy.",
    "Expiry date not visible on the document.",
    "Wrong training certificate uploaded.",
    "Provider not on approved list — please confirm.",
  ];
  return (
    <Modal
      title="Return certificate"
      icon="xCircle"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="danger" icon="send" disabled={!reason} onClick={() => onReject(reason)}>Return to staff</Button>
        </>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        Returning <b style={{ color: "var(--ink)" }}>{rec.module.title}</b> for{" "}
        {rec.staff.firstName} {rec.staff.lastName}. They will be notified to re-submit.
      </p>
      <Field label="Reason for return">
        <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what's needed…" />
      </Field>
      <div className="col gap-6" style={{ marginTop: 10 }}>
        {presets.map((p) => (
          <button key={p} className="btn sm" style={{ justifyContent: "flex-start", fontWeight: 400 }} onClick={() => setReason(p)}>
            {p}
          </button>
        ))}
      </div>
    </Modal>
  );
}
