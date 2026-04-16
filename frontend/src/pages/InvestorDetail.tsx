import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Entities, Investors } from "../api/endpoints";
import { extractError } from "../api/client";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import { formatCurrency, today, useAsync } from "../hooks/useAsync";

export default function InvestorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const investorId = Number(id);

  const investor = useAsync(() => Investors.get(investorId), [investorId]);
  const commitments = useAsync(() => Investors.commitments(investorId), [investorId]);
  const capitalAccounts = useAsync(() => Investors.capitalAccounts(investorId), [investorId]);
  const entities = useAsync(() => Entities.list(), []);

  const [showCommit, setShowCommit] = useState(false);
  const [showCA, setShowCA] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [commitForm, setCommitForm] = useState({
    entity_id: 0,
    closing_id: "C1",
    closing_date: today(),
    investor_class: "A",
    series: "",
    commitment_amount: "",
    currency: "USD",
  });

  const [caForm, setCaForm] = useState({
    code: "",
    entity_id: 0,
    investor_class: "A",
    series: "",
    carry_participant: false,
  });

  async function addCommitment(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Investors.createCommitment({
        investor_id: investorId,
        ...commitForm,
        entity_id: Number(commitForm.entity_id),
        series: commitForm.series || null,
      });
      setShowCommit(false);
      setCommitForm({ ...commitForm, commitment_amount: "" });
      commitments.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  async function addCapitalAccount(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    try {
      await Investors.createCapitalAccount({
        investor_id: investorId,
        ...caForm,
        entity_id: Number(caForm.entity_id),
        series: caForm.series || null,
      });
      setShowCA(false);
      setCaForm({ ...caForm, code: "" });
      capitalAccounts.reload();
    } catch (ex) {
      setActionError(extractError(ex));
    }
  }

  if (investor.loading) return <div className="loading">Loading…</div>;
  if (investor.error) return <ErrorBanner error={investor.error} />;
  if (!investor.data) return null;

  const inv = investor.data;

  return (
    <>
      <h1>
        {inv.legal_name} <span className="muted" style={{ fontSize: 14, fontWeight: "normal" }}>· {inv.code}</span>
      </h1>
      <div className="pill-row" style={{ marginBottom: 16 }}>
        <span className="chip">{inv.domicile}</span>
        <span className="chip"><StateBadge value={inv.status} /></span>
        {inv.side_letter && <span className="chip"><span className="badge warn">side-letter</span></span>}
        {inv.primary_email && <span className="chip">{inv.primary_email}</span>}
      </div>

      <ErrorBanner error={actionError || commitments.error || capitalAccounts.error} />

      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Commitments</h2>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowCommit((v) => !v)}>
          {showCommit ? "Cancel" : "+ Add commitment"}
        </button>
      </div>

      {showCommit && (
        <form className="card" onSubmit={addCommitment} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>Fund</label>
              <select required value={commitForm.entity_id} onChange={(e) => setCommitForm({ ...commitForm, entity_id: Number(e.target.value) })}>
                <option value={0}>Select…</option>
                {(entities.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.code} — {e.legal_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Closing ID</label>
              <input required value={commitForm.closing_id} onChange={(e) => setCommitForm({ ...commitForm, closing_id: e.target.value })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Closing date</label>
              <input type="date" required value={commitForm.closing_date} onChange={(e) => setCommitForm({ ...commitForm, closing_date: e.target.value })} />
            </div>
            <div>
              <label>Investor class</label>
              <input required value={commitForm.investor_class} onChange={(e) => setCommitForm({ ...commitForm, investor_class: e.target.value })} />
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Commitment amount</label>
              <input type="number" step="0.01" required value={commitForm.commitment_amount} onChange={(e) => setCommitForm({ ...commitForm, commitment_amount: e.target.value })} />
            </div>
            <div>
              <label>Currency</label>
              <input required maxLength={3} value={commitForm.currency} onChange={(e) => setCommitForm({ ...commitForm, currency: e.target.value.toUpperCase() })} />
            </div>
          </div>
          <div className="form-row">
            <label>Series (optional)</label>
            <input value={commitForm.series} onChange={(e) => setCommitForm({ ...commitForm, series: e.target.value })} />
          </div>
          <button className="btn" type="submit">Add commitment</button>
        </form>
      )}

      <div className="card pad-0" style={{ marginBottom: 16 }}>
        <table>
          <thead>
            <tr>
              <th>ID</th><th>Fund</th><th>Closing</th><th>Date</th>
              <th>Class</th><th className="num">Amount</th><th>Currency</th>
            </tr>
          </thead>
          <tbody>
            {(commitments.data ?? []).map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>#{c.entity_id}</td>
                <td className="mono">{c.closing_id}</td>
                <td>{c.closing_date}</td>
                <td>{c.investor_class}</td>
                <td className="num">{formatCurrency(c.commitment_amount, c.currency)}</td>
                <td>{c.currency}</td>
              </tr>
            ))}
            {commitments.data && commitments.data.length === 0 && (
              <tr><td colSpan={7}><div className="empty">No commitments yet.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="toolbar">
        <h2 style={{ margin: 0 }}>Capital accounts</h2>
        <div className="spacer" />
        <button className="btn" onClick={() => setShowCA((v) => !v)}>
          {showCA ? "Cancel" : "+ Add capital account"}
        </button>
      </div>

      {showCA && (
        <form className="card" onSubmit={addCapitalAccount} style={{ marginBottom: 16 }}>
          <div className="form-row inline">
            <div>
              <label>Code</label>
              <input required value={caForm.code} onChange={(e) => setCaForm({ ...caForm, code: e.target.value })} placeholder="e.g. CA-PE-I-INV1" />
            </div>
            <div>
              <label>Fund</label>
              <select required value={caForm.entity_id} onChange={(e) => setCaForm({ ...caForm, entity_id: Number(e.target.value) })}>
                <option value={0}>Select…</option>
                {(entities.data ?? []).map((e) => (
                  <option key={e.id} value={e.id}>{e.code} — {e.legal_name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row inline">
            <div>
              <label>Investor class</label>
              <input required value={caForm.investor_class} onChange={(e) => setCaForm({ ...caForm, investor_class: e.target.value })} />
            </div>
            <div>
              <label>Series (optional)</label>
              <input value={caForm.series} onChange={(e) => setCaForm({ ...caForm, series: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <label style={{ display: "inline" }}>
              <input type="checkbox" checked={caForm.carry_participant} onChange={(e) => setCaForm({ ...caForm, carry_participant: e.target.checked })} />{" "}
              Carry participant
            </label>
          </div>
          <button className="btn" type="submit">Create capital account</button>
        </form>
      )}

      <div className="card pad-0">
        <table>
          <thead>
            <tr>
              <th>Code</th><th>Fund</th><th>Class</th>
              <th className="num">Contributed</th><th className="num">Distributed</th>
              <th className="num">NAV</th><th className="num">P&amp;L</th><th>Carry</th>
            </tr>
          </thead>
          <tbody>
            {(capitalAccounts.data ?? []).map((a) => (
              <tr key={a.id}>
                <td className="mono">{a.code}</td>
                <td>#{a.entity_id}</td>
                <td>{a.investor_class}</td>
                <td className="num">{formatCurrency(a.contributed)}</td>
                <td className="num">{formatCurrency(a.distributed)}</td>
                <td className="num">{formatCurrency(a.ending_nav)}</td>
                <td className="num">{formatCurrency(a.allocated_pnl)}</td>
                <td>{a.carry_participant ? <span className="badge ok">yes</span> : <span className="badge muted">no</span>}</td>
              </tr>
            ))}
            {capitalAccounts.data && capitalAccounts.data.length === 0 && (
              <tr><td colSpan={8}><div className="empty">No capital accounts yet.</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
