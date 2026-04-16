import { Link } from "react-router-dom";
import { Entities } from "../api/endpoints";
import StateBadge from "../components/StateBadge";
import ErrorBanner from "../components/ErrorBanner";
import { useAsync } from "../hooks/useAsync";

export default function FundsPage() {
  const { data, loading, error } = useAsync(() => Entities.list(), []);

  return (
    <>
      <h1>Funds</h1>
      <ErrorBanner error={error} />
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
                <tr><td colSpan={8}><div className="empty">No funds yet. Run <span className="mono">gsctl seed</span> for demo data.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
