import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Entities, Performance, Platform, Transactions } from "../api/endpoints";
import ErrorBanner from "../components/ErrorBanner";
import Kpi from "../components/Kpi";
import StateBadge from "../components/StateBadge";
import { formatCurrency, formatNumber, formatPercent, formatRatio, today, useAsync } from "../hooks/useAsync";

export default function FundDetailPage() {
  const { id } = useParams<{ id: string }>();
  const entityId = Number(id);
  const [asOf, setAsOf] = useState(today());

  const entity = useAsync(() => Entities.get(entityId), [entityId]);
  const metrics = useAsync(() => Performance.get(entityId, asOf), [entityId, asOf]);
  const summary = useAsync(() => Platform.fund(entityId, asOf), [entityId, asOf]);
  const txs = useAsync(() => Transactions.list(entityId), [entityId]);

  if (entity.loading) return <div className="loading">Loading…</div>;
  if (entity.error) return <ErrorBanner error={entity.error} />;
  if (!entity.data) return null;

  const e = entity.data;

  return (
    <>
      <h1>
        {e.legal_name} <span className="muted" style={{ fontSize: 14, fontWeight: "normal" }}>· {e.code}</span>
      </h1>
      <div className="pill-row" style={{ marginBottom: 16 }}>
        <span className="chip">{e.entity_type}</span>
        <span className="chip">{e.jurisdiction}</span>
        <span className="chip">vintage {e.vintage_year ?? "—"}</span>
        <span className="chip">{e.strategy ?? "—"}</span>
        <span className="chip">base {e.base_currency}</span>
        <span className="chip"><StateBadge value={e.status} /></span>
      </div>

      <div className="toolbar">
        <label style={{ margin: 0 }}>As of</label>
        <input type="date" value={asOf} onChange={(x) => setAsOf(x.target.value)} style={{ width: 160 }} />
        <div className="spacer" />
        <span className="muted">Cashflows: {metrics.data?.cashflow_count ?? 0}</span>
      </div>

      <ErrorBanner error={metrics.error} />
      <h2>Performance</h2>
      {metrics.loading || !metrics.data ? (
        <div className="loading">Computing…</div>
      ) : (
        <div className="grid">
          <Kpi label="Paid-in" value={formatCurrency(metrics.data.paid_in)} />
          <Kpi label="Distributions" value={formatCurrency(metrics.data.distributions)} />
          <Kpi label="NAV" value={formatCurrency(metrics.data.nav)} />
          <Kpi
            label="TVPI"
            value={formatRatio(metrics.data.tvpi)}
            sub={`DPI ${formatRatio(metrics.data.dpi)} · RVPI ${formatRatio(metrics.data.rvpi)}`}
          />
          <Kpi label="PIC" value={formatPercent(metrics.data.pic_ratio)} />
          <Kpi label="IRR" value={formatPercent(metrics.data.irr)} />
        </div>
      )}

      {summary.data && (
        <>
          <h2>Operational</h2>
          <div className="grid">
            <Kpi label="Commitments" value={formatNumber(summary.data.commitments.count.toString())}
                 sub={formatCurrency(summary.data.commitments.total_committed)} />
            <Kpi label="Capital Accounts" value={summary.data.capital_accounts} />
            <Kpi label="Open Periods" value={summary.data.operational.open_periods} />
            <Kpi label="Approved Calls" value={summary.data.operational.approved_calls} />
            <Kpi label="Approved Distributions" value={summary.data.operational.approved_distributions} />
          </div>
        </>
      )}

      <h2>Recent Transactions</h2>
      <div className="card pad-0">
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Type</th><th>Reference</th>
              <th className="num">Amount</th><th>Currency</th><th>State</th>
            </tr>
          </thead>
          <tbody>
            {(txs.data ?? []).slice(0, 30).map((t) => (
              <tr key={t.id}>
                <td>{t.transaction_date}</td>
                <td>{t.transaction_type}</td>
                <td><Link to={`/audit?object_type=transaction&object_id=${t.id}`}>{t.source_reference}</Link></td>
                <td className="num">{formatCurrency(t.amount, t.currency)}</td>
                <td>{t.currency}</td>
                <td><StateBadge value={t.state} /></td>
              </tr>
            ))}
            {txs.data && txs.data.length === 0 && (
              <tr><td colSpan={6}><div className="empty">No transactions yet.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
