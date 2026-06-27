import { useMemo, useState } from "react";
import { useStore } from "../store/store";
import { Badge, Card, Empty } from "../components/ui";
import { Icon, type IconName } from "../components/Icon";

const CAT_META: Record<string, { label: string; icon: IconName; tone: "green" | "blue" | "amber" | "violet" | "grey" | "red" }> = {
  training: { label: "Training", icon: "matrix", tone: "green" },
  evidence: { label: "Evidence", icon: "upload", tone: "blue" },
  staff: { label: "Staff", icon: "staff", tone: "amber" },
  matrix: { label: "Matrix", icon: "book", tone: "violet" },
  review: { label: "Review", icon: "clipboard", tone: "grey" },
  report: { label: "Report", icon: "report", tone: "grey" },
  access: { label: "Access", icon: "shield", tone: "red" },
};

function fmtTs(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function AuditLog() {
  const { audit } = useStore();
  const [cat, setCat] = useState<string>("all");

  const cats = Array.from(new Set(audit.map((a) => a.category)));
  const rows = useMemo(() => audit.filter((a) => cat === "all" || a.category === cat), [audit, cat]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Audit Trail</h1>
          <p>A complete, tamper-evident record of every change — training updates, certificate decisions, profile edits, matrix changes and report exports.</p>
        </div>
      </div>

      <div className="row gap-8 wrap" style={{ marginBottom: 16 }}>
        <button className="tab" style={{ background: cat === "all" ? "#fff" : "var(--surface-3)", border: "1px solid var(--border)" }} onClick={() => setCat("all")}>
          All activity
        </button>
        {cats.map((c) => (
          <button key={c} className="tab" style={{ background: cat === c ? "#fff" : "var(--surface-3)", border: "1px solid var(--border)" }} onClick={() => setCat(c)}>
            {CAT_META[c]?.label ?? c}
          </button>
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <Empty title="No audit entries" />
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Change</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const m = CAT_META[a.category] ?? CAT_META.report;
                  return (
                    <tr key={a.id}>
                      <td className="td-muted small nowrap mono">{fmtTs(a.timestamp)}</td>
                      <td className="td-strong nowrap">{a.user}</td>
                      <td>{a.action}</td>
                      <td className="td-muted">{a.entity}</td>
                      <td>
                        {a.previous !== undefined && a.next !== undefined ? (
                          <span className="row gap-6 small nowrap">
                            <span className="muted" style={{ textDecoration: "line-through" }}>{a.previous}</span>
                            <Icon name="chevronRight" size={12} />
                            <b>{a.next}</b>
                          </span>
                        ) : (
                          <span className="muted small">—</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={m.tone}>
                          <Icon name={m.icon} size={12} /> {m.label}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
