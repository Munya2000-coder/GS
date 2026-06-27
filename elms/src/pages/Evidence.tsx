import { useEffect, useMemo, useState } from "react";
import { useStore } from "../store/store";
import { Avatar, Badge, Button, Card, CardHead, CqcChip, Empty, Field, Kpi, Modal, Tabs } from "../components/ui";
import { Icon } from "../components/Icon";
import { cqcColor, fmtDate } from "../lib/domain";
import { AiChip, AiPanel, AiThinking, Confidence, useAiTask } from "../components/ai";
import { aiExtractCertificate, type CertExtraction } from "../lib/ai";
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
  const [aiFor, setAiFor] = useState<ComputedRecord | null>(null);

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

      {tab === "pending" && groups.pending.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <AiTriage records={groups.pending} onReview={setAiFor} onApprove={approveRecord} />
        </div>
      )}

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
                          <button className="btn ai-outline sm" onClick={() => setAiFor(r)}>
                            <Icon name="sparkle" size={13} /> AI review
                          </button>
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

      {aiFor && (
        <CertAiModal
          rec={aiFor}
          onClose={() => setAiFor(null)}
          onApprove={() => { approveRecord(aiFor.id); setAiFor(null); }}
          onReturn={() => { setRejecting(aiFor); setAiFor(null); }}
        />
      )}
    </>
  );
}

function recBadgeTone(r: CertExtraction["recommendation"]) {
  return r === "approve" ? "green" : r === "review" ? "amber" : "red";
}
function recLabel(r: CertExtraction["recommendation"]) {
  return r === "approve" ? "Recommend approve" : r === "review" ? "Needs human check" : "Recommend return";
}

function AiTriage({
  records,
  onReview,
  onApprove,
}: {
  records: ComputedRecord[];
  onReview: (r: ComputedRecord) => void;
  onApprove: (id: string) => void;
}) {
  const { pushToast } = useStore();
  const { loading, data, run } = useAiTask(async () => {
    const results = await Promise.all(records.map(async (r) => ({ rec: r, ex: await aiExtractCertificate(r) })));
    return results;
  });

  const autoApprovable = data?.filter((d) => d.ex.recommendation === "approve") ?? [];

  return (
    <AiPanel
      title="AI certificate triage"
      sub="Reads each uploaded certificate, extracts the key fields and recommends a decision"
      icon="scan"
      right={
        !data ? (
          <button className="btn ai sm" onClick={run} disabled={loading}>
            <Icon name="sparkle" size={13} /> {loading ? "Analysing…" : `Triage ${records.length}`}
          </button>
        ) : (
          <AiChip label={`${data.length} analysed`} />
        )
      }
    >
      {!data && !loading && (
        <div className="small" style={{ color: "#5b4b86" }}>
          Run AI triage to auto-extract completion &amp; expiry dates, match each certificate to its module and
          staff member, flag anomalies, and surface which submissions are safe to fast-track.
        </div>
      )}
      {loading && <AiThinking label={`Reading ${records.length} certificates…`} />}
      {data && (
        <>
          <div className="row gap-12 wrap" style={{ marginBottom: 14 }}>
            <Badge tone="green" dot>{data.filter((d) => d.ex.recommendation === "approve").length} clear to approve</Badge>
            <Badge tone="amber" dot>{data.filter((d) => d.ex.recommendation === "review").length} need a check</Badge>
            <Badge tone="red" dot>{data.filter((d) => d.ex.recommendation === "return").length} recommend return</Badge>
            {autoApprovable.length > 0 && (
              <button
                className="btn ai sm ml-auto"
                onClick={() => {
                  autoApprovable.forEach((d) => onApprove(d.rec.id));
                  pushToast({ kind: "success", title: `${autoApprovable.length} certificates approved`, body: "AI-cleared submissions fast-tracked; statuses updated." });
                }}
              >
                <Icon name="check" size={13} /> Apply {autoApprovable.length} approvals
              </button>
            )}
          </div>
          <div className="col gap-8">
            {data.map(({ rec, ex }) => (
              <div key={rec.id} className="ai-field" style={{ cursor: "pointer" }} onClick={() => onReview(rec)}>
                <Avatar first={rec.staff.firstName} last={rec.staff.lastName} color={rec.staff.avatarColor} size="sm" />
                <div className="flex-1" style={{ minWidth: 0 }}>
                  <b className="small">{rec.staff.firstName} {rec.staff.lastName}</b>
                  <div className="tiny muted truncate">{rec.module.title} · expires {fmtDate(ex.expiryDate)}{ex.flags.length ? ` · ${ex.flags[0]}` : ""}</div>
                </div>
                <span className={`badge ${recBadgeTone(ex.recommendation)}`} style={{ flexShrink: 0 }}>{recLabel(ex.recommendation)}</span>
                <Icon name="chevronRight" size={15} style={{ color: "var(--muted-2)" }} />
              </div>
            ))}
          </div>
        </>
      )}
    </AiPanel>
  );
}

