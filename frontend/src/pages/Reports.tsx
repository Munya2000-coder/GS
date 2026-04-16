import { useEffect, useState } from "react";
import { Entities, Investors, Reports } from "../api/endpoints";
import ErrorBanner from "../components/ErrorBanner";
import { formatCurrency, today, useAsync } from "../hooks/useAsync";

type ReportKind = "trial_balance" | "capital_account" | "contrib_distrib";

export default function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>("trial_balance");
  const [entityId, setEntityId] = useState(0);
  const [investorId, setInvestorId] = useState(0);
  const [asOf, setAsOf] = useState(today());
  const [error, setError] = useState<string | null>(null);

  const entities = useAsync(() => Entities.list(), []);
  const investors = useAsync(() => Investors.list(), []);

  useEffect(() => {
    if (!entityId && entities.data && entities.data.length > 0) {
      setEntityId(entities.data[0].id);
    }
  }, [entities.data, entityId]);

  const trialBalance = useAsync(
    () => (kind === "trial_balance" && entityId ? Reports.trialBalance(entityId, asOf) : Promise.resolve(null)),
    [kind, entityId, asOf]
  );

  const capAccount = useAsync(
    () => (kind === "capital_account" && entityId && investorId ? Reports.capitalAccount(investorId, entityId, asOf) : Promise.resolve(null)),
    [kind, entityId, investorId, asOf]
  );

  const contribDistrib = useAsync(
    () => (kind === "contrib_distrib" && entityId ? Reports.contribDistrib(entityId, asOf, investorId || undefined) : Promise.resolve(null)),
    [kind, entityId, investorId, asOf]
  );

  const errors = [trialBalance.error, capAccount.error, contribDistrib.error, error].filter(Boolean).join("\n");

  async function downloadCsv(path: string, filename: string) {
    setError(null);
    try {
      const base = import.meta.env.DEV ? "/api" : "";
      const user = localStorage.getItem("gs_user") ?? "";
      const res = await fetch(base + path, { headers: { "X-User-Id": user } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (ex) {
      setError(String(ex));
    }
  }

  return (
    <>
      <h1>Reports</h1>

      <div className="toolbar">
        <label style={{ margin: 0 }}>Report</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)}>
          <option value="trial_balance">Trial balance</option>
          <option value="capital_account">Capital account statement</option>
          <option value="contrib_distrib">Contributions & distributions</option>
        </select>
        <label style={{ margin: 0 }}>Fund</label>
        <select value={entityId} onChange={(e) => setEntityId(Number(e.target.value))}>
          <option value={0}>Select…</option>
          {(entities.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.code}</option>)}
        </select>
        {(kind === "capital_account" || kind === "contrib_distrib") && (
          <>
            <label style={{ margin: 0 }}>Investor</label>
            <select value={investorId} onChange={(e) => setInvestorId(Number(e.target.value))}>
              <option value={0}>{kind === "capital_account" ? "Select…" : "All"}</option>
              {(investors.data ?? []).map((i) => <option key={i.id} value={i.id}>{i.code} — {i.short_name}</option>)}
            </select>
          </>
        )}
        <label style={{ margin: 0 }}>As of</label>
        <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ width: 150 }} />
      </div>

      <ErrorBanner error={errors || null} />

      {kind === "trial_balance" && entityId > 0 && (
        <>
          <div className="toolbar">
            <div className="spacer" />
            <button className="btn secondary" onClick={() => downloadCsv(`/exports/trial-balance.csv?entity_id=${entityId}&as_of=${asOf}`, `trial-balance-${entityId}-${asOf}.csv`)}>
              Download CSV
            </button>
          </div>
          {trialBalance.loading ? <div className="loading">Loading…</div> : trialBalance.data && (
            <div className="card pad-0">
              <table>
                <thead>
                  <tr>
                    <th>Account</th><th>Name</th>
                    <th className="num">Debit</th><th className="num">Credit</th><th className="num">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalance.data.rows.map((r) => (
                    <tr key={r.account_code}>
                      <td className="mono">{r.account_code}</td>
                      <td>{r.account_name}</td>
                      <td className="num">{formatCurrency(r.debit)}</td>
                      <td className="num">{formatCurrency(r.credit)}</td>
                      <td className="num">{formatCurrency(r.net)}</td>
                    </tr>
                  ))}
                  {trialBalance.data.rows.length === 0 && (
                    <tr><td colSpan={5}><div className="empty">No activity to report.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {kind === "capital_account" && entityId > 0 && investorId > 0 && capAccount.data && (
        <>
          <div className="grid" style={{ marginBottom: 16 }}>
            <div className="card kpi"><div className="label">Commitment</div><div className="value">{formatCurrency(capAccount.data.commitment)}</div></div>
            <div className="card kpi"><div className="label">Contributed</div><div className="value">{formatCurrency(capAccount.data.contributed)}</div></div>
            <div className="card kpi"><div className="label">Distributed</div><div className="value">{formatCurrency(capAccount.data.distributed)}</div></div>
            <div className="card kpi"><div className="label">NAV</div><div className="value">{formatCurrency(capAccount.data.ending_nav)}</div></div>
            <div className="card kpi"><div className="label">Unfunded</div><div className="value">{formatCurrency(capAccount.data.unfunded)}</div></div>
            <div className="card kpi"><div className="label">Allocated P&amp;L</div><div className="value">{formatCurrency(capAccount.data.allocated_pnl)}</div></div>
          </div>
          <h2>Posted transactions</h2>
          <div className="card pad-0">
            <table>
              <thead>
                <tr>
                  <th>Date</th><th>Type</th><th>Reference</th>
                  <th className="num">Amount</th><th>Currency</th>
                </tr>
              </thead>
              <tbody>
                {capAccount.data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td>{t.date}</td><td>{t.type}</td><td>{t.source_reference}</td>
                    <td className="num">{formatCurrency(t.amount, t.currency)}</td>
                    <td>{t.currency}</td>
                  </tr>
                ))}
                {capAccount.data.transactions.length === 0 && (
                  <tr><td colSpan={5}><div className="empty">No posted transactions yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {kind === "contrib_distrib" && entityId > 0 && contribDistrib.data && (
        <>
          <div className="grid" style={{ marginBottom: 16 }}>
            <div className="card kpi"><div className="label">Total Contributed</div>
              <div className="value">{formatCurrency((contribDistrib.data as { total_contributed: string }).total_contributed)}</div>
            </div>
            <div className="card kpi"><div className="label">Total Distributed</div>
              <div className="value">{formatCurrency((contribDistrib.data as { total_distributed: string }).total_distributed)}</div>
            </div>
          </div>
          <div className="card pad-0">
            <table>
              <thead>
                <tr><th>Date</th><th>Type</th><th>Investor</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {((contribDistrib.data as { items: Array<{ date: string; type: string; investor_id: number | null; amount: string }> }).items).map((it, idx) => (
                  <tr key={idx}>
                    <td>{it.date}</td><td>{it.type}</td>
                    <td>{it.investor_id ?? "—"}</td>
                    <td className="num">{formatCurrency(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>Bulk exports</h2>
      <div className="grid">
        <div className="card">
          <div className="label">Transactions CSV</div>
          <button className="btn secondary" style={{ marginTop: 8 }}
            onClick={() => downloadCsv(entityId ? `/exports/transactions.csv?entity_id=${entityId}` : "/exports/transactions.csv", "transactions.csv")}>
            Download
          </button>
        </div>
        {entityId > 0 && (
          <>
            <div className="card">
              <div className="label">Capital accounts CSV</div>
              <button className="btn secondary" style={{ marginTop: 8 }}
                onClick={() => downloadCsv(`/exports/capital-accounts.csv?entity_id=${entityId}`, `capital-accounts-${entityId}.csv`)}>
                Download
              </button>
            </div>
            <div className="card">
              <div className="label">Journal entries CSV</div>
              <button className="btn secondary" style={{ marginTop: 8 }}
                onClick={() => downloadCsv(`/exports/journal-entries.csv?entity_id=${entityId}`, `journal-${entityId}.csv`)}>
                Download
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
