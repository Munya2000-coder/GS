import { useState } from "react";
import { Transactions as TxApi } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import { formatCurrency, useAsync } from "../hooks/useAsync";

export default function TransactionsPage() {
  const [stateFilter, setStateFilter] = useState<string>("");
  const [busy, setBusy] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync(
    () => TxApi.list(undefined, stateFilter || undefined),
    [stateFilter]
  );

  async function approve(id: number) {
    setBusy(id);
    setActionError(null);
    try {
      await TxApi.approve(id);
      reload();
    } catch (ex) {
      setActionError(extractError(ex));
    } finally {
      setBusy(null);
    }
  }

  async function post(id: number) {
    setBusy(id);
    setActionError(null);
    try {
      await TxApi.post(id);
      reload();
    } catch (ex) {
      setActionError(extractError(ex));
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <h1>Transactions</h1>

      <div className="toolbar">
        <label style={{ margin: 0 }}>State</label>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} style={{ width: 200 }}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="validated">Validated</option>
          <option value="approved">Approved</option>
          <option value="posted">Posted</option>
          <option value="rejected">Rejected</option>
        </select>
        <div className="spacer" />
        <button className="btn secondary" onClick={reload}>Refresh</button>
      </div>

      <ErrorBanner error={error || actionError} />
      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="card pad-0">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Date</th><th>Type</th><th>Reference</th>
                <th className="num">Amount</th><th>Cur</th><th>State</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((t) => (
                <tr key={t.id}>
                  <td>{t.id}</td>
                  <td>{t.transaction_date}</td>
                  <td>{t.transaction_type}</td>
                  <td>{t.source_reference}</td>
                  <td className="num">{formatCurrency(t.amount, t.currency)}</td>
                  <td>{t.currency}</td>
                  <td><StateBadge value={t.state} /></td>
                  <td className="row-actions">
                    {t.state === "validated" && (
                      <button className="btn secondary" disabled={busy === t.id} onClick={() => approve(t.id)}>Approve</button>
                    )}
                    {t.state === "approved" && (
                      <button className="btn" disabled={busy === t.id} onClick={() => post(t.id)}>Post</button>
                    )}
                  </td>
                </tr>
              ))}
              {data && data.length === 0 && (
                <tr><td colSpan={8}><div className="empty">No transactions match the filter.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
