import { useState, type FormEvent } from "react";
import { CapitalCalls, Entities } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import { formatCurrency, today, useAsync } from "../hooks/useAsync";

export default function CapitalCallsPage() {
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const entities = useAsync(() => Entities.list(), []);
  const calls = useAsync(() => CapitalCalls.list(), []);

  const [form, setForm] = useState({
    entity_id: 0,
    call_number: "",
    notice_date: today(),
    due_date: today(),
    total_amount: "",
    currency: "USD",
    purpose: "investment",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await CapitalCalls.create({ ...form, entity_id: Number(form.entity_id) });
      setShowForm(false);
      setForm({ ...form, call_number: "", total_amount: "" });
      calls.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function approve(id: number) {
    setActionError(null);
    try {
      await CapitalCalls.approve(id);
      calls.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function fund(id: number) {
    setActionError(null);
    try {
      await CapitalCalls.fund(id);
      calls.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  return (
    <>
      <h1>Capital Calls</h1>

      <div className="toolbar">
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New call"}
        </button>
        <div className="spacer" />
      </div>

      <ErrorBanner error={calls.error || actionError} />

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
              <label>Call Number</label>
              <input required value={form.call_number} onChange={(e) => setForm({ ...form, call_number: e.target.value })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Notice Date</label>
              <input type="date" required value={form.notice_date} onChange={(e) => setForm({ ...form, notice_date: e.target.value })} />
            </div>
            <div>
              <label>Due Date</label>
              <input type="date" required value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
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
          <div className="form-row">
            <label>Purpose</label>
            <select value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })}>
              <option value="investment">Investment</option>
              <option value="management_fee">Management Fee</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <button className="btn" type="submit">Create draft</button>
        </form>
      )}

      {calls.loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="card pad-0">
          <table>
            <thead>
              <tr>
                <th>Call #</th><th>Fund</th><th>Notice</th><th>Due</th>
                <th className="num">Total</th><th>Purpose</th><th>State</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(calls.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td>{c.call_number}</td>
                  <td>#{c.entity_id}</td>
                  <td>{c.notice_date}</td>
                  <td>{c.due_date}</td>
                  <td className="num">{formatCurrency(c.total_amount, c.currency)}</td>
                  <td>{c.purpose}</td>
                  <td><StateBadge value={c.state} /></td>
                  <td className="row-actions">
                    {c.state === "draft" && <button className="btn secondary" onClick={() => approve(c.id)}>Approve</button>}
                    {c.state === "approved" && <button className="btn" onClick={() => fund(c.id)}>Fund</button>}
                  </td>
                </tr>
              ))}
              {calls.data && calls.data.length === 0 && (
                <tr><td colSpan={8}><div className="empty">No capital calls yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
