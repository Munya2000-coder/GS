import { useState, type FormEvent } from "react";
import { Distributions, Entities } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import { formatCurrency, today, useAsync } from "../hooks/useAsync";

export default function DistributionsPage() {
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const entities = useAsync(() => Entities.list(), []);
  const distributions = useAsync(() => Distributions.list(), []);

  const [form, setForm] = useState({
    entity_id: 0,
    distribution_number: "",
    notice_date: today(),
    payment_date: today(),
    total_amount: "",
    currency: "USD",
    purpose: "profit",
    recallable: false,
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Distributions.create({ ...form, entity_id: Number(form.entity_id) });
      setShowForm(false);
      setForm({ ...form, distribution_number: "", total_amount: "" });
      distributions.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function approve(id: number) {
    setActionError(null);
    try {
      await Distributions.approve(id);
      distributions.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function pay(id: number) {
    setActionError(null);
    try {
      await Distributions.pay(id);
      distributions.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  return (
    <>
      <h1>Distributions</h1>

      <div className="toolbar">
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New distribution"}
        </button>
        <div className="spacer" />
      </div>

      <ErrorBanner error={distributions.error || actionError} />

      {showForm && (
        <form className="card" onSubmit={submit} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>Fund</label>
              <select required value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: Number(e.target.value) })}>
                <option value={0}>Select…</option>
                {(entities.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.code} — {e.legal_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Distribution Number</label>
              <input required value={form.distribution_number} onChange={(e) => setForm({ ...form, distribution_number: e.target.value })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Notice Date</label>
              <input type="date" required value={form.notice_date} onChange={(e) => setForm({ ...form, notice_date: e.target.value })} />
            </div>
            <div>
              <label>Payment Date</label>
              <input type="date" required value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Total Amount</label>
              <input type="number" required value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
            </div>
            <div>
              <label>Currency</label>
              <input required value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Purpose</label>
              <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
                <option value="profit">Profit</option>
                <option value="return_of_capital">Return of Capital</option>
                <option value="recallable_return">Recallable Return</option>
              </select>
            </div>
            <div style={{ paddingTop: 28 }}>
              <label style={{ display: "inline" }}>
                <input type="checkbox" checked={form.recallable} onChange={(e) => setForm({ ...form, recallable: e.target.checked })} />{" "}
                Recallable
              </label>
            </div>
          </div>
          <button className="btn" type="submit">Create draft</button>
        </form>
      )}

      {distributions.loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="card pad-0">
          <table>
            <thead>
              <tr>
                <th>Number</th><th>Fund</th><th>Notice</th><th>Payment</th>
                <th className="num">Total</th><th>Purpose</th><th>Recallable</th>
                <th>State</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(distributions.data ?? []).map((d) => (
                <tr key={d.id}>
                  <td>{d.distribution_number}</td>
                  <td>#{d.entity_id}</td>
                  <td>{d.notice_date}</td>
                  <td>{d.payment_date}</td>
                  <td className="num">{formatCurrency(d.total_amount, d.currency)}</td>
                  <td>{d.purpose}</td>
                  <td>{d.recallable ? <span className="badge warn">yes</span> : <span className="badge muted">no</span>}</td>
                  <td><StateBadge value={d.state} /></td>
                  <td className="row-actions">
                    {d.state === "draft" && <button className="btn secondary" onClick={() => approve(d.id)}>Approve</button>}
                    {d.state === "approved" && <button className="btn" onClick={() => pay(d.id)}>Pay</button>}
                  </td>
                </tr>
              ))}
              {distributions.data && distributions.data.length === 0 && (
                <tr><td colSpan={9}><div className="empty">No distributions yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
