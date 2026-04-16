import { useEffect, useState, type FormEvent } from "react";
import { Entities, Fees } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import type { FeeRun } from "../api/types";
import { formatCurrency, today, useAsync } from "../hooks/useAsync";

export default function FeesPage() {
  const [entityId, setEntityId] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [latestRun, setLatestRun] = useState<FeeRun | null>(null);

  const entities = useAsync(() => Entities.list(), []);
  const schedules = useAsync(
    () => (entityId ? Fees.schedules(entityId) : Promise.resolve([])),
    [entityId]
  );

  useEffect(() => {
    if (!entityId && entities.data && entities.data.length > 0) {
      setEntityId(entities.data[0].id);
    }
  }, [entities.data, entityId]);

  const [form, setForm] = useState({
    name: "Management Fee 2%",
    basis: "commitment",
    annual_rate_bps: 200,
    periodicity: "quarterly",
    effective_from: today(),
    offsets_enabled: false,
  });

  async function create(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Fees.createSchedule({ entity_id: entityId, ...form });
      setShowCreate(false);
      schedules.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function approve(id: number) {
    setActionError(null);
    try {
      await Fees.approveSchedule(id);
      schedules.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  const [runForm, setRunForm] = useState({
    period_start: `${new Date().getFullYear()}-01-01`,
    period_end: today(),
  });

  async function runFees(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    setLatestRun(null);
    try {
      const run = await Fees.run({ entity_id: entityId, ...runForm });
      setLatestRun(run);
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  return (
    <>
      <h1>Fees</h1>

      <div className="toolbar">
        <label style={{ margin: 0 }}>Fund</label>
        <select value={entityId} onChange={(e) => setEntityId(Number(e.target.value))}>
          <option value={0}>Select…</option>
          {(entities.data ?? []).map((e) => (
            <option key={e.id} value={e.id}>{e.code} — {e.legal_name}</option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowCreate((v) => !v)} disabled={!entityId}>
          {showCreate ? "Cancel" : "+ New schedule"}
        </button>
      </div>

      <ErrorBanner error={schedules.error || actionError} />

      {entityId > 0 && showCreate && (
        <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Basis</label>
              <select value={form.basis} onChange={(e) => setForm({ ...form, basis: e.target.value })}>
                <option value="commitment">Commitment</option>
                <option value="invested_capital">Invested Capital</option>
                <option value="nav">NAV</option>
                <option value="flat">Flat</option>
              </select>
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Annual rate (bps)</label>
              <input type="number" required value={form.annual_rate_bps} onChange={(e) => setForm({ ...form, annual_rate_bps: Number(e.target.value) })} />
            </div>
            <div>
              <label>Periodicity</label>
              <select value={form.periodicity} onChange={(e) => setForm({ ...form, periodicity: e.target.value })}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="annual">Annual</option>
              </select>
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Effective from</label>
              <input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
            </div>
            <div style={{ paddingTop: 28 }}>
              <label style={{ display: "inline" }}>
                <input type="checkbox" checked={form.offsets_enabled} onChange={(e) => setForm({ ...form, offsets_enabled: e.target.checked })} />{" "}
                Offsets enabled
              </label>
            </div>
          </div>
          <button className="btn" type="submit">Create draft</button>
        </form>
      )}

      {entityId > 0 && (
        <>
          <h2>Schedules</h2>
          {schedules.loading ? <div className="loading">Loading…</div> : (
            <div className="card pad-0">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Name</th><th>Basis</th>
                    <th className="num">Rate (bps)</th><th>Effective</th>
                    <th>Version</th><th>State</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(schedules.data ?? []).map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.name}</td>
                      <td>{s.basis}</td>
                      <td className="num">{s.annual_rate_bps}</td>
                      <td>{s.effective_from}{s.effective_to ? ` → ${s.effective_to}` : ""}</td>
                      <td>v{s.version}</td>
                      <td><StateBadge value={s.state} /></td>
                      <td className="row-actions">
                        {s.state === "draft" && (
                          <button className="btn secondary" onClick={() => approve(s.id)}>Approve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {schedules.data && schedules.data.length === 0 && (
                    <tr><td colSpan={8}><div className="empty">No schedules yet for this fund.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <h2>Run accrual</h2>
          <form className="card" onSubmit={runFees} style={{ marginBottom: 16 }}>
            <div className="form-row inline">
              <div>
                <label>Period start</label>
                <input type="date" value={runForm.period_start} onChange={(e) => setRunForm({ ...runForm, period_start: e.target.value })} />
              </div>
              <div>
                <label>Period end</label>
                <input type="date" value={runForm.period_end} onChange={(e) => setRunForm({ ...runForm, period_end: e.target.value })} />
              </div>
            </div>
            <button className="btn" type="submit">Run fees</button>
          </form>

          {latestRun && (
            <>
              <h2>Run #{latestRun.id}</h2>
              <div className="card pad-0">
                <table>
                  <thead>
                    <tr>
                      <th>Schedule</th>
                      <th>Investor</th>
                      <th className="num">Basis</th>
                      <th className="num">Rate (bps)</th>
                      <th className="num">Gross</th>
                      <th className="num">Offset</th>
                      <th className="num">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestRun.accruals.map((a) => (
                      <tr key={a.id}>
                        <td>#{a.schedule_id}</td>
                        <td>{a.investor_id ? `#${a.investor_id}` : "fund-level"}</td>
                        <td className="num">{formatCurrency(a.basis_amount)}</td>
                        <td className="num">{a.applied_rate_bps}</td>
                        <td className="num">{formatCurrency(a.gross_fee)}</td>
                        <td className="num">{formatCurrency(a.offset_amount)}</td>
                        <td className="num">{formatCurrency(a.net_fee)}</td>
                      </tr>
                    ))}
                    {latestRun.accruals.length === 0 && (
                      <tr><td colSpan={7}><div className="empty">No accruals produced for this period.</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="muted mono" style={{ marginTop: 8, fontSize: 11 }}>
                snapshot: {latestRun.input_snapshot_hash}
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
