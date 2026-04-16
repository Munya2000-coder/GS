import { useState, type FormEvent } from "react";
import { Admin, Reconciliation } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import { useAsync } from "../hooks/useAsync";

export default function ReconciliationPage() {
  const [batchId, setBatchId] = useState<number>(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState({ expected_count: 0, expected_total: "" });
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const exceptions = useAsync(
    () => (batchId ? Reconciliation.listExceptions(batchId) : Promise.resolve([])),
    [batchId]
  );

  const users = useAsync(() => Admin.listUsers().catch(() => []), []);

  async function reconcile(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    setResult(null);
    try {
      const r = await Reconciliation.reconcileBatch({
        batch_id: batchId,
        expected_count: Number(form.expected_count),
        expected_total: form.expected_total,
      });
      setResult(r as Record<string, unknown>);
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function assign(excId: number, ownerId: number, note: string) {
    setActionError(null);
    try {
      await Reconciliation.assignException(excId, { owner_user_id: ownerId, note });
      exceptions.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  return (
    <>
      <h1>Reconciliation</h1>

      <ErrorBanner error={exceptions.error || actionError} />

      <form className="card" onSubmit={reconcile} style={{ marginBottom: 16 }}>
        <h2 style={{ marginTop: 0 }}>Reconcile import batch to source totals</h2>
        <div className="form-row inline">
          <div>
            <label>Batch ID</label>
            <input type="number" required value={batchId || ""} onChange={(e) => setBatchId(Number(e.target.value))} />
          </div>
          <div>
            <label>Expected count</label>
            <input type="number" required value={form.expected_count || ""} onChange={(e) => setForm({ ...form, expected_count: Number(e.target.value) })} />
          </div>
        </div>
        <div className="form-row">
          <label>Expected total</label>
          <input type="number" step="0.01" required value={form.expected_total} onChange={(e) => setForm({ ...form, expected_total: e.target.value })} />
        </div>
        <button className="btn" type="submit">Reconcile</button>
      </form>

      {result && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>Result</h2>
          <div className="grid">
            {Object.entries(result).map(([k, v]) => (
              <div key={k} className="card kpi">
                <div className="label">{k}</div>
                <div className="value mono" style={{ fontSize: 14 }}>{String(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {batchId > 0 && (
        <>
          <h2>Exception queue for batch #{batchId}</h2>
          {exceptions.loading ? <div className="loading">Loading…</div> : (
            <div className="card pad-0">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Row</th><th>Code</th><th>Message</th>
                    <th>Owner</th><th>Status</th><th>Note</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(exceptions.data ?? []).map((e) => (
                    <tr key={e.id}>
                      <td>{e.id}</td>
                      <td>{e.row_number}</td>
                      <td className="mono">{e.code}</td>
                      <td>{e.message}</td>
                      <td>{e.owner_user_id ?? "—"}</td>
                      <td>{e.status}</td>
                      <td className="muted">{e.remediation_note ?? "—"}</td>
                      <td>
                        <AssignForm users={users.data ?? []} onAssign={(ownerId, note) => assign(e.id, ownerId, note)} />
                      </td>
                    </tr>
                  ))}
                  {exceptions.data && exceptions.data.length === 0 && (
                    <tr><td colSpan={8}><div className="empty">No exceptions for this batch.</div></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function AssignForm({ users, onAssign }: { users: Array<{ id: number; username: string }>; onAssign: (ownerId: number, note: string) => void }) {
  const [owner, setOwner] = useState<number>(users[0]?.id ?? 0);
  const [note, setNote] = useState("");

  return (
    <div className="row-actions">
      <select value={owner} onChange={(e) => setOwner(Number(e.target.value))} style={{ width: 120 }}>
        {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
      </select>
      <input placeholder="note" value={note} onChange={(e) => setNote(e.target.value)} style={{ width: 160 }} />
      <button className="btn secondary" type="button" onClick={() => onAssign(owner, note)}>Assign</button>
    </div>
  );
}
