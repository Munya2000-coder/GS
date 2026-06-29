import { useState } from "react";
import type { OperatingPack } from "../types";
import { fmt, lightClass } from "../lib";

type Tab = "Fund Terms" | "Operating Rules" | "Reporting Matrix" | "Investor Matrix" | "Calendar" | "Exceptions";
const TABS: Tab[] = ["Fund Terms", "Operating Rules", "Reporting Matrix", "Investor Matrix", "Calendar", "Exceptions"];

function Matrix({ rows, cols }: { rows: Record<string, unknown>[]; cols: [string, string][] }) {
  if (!rows.length) return <div className="card muted">No rows.</div>;
  return (
    <div className="card">
      <table>
        <thead>
          <tr>{cols.map(([, h]) => <th key={h}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={r.investor_specific ? "hi" : ""}>
              {cols.map(([k]) => <td key={k}>{fmt(r[k])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PackView({ pack }: { pack: OperatingPack }) {
  const [tab, setTab] = useState<Tab>("Fund Terms");
  return (
    <>
      <div className="kpis">
        <div className="kpi"><b>{pack.summary.documents}</b><span>documents</span></div>
        <div className="kpi"><b>{pack.summary.rules}</b><span>rules</span></div>
        <div className="kpi"><b>{pack.summary.open_exceptions}</b><span>open exceptions</span></div>
        <div className="kpi"><b>{pack.summary.high_severity_exceptions}</b><span>high severity</span></div>
      </div>
      <nav>
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>{t}</button>
        ))}
      </nav>
      <div style={{ marginTop: 14 }}>
        {tab === "Fund Terms" && (
          <div className="card">
            <h3>Fund Terms Summary</h3>
            <table>
              <thead><tr><th>Field</th><th>Value</th><th>Source</th><th>Conf</th><th>Status</th></tr></thead>
              <tbody>
                {pack.fund_terms_summary.map((t, i) => (
                  <tr key={i}>
                    <td>{t.field}</td><td><b>{fmt(t.value)}</b></td>
                    <td className="muted">{t.source_reference || ""}</td>
                    <td>{t.confidence ? Math.round(t.confidence * 100) + "%" : ""}</td>
                    <td><span className={"dot " + lightClass(t.status)} />{(t.status || "").replace("_", " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "Operating Rules" && (
          <>
            <p className="hint">Portable Fund Operating Rules — plain-English summary, evidence, and citation each.</p>
            {pack.operating_rules.map((r) => (
              <div className="card" key={r.rule_id}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{r.rule_type}</b>
                  <span className="tag">{r.rule_id} · {r.rule_status}</span>
                </div>
                <div className="muted" style={{ margin: "6px 0" }}>{r.plain_english_summary}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  Source: {r.source_reference || "?"} · confidence {Math.round(r.confidence_score * 100)}%
                  {r.requires_human_review && <span className="sev-medium"> · review</span>}
                </div>
                {r.evidence_required.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    {r.evidence_required.map((e) => <span className="tag" key={e} style={{ marginRight: 4 }}>{e}</span>)}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
        {tab === "Reporting Matrix" && (
          <Matrix rows={pack.reporting_obligation_matrix} cols={[
            ["report", "Report"], ["frequency", "Frequency"], ["due_date", "Due Date"],
            ["recipient", "Recipient"], ["source", "Source"], ["owner", "Owner"], ["investor_specific", "Investor-specific"],
          ]} />
        )}
        {tab === "Investor Matrix" && (
          <Matrix rows={pack.investor_obligation_matrix} cols={[
            ["investor", "Investor"], ["commitment", "Commitment"], ["side_letter", "Side Letter"],
            ["custom_reporting", "Custom Reporting"], ["restriction", "Restriction"], ["tax_requirement", "Tax"],
            ["mfn", "MFN"], ["review_needed", "Review"],
          ]} />
        )}
        {tab === "Calendar" && (
          <Matrix rows={pack.obligation_calendar} cols={[
            ["timing", "Timing"], ["obligation", "Obligation"], ["source", "Source"], ["required_action", "Required Action"],
          ]} />
        )}
        {tab === "Exceptions" && (
          <>
            <p className="hint">Missing rules, side-letter conflicts, and PPM↔LPA consistency mismatches — flagged for human review.</p>
            <div className="card">
              <table>
                <thead><tr><th>Severity</th><th>Kind</th><th>Subject</th><th>Explanation</th><th>Action</th></tr></thead>
                <tbody>
                  {pack.exception_report.map((x, i) => (
                    <tr key={i}>
                      <td className={"sev-" + x.severity}>{x.severity.toUpperCase()}</td>
                      <td><span className="tag">{x.kind}</span></td>
                      <td>{x.subject || ""}</td>
                      <td>{x.explanation}</td>
                      <td className="muted">{x.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
