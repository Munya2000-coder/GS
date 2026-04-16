import { useState, type FormEvent } from "react";
import { Admin } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import { useAsync } from "../hooks/useAsync";

const ALL_ROLES = [
  "fund_accountant",
  "fund_controller",
  "finance_manager",
  "ops_analyst",
  "investor_relations",
  "portfolio_analyst",
  "compliance",
  "auditor",
  "sys_admin",
  "executive",
  "external",
];

export default function AdminPage() {
  const users = useAsync(() => Admin.listUsers(), []);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    username: "",
    display_name: "",
    email: "",
    roles: [] as string[],
    mfa_enabled: false,
  });

  async function create(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Admin.createUser(form);
      setShowForm(false);
      setForm({ username: "", display_name: "", email: "", roles: [], mfa_enabled: false });
      users.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function deactivate(id: number) {
    if (!confirm("Deactivate this user?")) return;
    setActionError(null);
    try {
      await Admin.deactivate(id);
      users.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter((r) => r !== role) : [...f.roles, role],
    }));
  }

  return (
    <>
      <h1>User Administration</h1>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New user"}
        </button>
      </div>

      <ErrorBanner error={users.error || actionError} />

      {showForm && (
        <form className="card" onSubmit={create} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>Username</label>
              <input required pattern="[a-zA-Z0-9_-]+" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label>Display name</label>
              <input required value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label>Email</label>
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Roles</label>
            <div className="pill-row">
              {ALL_ROLES.map((role) => (
                <label key={role} className="chip" style={{ cursor: "pointer", background: form.roles.includes(role) ? "var(--accent-dim)" : undefined, color: form.roles.includes(role) ? "white" : undefined }}>
                  <input type="checkbox" checked={form.roles.includes(role)} onChange={() => toggleRole(role)} style={{ display: "none" }} />
                  {role}
                </label>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label style={{ display: "inline" }}>
              <input type="checkbox" checked={form.mfa_enabled} onChange={(e) => setForm({ ...form, mfa_enabled: e.target.checked })} />{" "}
              MFA enabled
            </label>
          </div>
          <button className="btn" type="submit">Create user</button>
        </form>
      )}

      {users.loading ? <div className="loading">Loading…</div> : (
        <div className="card pad-0">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Username</th><th>Name</th><th>Email</th>
                <th>Roles</th><th>MFA</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users.data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td className="mono">{u.username}</td>
                  <td>{u.display_name}</td>
                  <td className="muted">{u.email}</td>
                  <td>
                    <div className="pill-row">
                      {u.roles.map((r) => <span key={r} className="chip">{r}</span>)}
                    </div>
                  </td>
                  <td>{u.mfa_enabled ? <span className="badge ok">yes</span> : <span className="badge muted">no</span>}</td>
                  <td>{u.active ? <span className="badge ok">active</span> : <span className="badge err">inactive</span>}</td>
                  <td className="row-actions">
                    {u.active && (
                      <button className="btn danger" onClick={() => deactivate(u.id)}>Deactivate</button>
                    )}
                  </td>
                </tr>
              ))}
              {users.data && users.data.length === 0 && (
                <tr><td colSpan={8}><div className="empty">No users yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
