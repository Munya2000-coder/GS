import { useEffect, useState, type FormEvent } from "react";
import { Entities, Waterfall } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import type { WaterfallRun } from "../api/types";
import { formatCurrency, today, useAsync } from "../hooks/useAsync";

export default function WaterfallPage() {
  const [entityId, setEntityId] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [latestRun, setLatestRun] = useState<WaterfallRun | null>(null);

  const entities = useAsync(() => Entities.list(), []);
  const models = useAsync(
    () => (entityId ? Waterfall.listModels(entityId) : Promise.resolve([])),
    [entityId]
  );

  useEffect(() => {
    if (!entityId && entities.data && entities.data.length > 0) {
      setEntityId(entities.data[0].id);
    }
  }, [entities.data, entityId]);

  const [form, setForm] = useState({
    name: "8/20 European",
    method: "european",
    preferred_return_bps: 800,
    catchup_percentage_bps: 10000,
    carried_interest_bps: 2000,
    gp_catchup_share_bps: 10000,
    hurdle_compounding: "annual",
    effective_from: today(),
  });

  async function create(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Waterfall.createModel({ entity_id: entityId, ...form });
      setShowCreate(false);
      models.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function approveModel(id: number) {
    setActionError(null);
    try {
      await Waterfall.approveModel(id);
      models.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  const [runForm, setRunForm] = useState({
    model_id: 0,
    as_of: today(),
    scenario_label: "",
    is_scenario: false,
  });

  async function runWaterfall(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    setLatestRun(null);
    try {
      const run = await Waterfall.run({
        model_id: Number(runForm.model_id),
        as_of: runForm.as_of,
        scenario_label: runForm.scenario_label || null,
        is_scenario: runForm.is_scenario,
      });
      setLatestRun(run);
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function approveRun() {
    if (!latestRun) return;
    setActionError(null);
    try {
      const r = await Waterfall.approveRun(latestRun.id);
      setLatestRun(r);
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  const lpTotal = latestRun?.tiers.reduce((s, t) => s + Number(t.lp_amount), 0) ?? 0;
  const gpTotal = latestRun?.tiers.reduce((s, t) => s + Number(t.gp_amount), 0) ?? 0;

  return (
    <>
      <h1>Waterfall & Carry</h1>

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
          {showCreate ? "Cancel" : "+ New model"}
        </button>
      </div>

      <ErrorBanner error={models.error || actionError} />

      {entityId > 0 && showCreate && (
        <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>Method</label>
              <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                <option value="european">European (whole-fund)</option>
                <option value="american">American (deal-by-deal)</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Preferred return (bps)</label>
              <input type="number" value={form.preferred_return_bps} onChange={(e) => setForm({ ...form, preferred_return_bps: Number(e.target.value) })} />
            </div>
            <div>
              <label>Carry (bps)</label>
              <input type="number" value={form.carried_interest_bps} onChange={(e) => setForm({ ...form, carried_interest_bps: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Catch-up (bps)</label>
              <input type="number" value={form.catchup_percentage_bps} onChange={(e) => setForm({ ...form, catchup_percentage_bps: Number(e.target.value) })} />
            </div>
            <div>
              <label>Hurdle compounding</label>
              <select value={form.hurdle_compounding} onChange={(e) => setForm({ ...form, hurdle_compounding: e.target.value })}>
                <option value="annual">Annual</option>
                <option value="simple">Simple</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <label>Effective from</label>
            <input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
          </div>
          <button className="btn" type="submit">Create draft</button>
        </form>
      )}

      {entityId > 0 && (
        <>
          <h2>Models</h2>
          {models.loading ? <div className="loading">Loading…</div> : (
            <div className="card pad-0">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Name</th><th>Method</th>
                    <th>Pref / Catchup / Carry</th><th>Version</th>
                    <th>State</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(models.data ?? []).map((m) => (
                    <tr key={m.id}>
                      <td>{m.id}</td>
                      <td>{m.name}</td>
                      <td>{m.method}</td>
                      <td className="mono">
                        {m.preferred_return_bps}/{m.catchup_percentage_bps}/{m.carried_interest_bps}
                      </td>
                      <td>v{m.version}</td>
                      <td><StateBadge value={m.state} /></td>
                      <td className="row-actions">
                        {m.state === "draft" && (
                          <button className="btn secondary" onClick={() => approveModel(m.id)}>Approve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {models.data && models.data.length === 0 && (
                    <tr><td colSpan={7}><div className="empty">No waterfall models yet.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <h2>Run calculation</h2>
          <form className="card" onSubmit={runWaterfall} style={{ marginBottom: 16 }}>
            <div className="form-row inline">
              <div>
                <label>Model</label>
                <select required value={runForm.model_id} onChange={(e) => setRunForm({ ...runForm, model_id: Number(e.target.value) })}>
                  <option value={0}>Select…</option>
                  {(models.data ?? []).map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.id} — {m.name} ({m.state})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>As of</label>
                <input type="date" value={runForm.as_of} onChange={(e) => setRunForm({ ...runForm, as_of: e.target.value })} />
              </div>
            </div>
            <div className="form-row inline">
              <div>
                <label>Scenario label (optional)</label>
                <input value={runForm.scenario_label} onChange={(e) => setRunForm({ ...runForm, scenario_label: e.target.value })} />
              </div>
              <div style={{ paddingTop: 28 }}>
                <label style={{ display: "inline" }}>
                  <input type="checkbox" checked={runForm.is_scenario} onChange={(e) => setRunForm({ ...runForm, is_scenario: e.target.checked })} />{" "}
                  Scenario (allows draft models)
                </label>
              </div>
            </div>
            <button className="btn" type="submit" disabled={!runForm.model_id}>Run</button>
          </form>

          {latestRun && (
            <>
              <div className="toolbar">
                <h2 style={{ margin: 0 }}>Run #{latestRun.id} · <StateBadge value={latestRun.state} /></h2>
                <div className="spacer" />
                {latestRun.state === "draft" && !latestRun.is_scenario && (
                  <button className="btn" onClick={approveRun}>Approve run</button>
                )}
              </div>
              <div className="card pad-0">
                <table>
                  <thead>
                    <tr>
                      <th>#</th><th>Tier</th>
                      <th className="num">LP</th><th className="num">GP</th>
                      <th>Formula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestRun.tiers.map((t) => (
                      <tr key={t.tier_order}>
                        <td>{t.tier_order}</td>
                        <td>{t.tier_name}</td>
                        <td className="num">{formatCurrency(t.lp_amount)}</td>
                        <td className="num">{formatCurrency(t.gp_amount)}</td>
                        <td className="mono muted" style={{ fontSize: 11 }}>{t.formula_text}</td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: 600 }}>
                      <td colSpan={2}>Total</td>
                      <td className="num">{formatCurrency(String(lpTotal))}</td>
                      <td className="num">{formatCurrency(String(gpTotal))}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="muted mono" style={{ marginTop: 8, fontSize: 11 }}>
                snapshot: {latestRun.input_snapshot_hash}{latestRun.scenario_label ? ` · scenario: ${latestRun.scenario_label}` : ""}
              </p>
            </>
          )}
        </>
      )}
    </>
  );
}