function CertAiModal({
  rec,
  onClose,
  onApprove,
  onReturn,
}: {
  rec: ComputedRecord;
  onClose: () => void;
  onApprove: () => void;
  onReturn: () => void;
}) {
  const { loading, data, run } = useAiTask(() => aiExtractCertificate(rec));
  useEffect(() => { run(); }, [run]);

  return (
    <Modal
      title="AI certificate review"
      icon="scan"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Close</Button>
          <Button variant="ghost" icon="x" onClick={onReturn}>Return</Button>
          <Button variant="primary" icon="check" onClick={onApprove}>Approve</Button>
        </>
      }
    >
      <div className="row gap-10" style={{ marginBottom: 14 }}>
        <Avatar first={rec.staff.firstName} last={rec.staff.lastName} color={rec.staff.avatarColor} size="md" />
        <div className="flex-1">
          <b>{rec.staff.firstName} {rec.staff.lastName}</b>
          <div className="tiny muted">{rec.module.title} · {rec.evidence?.fileName}</div>
        </div>
        <AiChip />
      </div>

      {loading || !data ? (
        <AiThinking label="Reading the certificate…" />
      ) : (
        <div className="col gap-12">
          <Confidence value={data.confidence} />
          <div className="col gap-8">
            <div className="ai-field"><span className="lbl">Learner</span><span className="val">{data.learnerName}</span></div>
            <div className="ai-field"><span className="lbl">Course</span><span className="val">{data.course}</span></div>
            <div className="ai-field"><span className="lbl">Provider</span><span className="val">{data.provider}</span></div>
            <div className="ai-field"><span className="lbl">Completed</span><span className="val">{fmtDate(data.completionDate)}</span></div>
            <div className="ai-field"><span className="lbl">Expires</span><span className="val">{fmtDate(data.expiryDate)}</span></div>
          </div>
          {data.flags.length > 0 && (
            <div className="col gap-6">
              {data.flags.map((f) => (
                <div key={f} className="row gap-8 small" style={{ color: "var(--amber-ink)" }}>
                  <Icon name="alert" size={15} /> {f}
                </div>
              ))}
            </div>
          )}
          <div className="row gap-10" style={{ padding: 12, borderRadius: 9, background: data.recommendation === "approve" ? "var(--green-bg)" : data.recommendation === "review" ? "var(--amber-bg)" : "var(--red-bg)" }}>
            <Icon name={data.recommendation === "approve" ? "checkCircle" : data.recommendation === "review" ? "eye" : "xCircle"} size={18} style={{ color: data.recommendation === "approve" ? "var(--green-ink)" : data.recommendation === "review" ? "var(--amber-ink)" : "var(--red-ink)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <b className="small">{recLabel(data.recommendation)}</b>
              <div className="tiny" style={{ color: "var(--ink-2)" }}>{data.reason}</div>
            </div>
          </div>
          <div className="tiny muted">AI suggestion only — the Operations Manager makes the final decision, and it is recorded in the audit trail.</div>
        </div>
      )}
    </Modal>
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
