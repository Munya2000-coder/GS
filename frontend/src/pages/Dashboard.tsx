import { Link } from "react-router-dom";
import { Admin, Platform } from "../api/endpoints";
import Kpi from "../components/Kpi";
import ErrorBanner from "../components/ErrorBanner";
import { formatCurrency, useAsync } from "../hooks/useAsync";

export default function Dashboard() {
  const summary = useAsync(() => Platform.summary(), []);
  const me = useAsync(() => Admin.me(), []);

  if (summary.loading && me.loading) return <div className="loading">Loading platform summary…</div>;

  const quick: Array<{ to: string; label: string; hint: string }> = [
    { to: "/funds", label: "New fund", hint: "Create an entity / fund" },
    { to: "/investors", label: "New investor", hint: "Onboard an LP" },
    { to: "/capital-calls", label: "Issue capital call", hint: "Generate & allocate" },
    { to: "/distributions", label: "Distribute proceeds", hint: "Pro-rata payout" },
    { to: "/transactions/import", label: "Import transactions", hint: "JSON or CSV" },
    { to: "/fees", label: "Run fees", hint: "Accrue management fees" },
    { to: "/waterfall", label: "Run waterfall", hint: "Carry calculation" },
    { to: "/nav", label: "Publish NAV", hint: "Fund-level snapshot" },
    { to: "/periods", label: "Close period", hint: "Soft/hard close" },
    { to: "/reports", label: "Reports & exports", hint: "Download CSVs" },
    { to: "/reconciliation", label: "Reconcile", hint: "Batches & breaks" },
    { to: "/admin", label: "User admin", hint: "Roles & access" },
  ];

  return (
    <>
      <h1>Dashboard</h1>
      <ErrorBanner error={summary.error || me.error} />

      {me.data && (
        <p className="muted" style={{ marginTop: 0 }}>
          Signed in as <span className="mono">{me.data.username}</span>
          {me.data.roles.length > 0 && (
            <>
              {" "}· roles{" "}
              {me.data.roles.map((r) => (
                <span key={r} className="chip" style={{ marginRight: 4 }}>{r}</span>
              ))}
            </>
          )}
        </p>
      )}

      {summary.data && (
        <>
          <h2>Portfolio</h2>
          <div className="grid">
            <Kpi label="Funds" value={summary.data.funds.total} sub={`${summary.data.funds.active} active`} />
            <Kpi label="Investors" value={summary.data.investors} />
            <Kpi label="Committed" value={formatCurrency(summary.data.aum.committed)} />
            <Kpi label="Contributed" value={formatCurrency(summary.data.aum.contributed)} />
            <Kpi label="Distributed" value={formatCurrency(summary.data.aum.distributed)} />
            <Kpi label="NAV" value={formatCurrency(summary.data.aum.nav)} />
          </div>

          <h2>Operational</h2>
          <div className="grid">
            <Kpi label="Open Exceptions" value={summary.data.operational.open_exceptions} />
            <Kpi label="Recon Breaks" value={summary.data.operational.recon_breaks} />
            <Kpi label="Failed Jobs" value={summary.data.operational.failed_jobs} />
            <Kpi label="Pending Approvals" value={summary.data.operational.pending_approvals} />
          </div>
        </>
      )}

      <h2>Quick actions</h2>
      <div className="grid">
        {quick.map((q) => (
          <Link key={q.to} to={q.to} className="card" style={{ textDecoration: "none", display: "block" }}>
            <div className="label" style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>{q.label} →</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{q.hint}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
