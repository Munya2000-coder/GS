import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/store";
import { Avatar, Badge, Button, Card, CqcChip, Kpi, Modal, ProgressRing, RagBadge, Tabs } from "../components/ui";
import { Icon } from "../components/Icon";
import { compliancePct, ragCounts } from "../lib/analytics";
import { cqcColor, daysToExpiry, fmtDate, relativeExpiry } from "../lib/domain";

export function StaffProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { staff, computed, uploadEvidence, inspectionMode } = useStore();
  const [tab, setTab] = useState<"training" | "documents" | "activity">("training");
  const [uploadFor, setUploadFor] = useState<string | null>(null);

  const person = staff.find((s) => s.id === id);
  const records = useMemo(() => computed.filter((r) => r.staffId === id), [computed, id]);

  if (!person) {
    return (
      <Card className="card-pad">
        <p>Staff member not found.</p>
        <Button onClick={() => navigate("/staff")}>Back to register</Button>
      </Card>
    );
  }

  const pct = compliancePct(records);
  const counts = ragCounts(records);
  const manager = staff.find((s) => s.id === person.managerId);

  const docs = [
    { label: "DBS Certificate", date: person.dbsExpiry, icon: "shield" as const },
    { label: "Right to Work", date: person.rightToWorkExpiry, icon: "file" as const },
    ...(person.visaExpiry ? [{ label: "Visa / CoS", date: person.visaExpiry, icon: "file" as const }] : []),
  ];

  return (
    <>
      <button className="btn ghost sm" style={{ marginBottom: 14 }} onClick={() => navigate("/staff")}>
        <Icon name="chevronLeft" size={15} /> Staff Register
      </button>

      {/* Header card */}
      <Card className="card-pad" style={{ marginBottom: 16 }}>
        <div className="row gap-20 wrap items-start">
          <Avatar first={person.firstName} last={person.lastName} color={person.avatarColor} size="lg" />
          <div className="flex-1" style={{ minWidth: 220 }}>
            <div className="row gap-10 wrap" style={{ alignItems: "center" }}>
              <h1 style={{ fontSize: 22 }}>{person.firstName} {person.lastName}</h1>
              <Badge tone={person.employmentStatus === "Active" ? "green" : "blue"}>{person.employmentStatus}</Badge>
            </div>
            <div className="row gap-16 wrap muted small" style={{ marginTop: 8 }}>
              <span className="row gap-6"><Icon name="user" size={14} /> {person.roleLabel}</span>
              <span className="row gap-6"><Icon name="grid" size={14} /> {person.branch}</span>
              <span className="row gap-6"><Icon name="mail" size={14} /> {person.email}</span>
              <span className="row gap-6"><Icon name="phone" size={14} /> {person.phone}</span>
            </div>
            <div className="row gap-16 wrap muted small" style={{ marginTop: 6 }}>
              <span className="row gap-6"><Icon name="calendar" size={14} /> Started {fmtDate(person.startDate)}</span>
              <span className="row gap-6"><Icon name="file" size={14} /> {person.contractType}</span>
              {manager && <span className="row gap-6"><Icon name="users2" size={14} /> Reports to {manager.firstName} {manager.lastName}</span>}
            </div>
          </div>
          <div className="row gap-20" style={{ alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <ProgressRing value={pct} size={92} stroke={9} />
              <div className="tiny muted" style={{ marginTop: 4 }}>Training compliance</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        <Kpi label="In date" value={counts.green} icon="checkCircle" tone="green" />
        <Kpi label="Due soon" value={counts.amber} icon="clock" tone="amber" />
        <Kpi label="Overdue" value={counts.red} icon="alert" tone="red" />
        <Kpi label="Not started" value={counts.na} icon="flag" tone="blue" />
      </div>

      <div className="row between" style={{ marginBottom: 14 }}>
        <Tabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: "training", label: `Training (${records.length})` },
            { key: "documents", label: "Documents" },
            { key: "activity", label: "Activity" },
          ]}
        />
      </div>

      {tab === "training" && (
        <Card>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Training module</th>
                  <th>CQC domain</th>
                  <th>Completed</th>
                  <th>Expires</th>
                  <th>Status</th>
                  {!inspectionMode && <th></th>}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="td-strong">{r.module.title}</span>
                      <div className="tiny muted">{r.module.category} · {r.module.refresh}</div>
                    </td>
                    <td><CqcChip domain={r.module.cqcDomain} color={cqcColor(r.module.cqcDomain)} /></td>
                    <td className="td-muted">{fmtDate(r.completionDate)}</td>
                    <td>
                      <span className="td-strong">{fmtDate(r.expiryDate)}</span>
                      {r.daysToExpiry !== null && (
                        <div className="tiny muted">{relativeExpiry(r.daysToExpiry)}</div>
                      )}
                    </td>
                    <td>
                      {r.approval === "pending" ? (
                        <Badge tone="blue" dot>Pending approval</Badge>
                      ) : r.approval === "rejected" ? (
                        <Badge tone="red" dot>Rejected</Badge>
                      ) : (
                        <RagBadge rag={r.rag} />
                      )}
                    </td>
                    {!inspectionMode && (
                      <td style={{ textAlign: "right" }}>
                        <Button size="sm" icon="upload" onClick={() => setUploadFor(r.moduleId)}>
                          {r.evidence ? "Re-upload" : "Evidence"}
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "documents" && (
        <div className="grid" style={{ gridTemplateColumns: "repeat(2,1fr)" }}>
          {docs.map((d) => {
            const days = daysToExpiry(d.date);
            const tone = days === null ? "grey" : days < 0 ? "red" : days <= 60 ? "amber" : "green";
            return (
              <Card key={d.label} className="card-pad">
                <div className="row between">
                  <div className="row gap-10">
                    <span className="kpi-icon" style={{ background: "var(--brand-50)", color: "var(--brand-700)" }}>
                      <Icon name={d.icon} size={20} />
                    </span>
                    <div>
                      <b>{d.label}</b>
                      <div className="tiny muted">Expires {fmtDate(d.date)}</div>
                    </div>
                  </div>
                  <Badge tone={tone as "green"} dot>
                    {days !== null && days < 0 ? "Expired" : days !== null && days <= 60 ? `${days}d left` : "In date"}
                  </Badge>
                </div>
              </Card>
            );
          })}
          {person.notes && (
            <Card className="card-pad" style={{ gridColumn: "1 / -1" }}>
              <div className="section-title" style={{ marginBottom: 8 }}>Notes</div>
              <p className="small">{person.notes}</p>
            </Card>
          )}
        </div>
      )}

      {tab === "activity" && (
        <Card className="card-pad">
          <div className="timeline">
            {records
              .filter((r) => r.completionDate || r.evidence)
              .slice(0, 8)
              .map((r) => (
                <div className="tl-item" key={r.id}>
                  <div className="tl-time">{fmtDate(r.completionDate ?? r.evidence?.uploadedAt)}</div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.module.title}</div>
                  <div className="small muted">
                    {r.evidence ? `Evidence "${r.evidence.fileName}" — ${r.evidence.verified ? "verified" : "awaiting verification"}` : "Completed"}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      {uploadFor && (
        <UploadModal
          moduleTitle={computed.find((r) => r.moduleId === uploadFor)?.module.title ?? "training"}
          onClose={() => setUploadFor(null)}
          onUpload={(name) => {
            uploadEvidence(person.id, uploadFor, name);
            setUploadFor(null);
          }}
        />
      )}
    </>
  );
}

export function UploadModal({
  moduleTitle,
  onClose,
  onUpload,
}: {
  moduleTitle: string;
  onClose: () => void;
  onUpload: (fileName: string) => void;
}) {
  const [fileName, setFileName] = useState("");
  return (
    <Modal
      title="Upload evidence"
      icon="upload"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon="send" disabled={!fileName} onClick={() => onUpload(fileName)}>
            Submit for approval
          </Button>
        </>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        Uploading evidence for <b style={{ color: "var(--ink)" }}>{moduleTitle}</b>. Submissions are
        verified by the Operations Manager before training status updates.
      </p>
      <label
        className="col center gap-8"
        style={{
          border: "2px dashed var(--border-strong)",
          borderRadius: 12,
          padding: "32px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: "var(--surface-2)",
        }}
      >
        <Icon name="upload" size={28} style={{ color: "var(--accent)" }} />
        <b style={{ fontSize: 13.5 }}>Click to choose a file</b>
        <span className="tiny muted">PDF, JPG, PNG or DOCX — up to 10 MB</span>
        <input
          type="file"
          style={{ display: "none" }}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "certificate.pdf")}
        />
        {!fileName && (
          <Button size="sm" style={{ marginTop: 6 }} onClick={(e) => { e.preventDefault(); setFileName("certificate.pdf"); }}>
            Simulate selection
          </Button>
        )}
      </label>
      {fileName && (
        <div className="row gap-10" style={{ marginTop: 14, padding: 12, background: "var(--green-bg)", borderRadius: 8 }}>
          <Icon name="file" size={18} style={{ color: "var(--green-ink)" }} />
          <div className="flex-1">
            <b className="small">{fileName}</b>
            <div className="tiny" style={{ color: "var(--green-ink)" }}>Ready to submit</div>
          </div>
          <Icon name="checkCircle" size={18} style={{ color: "var(--green)" }} />
        </div>
      )}
    </Modal>
  );
}
