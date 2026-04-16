import { useState, type FormEvent } from "react";
import { Investors } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import { useAsync } from "../hooks/useAsync";

export default function InvestorsPage() {
  const { data, loading, error, reload } = useAsync(() => Investors.list(), []);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: "",
    legal_name: "",
    short_name: "",
    domicile: "US",
    tax_classification: "",
    regulatory_classification: "",
    side_letter: false,
    primary_contact: "",
    primary_email: "",
  });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Investors.create({
        ...form,
        tax_classification: form.tax_classification || null,
        regulatory_classification: form.regulatory_classification || null,
        primary_contact: form.primary_contact || null,
        primary_email: form.primary_email || null,
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
      <h1>Investors</h1>

      <div className="toolbar">
        <div className="spacer" />
        <button className="btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ New investor"}
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
              <label>Domicile</label>
              <input required value={form.domicile} onChange={(e) => setForm({ ...form, domicile: e.target.value.toUpperCase() })} />
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
              <label>Tax classification</label>
              <input placeholder="e.g. exempt" value={form.tax_classification} onChange={(e) => setForm({ ...form, tax_classification: e.target.value })} />
            </div>
            <div>
              <label>Regulatory classification</label>
              <input value={form.regulatory_classification} onChange={(e) => setForm({ ...form, regulatory_classification: e.target.value })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Primary contact</label>
              <input value={form.primary_contact} onChange={(e) => setForm({ ...form, primary_contact: e.target.value })} />
            </div>
            <div>
              <label>Primary email</label>
              <input type="email" value={form.primary_email} onChange={(e) => setForm({ ...form, primary_email: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label style={{ display: "inline" }}>
              <input type="checkbox" checked={form.side_letter} onChange={(e) => setForm({ ...form, side_letter: e.target.checked })} />{" "}
              Side-letter in place
            </label>
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
                <th>Code</th><th>Legal Name</th><th>Domicile</th>
                <th>Email</th><th>Side-letter</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((i) => (
                <tr key={i.id}>
                  <td className="mono">{i.code}</td>
                  <td>{i.legal_name}</td>
                  <td>{i.domicile}</td>
                  <td className="muted">{i.primary_email ?? "—"}</td>
                  <td>{i.side_letter ? <span className="badge warn">yes</span> : <span className="badge muted">no</span>}</td>
                  <td><StateBadge value={i.status} /></td>
                </tr>
              ))}
              {data && data.length === 0 && (
                <tr><td colSpan={6}><div className="empty">No investors yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
