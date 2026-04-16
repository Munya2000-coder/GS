import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Entities } from "../api/endpoints";
import { extractError } from "../api/client";
import StateBadge from "../components/StateBadge";
import ErrorBanner from "../components/ErrorBanner";
import { useAsync } from "../hooks/useAsync";

export default function FundsPage() {
  const { data, loading, error, reload } = useAsync(() => Entities.list(), []);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    legal_name: "",
    short_name: "",
    entity_type: "fund",
    jurisdiction: "DE",
    vintage_year: new Date().getFullYear(),
    strategy: "",
    base_currency: "USD",
    reporting_currency: "USD",
    parent_id: null as number | null,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Entities.create({
        ...form,
        strategy: form.strategy || null,
      });
      setShowForm(false);
      setForm({ ...form, code: "", legal_name: "", short_name: "" });
      reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  return (
    <>
      <h1>Funds</h1>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New fund"}
        </button>
      </div>

      <ErrorBanner error={error || actionError} />

      {showForm && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>Code</label>
              <input required minLength={2} maxLength={32} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label>Type</label>
              <select value={form.entity_type} onChange={(e) => setForm({ ...form, entity_type: e.target.value })}>
                <option value="fund">Fund</option>
                <option value="sub_fund">Sub-fund</option>
                <option value="spv">SPV</option>
                <option value="blocker">Blocker</option>
                <option value="feeder">Feeder</option>
                <option value="co_invest">Co-invest</option>
                <option value="master">Master</option>
                <option value="aiv">AIV</option>
              </select>
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Legal name</label>
              <input required value={form.legal_name} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} />
            </div>
            <div>
              <label>Short name</label>
              <input required value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Jurisdiction</label>
              <input required value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} />
            </div>
            <div>
              <label>Vintage year</label>
              <input type="number" value={form.vintage_year} onChange={(e) => setForm({ ...form, vintage_year: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Base currency</label>
              <input required maxLength={3} value={form.base_currency} onChange={(e) => setForm({ ...form, base_currency: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <label>Reporting currency</label>
              <input required maxLength={3} value={form.reporting_currency} onChange={(e) => setForm({ ...form, reporting_currency: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <div className="form-row">
            <label>Strategy</label>
            <input value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} placeholder="e.g. Mid-market buyout" />
          </div>
          <button className="btn" type="submit">Create</button>
        </form>
      )}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="card pad-0">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Legal Name</th><th>Type</th><th>Vintage</th>
                <th>Strategy</th><th>Jurisdiction</th><th>Currency</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((e) => (
                <tr key={e.id}>
                  <td><Link to={`/funds/${e.id}`}>{e.code}</Link></td>
                  <td>{e.legal_name}</td>
                  <td>{e.entity_type}</td>
                  <td>{e.vintage_year ?? "—"}</td>
                  <td>{e.strategy ?? "—"}</td>
                  <td>{e.jurisdiction}</td>
                  <td>{e.base_currency}</td>
                  <td><StateBadge value={e.status} /></td>
                </tr>
              ))}
              {data && data.length === 0 && (
                <tr><td colSpan={8}><div className="empty">No funds yet. Create one above or run <span className="mono">gsctl seed</span>.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
