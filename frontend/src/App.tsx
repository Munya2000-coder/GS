import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import AuditPage from "./pages/Audit";
import CapitalCallsPage from "./pages/CapitalCalls";
import Dashboard from "./pages/Dashboard";
import DistributionsPage from "./pages/Distributions";
import FundDetailPage from "./pages/FundDetail";
import FundsPage from "./pages/Funds";
import InvestorsPage from "./pages/Investors";
import LoginPage from "./pages/Login";
import OperationsPage from "./pages/Operations";
import PeriodsPage from "./pages/Periods";
import TransactionsPage from "./pages/Transactions";

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
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="capital-calls" element={<CapitalCallsPage />} />
        <Route path="distributions" element={<DistributionsPage />} />
        <Route path="periods" element={<PeriodsPage />} />
        <Route path="operations" element={<OperationsPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
