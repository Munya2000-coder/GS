import { Investors } from "../api/endpoints";
import ErrorBanner from "../components/ErrorBanner";
import StateBadge from "../components/StateBadge";
import { useAsync } from "../hooks/useAsync";

export default function InvestorsPage() {
  const { data, loading, error } = useAsync(() => Investors.list(), []);

  return (
    <>
      <h1>Investors</h1>
      <ErrorBanner error={error} />
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
                  <td>{i.code}</td>
                  <td>{i.legal_name}</td>
                  <td>{i.domicile}</td>
                  <td>{i.primary_email ?? "—"}</td>
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
