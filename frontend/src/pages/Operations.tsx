import { Jobs, Platform } from "../api/endpoints";
import ErrorBanner from "../components/ErrorBanner";
import Kpi from "../components/Kpi";
import StateBadge from "../components/StateBadge";
import { useAsync } from "../hooks/useAsync";

export default function OperationsPage() {
  const dash = useAsync(() => Platform.operations(), []);
  const jobs = useAsync(() => Jobs.list(), []);

  return (
    <>
      <h1>Operations</h1>
      <ErrorBanner error={dash.error || jobs.error} />

      {dash.data && (
        <>
          <h2>Jobs — last 7 days</h2>
          <div className="grid">
            {Object.entries(dash.data.jobs_last_7d).length === 0 ? (
              <div className="card muted">No jobs recorded in the last 7 days.</div>
            ) : (
              Object.entries(dash.data.jobs_last_7d).map(([status, count]) => (
                <Kpi key={status} label={status} value={count} />
              ))
            )}
          </div>

          <h2>Exceptions by code</h2>
          <div className="grid">
            {Object.entries(dash.data.exceptions_by_code).length === 0 ? (
              <div className="card muted">No import exceptions recorded.</div>
            ) : (
              Object.entries(dash.data.exceptions_by_code).map(([code, count]) => (
                <Kpi key={code} label={code} value={count} />
              ))
            )}
          </div>

          <h2>Pending approvals</h2>
          <div className="grid">
            <Kpi label="Waterfall runs" value={dash.data.pending_waterfall_approvals} />
            <Kpi label="Fee accruals" value={dash.data.pending_fee_approvals} />
          </div>
        </>
      )}

      <h2>Recent Jobs</h2>
      {jobs.loading ? (
        <div className="loading">Loading…</div>
      ) : (
        <div className="card pad-0">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Type</th><th>Trigger</th><th>Status</th>
                <th>Started</th><th>Finished</th><th>Error</th>
              </tr>
            </thead>
            <tbody>
              {(jobs.data ?? []).slice(0, 50).map((j) => (
                <tr key={j.id}>
                  <td>{j.id}</td>
                  <td>{j.job_type}</td>
                  <td>{j.trigger_source}</td>
                  <td><StateBadge value={j.status} /></td>
                  <td>{j.started_at ?? "—"}</td>
                  <td>{j.finished_at ?? "—"}</td>
                  <td className="muted">{j.error ?? ""}</td>
                </tr>
              ))}
              {jobs.data && jobs.data.length === 0 && (
                <tr><td colSpan={7}><div className="empty">No jobs yet.</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
