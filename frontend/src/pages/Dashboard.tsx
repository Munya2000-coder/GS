import { Platform } from "../api/endpoints";
import Kpi from "../components/Kpi";
import ErrorBanner from "../components/ErrorBanner";
import { useAsync, formatCurrency } from "../hooks/useAsync";

export default function Dashboard() {
  const { data, loading, error } = useAsync(() => Platform.summary(), []);

  if (loading) return <div className="loading">Loading platform summary…</div>;
  if (error) return <ErrorBanner error={error} />;
  if (!data) return null;

  return (
    <>
      <h1>Platform Overview</h1>
      <h2>Portfolio</h2>
      <div className="grid">
        <Kpi label="Funds" value={data.funds.total} sub={`${data.funds.active} active`} />
        <Kpi label="Investors" value={data.investors} />
        <Kpi label="Committed" value={formatCurrency(data.aum.committed)} />
        <Kpi label="Contributed" value={formatCurrency(data.aum.contributed)} />
        <Kpi label="Distributed" value={formatCurrency(data.aum.distributed)} />
        <Kpi label="NAV" value={formatCurrency(data.aum.nav)} />
      </div>

      <h2>Operational</h2>
      <div className="grid">
        <Kpi label="Open Exceptions" value={data.operational.open_exceptions} />
        <Kpi label="Recon Breaks" value={data.operational.recon_breaks} />
        <Kpi label="Failed Jobs" value={data.operational.failed_jobs} />
        <Kpi label="Pending Approvals" value={data.operational.pending_approvals} />
      </div>
    </>
  );
}
