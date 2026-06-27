import { useState } from "react";
import { useStore } from "../store/store";
import { Badge, Button, Card, CardHead, CqcChip, Field, Kpi, Modal } from "../components/ui";
import { Icon } from "../components/Icon";
import { cqcColor, fmtDate, fmtDateLong } from "../lib/domain";
import type { CqcDomain } from "../data/types";
import { CQC_DOMAINS } from "../lib/domain";

export function AnnualReviews() {
  const { reviews, signOffReview, inspectionMode } = useStore();
  const [adding, setAdding] = useState(false);

  const approved = reviews.filter((r) => r.status === "Approved").length;
  const pending = reviews.filter((r) => r.status !== "Approved").length;

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Annual Review Log</h1>
          <p>Recorded reviews and sign-off of the training matrix — demonstrating ongoing governance and continuous improvement.</p>
        </div>
        {!inspectionMode && (
          <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>Log a review</Button>
        )}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: 18 }}>
        <Kpi label="Reviews logged" value={reviews.length} icon="clipboard" tone="brand" />
        <Kpi label="Signed off" value={approved} icon="checkCircle" tone="green" />
        <Kpi label="Awaiting sign-off" value={pending} icon="clock" tone="amber" />
      </div>

      <Card>
        <CardHead title="Review history" icon="history" />
        <div className="card-body">
          <div className="timeline">
            {reviews
              .slice()
              .sort((a, b) => (a.reviewDate < b.reviewDate ? 1 : -1))
              .map((r) => (
                <div className={`tl-item ${r.status === "Approved" ? "" : "muted"}`} key={r.id}>
                  <div className="row between wrap" style={{ gap: 8 }}>
                    <div>
                      <div className="tl-time">{fmtDateLong(r.reviewDate)}</div>
                      <div style={{ fontWeight: 650, fontSize: 14, marginTop: 2 }}>{r.scope}</div>
                    </div>
                    <Badge tone={r.status === "Approved" ? "green" : r.status === "Draft" ? "grey" : "amber"} dot>
                      {r.status}
                    </Badge>
                  </div>
                  <p className="small" style={{ margin: "6px 0 8px", color: "var(--ink-2)" }}>{r.changes}</p>
                  <div className="row gap-12 wrap small muted" style={{ alignItems: "center" }}>
                    <span className="row gap-6"><Icon name="user" size={13} /> {r.reviewedBy}</span>
                    <span className="row gap-6"><Icon name="calendar" size={13} /> Next review {fmtDate(r.nextReviewDue)}</span>
                    <span className="row gap-6">
                      {r.domains.map((d) => <CqcChip key={d} domain={d} color={cqcColor(d)} />)}
                    </span>
                    {!inspectionMode && r.status !== "Approved" && (
                      <Button size="sm" variant="primary" icon="check" style={{ marginLeft: "auto" }} onClick={() => signOffReview(r.id)}>
                        Sign off
                      </Button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </Card>

      {adding && <AddReviewModal onClose={() => setAdding(false)} />}
    </>
  );
}

function AddReviewModal({ onClose }: { onClose: () => void }) {
  const { pushToast } = useStore();
  const [scope, setScope] = useState("");
  const [changes, setChanges] = useState("");
  const [domains, setDomains] = useState<CqcDomain[]>([]);

  return (
    <Modal
      title="Log annual review"
      icon="clipboard"
      drawer
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            icon="check"
            disabled={!scope}
            onClick={() => {
              pushToast({ kind: "success", title: "Review logged", body: "Submitted for Registered Manager sign-off." });
              onClose();
            }}
          >
            Submit review
          </Button>
        </>
      }
    >
      <div className="col gap-16">
        <Field label="Review scope"><input className="input" value={scope} onChange={(e) => setScope(e.target.value)} placeholder="e.g. Full training matrix — all roles" /></Field>
        <Field label="Changes made"><textarea className="textarea" value={changes} onChange={(e) => setChanges(e.target.value)} placeholder="Describe modules added, retired or re-mapped…" /></Field>
        <Field label="CQC domains affected">
          <div className="row gap-6 wrap">
            {CQC_DOMAINS.map((d) => {
              const on = domains.includes(d.key);
              return (
                <button
                  key={d.key}
                  className="cqc-chip"
                  style={{ cursor: "pointer", background: on ? d.color : "var(--surface-3)", color: on ? "#fff" : "var(--ink-2)", height: 28, padding: "0 10px" }}
                  onClick={() => setDomains((p) => (on ? p.filter((x) => x !== d.key) : [...p, d.key]))}
                >
                  {d.key}
                </button>
              );
            })}
          </div>
        </Field>
        <div className="row gap-12">
          <Field label="Review date"><input className="input" type="date" defaultValue="2026-06-27" /></Field>
          <Field label="Next review due"><input className="input" type="date" defaultValue="2027-06-27" /></Field>
        </div>
      </div>
    </Modal>
  );
}
