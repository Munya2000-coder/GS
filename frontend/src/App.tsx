import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import AdminPage from "./pages/Admin";
import AuditPage from "./pages/Audit";
import CapitalCallsPage from "./pages/CapitalCalls";
import Dashboard from "./pages/Dashboard";
import DistributionsPage from "./pages/Distributions";
import FeesPage from "./pages/Fees";
import FundDetailPage from "./pages/FundDetail";
import FundsPage from "./pages/Funds";
import InvestorDetailPage from "./pages/InvestorDetail";
import InvestorsPage from "./pages/Investors";
import LoginPage from "./pages/Login";
import NavPage from "./pages/Nav";
import OperationsPage from "./pages/Operations";
import PeriodsPage from "./pages/Periods";
import ReconciliationPage from "./pages/Reconciliation";
import ReportsPage from "./pages/Reports";
import TransactionImportPage from "./pages/TransactionImport";
import TransactionsPage from "./pages/Transactions";
import WaterfallPage from "./pages/Waterfall";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { username } = useAuth();
  if (!username) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="funds" element={<FundsPage />} />
        <Route path="funds/:id" element={<FundDetailPage />} />
        <Route path="investors" element={<InvestorsPage />} />
        <Route path="investors/:id" element={<InvestorDetailPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="transactions/import" element={<TransactionImportPage />} />
        <Route path="capital-calls" element={<CapitalCallsPage />} />
        <Route path="distributions" element={<DistributionsPage />} />
        <Route path="fees" element={<FeesPage />} />
        <Route path="waterfall" element={<WaterfallPage />} />
        <Route path="nav" element={<NavPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="periods" element={<PeriodsPage />} />
        <Route path="reconciliation" element={<ReconciliationPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="audit" element={<AuditPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
