import { useEffect, useState, type FormEvent } from "react";
import { Entities, Nav } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import { formatCurrency, today, useAsync } from "../hooks/useAsync";

export default function NavPage() {
  const [entityId, setEntityId] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const entities = useAsync(() => Entities.list(), []);
  const snapshots = useAsync(
    () => (entityId ? Nav.list(entityId) : Promise.resolve([])),
    [entityId]
  );

  useEffect(() => {
    if (!entityId && entities.data && entities.data.length > 0) {
      setEntityId(entities.data[0].id);
    }
  }, [entities.data, entityId]);

  const [form, setForm] = useState({
    as_of: today(),
    gross_asset_value: "",
    liabilities: "0",
    currency: "USD",
    source_reference: "",
  });

  async function publish(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Nav.publish({
        entity_id: entityId,
        ...form,
        source_reference: form.source_reference || null,
      });
      setShowForm(false);
      snapshots.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  return (
    <>
      <h1>NAV</h1>

      <div className="toolbar">
        <label style={{ margin: 0 }}>Fund</label>
        <select value={entityId} onChange={(e) => setEntityId(Number(e.target.value))}>
          <option value={0}>Select…</option>
          {(entities.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.code} — {e.legal_name}</option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowForm((v) => !v)} disabled={!entityId}>
          {showForm ? "Cancel" : "+ Publish NAV"}
        </button>
      </div>

      <ErrorBanner error={snapshots.error || actionError} />

      {entityId > 0 && showForm && (
        <form className="card" onSubmit={publish} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>As of</label>
              <input type="date" required value={form.as_of} onChange={(e) => setForm({ ...form, as_of: e.target.value })} />
            </div>
            <div>
              <label>Currency</label>
              <input required value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Gross asset value</label>
              <input type="number" step="0.01" required value={form.gross_asset_value} onChange={(e) => setForm({ ...form, gross_asset_value: e.target.value })} />
            </div>
            <div>
              <label>Liabilities</label>
              <input type="number" step="0.01" value={form.liabilities} onChange={(e) => setForm({ ...form, liabilities: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label>Source reference</label>
            <input placeholder="Q4-2025 valuation" value={form.source_reference} onChange={(e) => setForm({ ...form, source_reference: e.target.value })} />
          </div>
          <button className="btn" type="submit">Publish</button>
        </form>
      )}

      {entityId > 0 && (
        snapshots.loading ? <div className="loading">Loading…</div> : (
          <div className="card pad-0">
            <table>
              <thead>
                <tr>
                  <th>As of</th>
                  <th className="num">Gross AV</th>
                  <th className="num">Liabilities</th>
                  <th className="num">Ending NAV</th>
                  <th>Currency</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {(snapshots.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.as_of}</td>
                    <td className="num">{formatCurrency(s.gross_asset_value, s.currency)}</td>
                    <td className="num">{formatCurrency(s.liabilities, s.currency)}</td>
                    <td className="num">{formatCurrency(s.ending_nav, s.currency)}</td>
                    <td>{s.currency}</td>
                    <td className="muted">{s.source_reference ?? "—"}</td>
                  </tr>
                ))}
                {snapshots.data && snapshots.data.length === 0 && (
                  <tr><td colSpan={6}><div className="empty">No NAV snapshots for this fund yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}
