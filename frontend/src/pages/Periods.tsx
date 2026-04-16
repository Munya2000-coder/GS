import { useEffect, useState, type FormEvent } from "react";
import { Entities, Periods } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import { today, useAsync } from "../hooks/useAsync";

export default function PeriodsPage() {
  const [entityId, setEntityId] = useState<number>(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState({ period_type: "monthly", any_date: today() });

  const entities = useAsync(() => Entities.list(), []);
  const periods = useAsync(() => (entityId ? Periods.list(entityId) : Promise.resolve([])), [entityId]);

  useEffect(() => {
    if (!entityId && entities.data && entities.data.length > 0) {
      setEntityId(entities.data[0].id);
    }
  }, [entities.data, entityId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Periods.ensure({ entity_id: entityId, ...form });
      periods.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function softClose(id: number) {
    setActionError(null);
    try { await Periods.softClose(id); periods.reload(); } catch (ex) { setActionError(extractError(ex)); }
  }
  async function close(id: number) {
    setActionError(null);
    try { await Periods.close(id); periods.reload(); } catch (ex) { setActionError(extractError(ex)); }
  }
  async function reopen(id: number) {
    const reason = prompt("Reopen reason:");
    if (!reason) return;
    setActionError(null);
    try { await Periods.reopen(id, reason); periods.reload(); } catch (ex) { setActionError(extractError(ex)); }
  }

  return (
    <>
      <h1>Accounting Periods</h1>

      <div className="toolbar">
        <label style={{ margin: 0 }}>Fund</label>
        <select value={entityId} onChange={(e) => setEntityId(Number(e.target.value))}>
          <option value={0}>Select…</option>
          {(entities.data ?? []).map((e) => <option key={e.id} value={e.id}>{e.code}</option>)}
        </select>
        <div className="spacer" />
      </div>

      <ErrorBanner error={periods.error || actionError} />

      {entityId > 0 && (
        <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>Period Type</label>
              <select value={form.period_type} onChange={(e) => setForm({ ...form, period_type: e.target.value })}>
                <option value="daily">Daily</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label>Any Date in Period</label>
              <input type="date" value={form.any_date} onChange={(e) => setForm({ ...form, any_date: e.target.value })} />
            </div>
          </div>
          <button className="btn" type="submit">Ensure Period</button>
        </form>
      )}

      {entityId > 0 && (
        periods.loading ? (
          <div className="loading">Loading…</div>
        ) : (
          <div className="card pad-0">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Type</th><th>Start</th><th>End</th>
                  <th>Status</th><th>Reopen Reason</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(periods.data ?? []).map((p) => (
                  <tr key={p.id}>
                    <td>{p.id}</td>
                    <td>{p.period_type}</td>
                    <td>{p.period_start}</td>
                    <td>{p.period_end}</td>
                    <td><StateBadge value={p.status} /></td>
                    <td>{p.reopen_reason ?? "—"}</td>
                    <td className="row-actions">
                      {p.status === "open" && <button className="btn secondary" onClick={() => softClose(p.id)}>Soft close</button>}
                      {(p.status === "open" || p.status === "soft_close" || p.status === "reopened") &&
                        <button className="btn" onClick={() => close(p.id)}>Close</button>}
                      {(p.status === "closed" || p.status === "soft_close") &&
                        <button className="btn danger" onClick={() => reopen(p.id)}>Reopen</button>}
                    </td>
                  </tr>
                ))}
                {periods.data && periods.data.length === 0 && (
                  <tr><td colSpan={7}><div className="empty">No periods for this fund yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}
