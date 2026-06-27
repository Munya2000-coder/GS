import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useStore } from "./store/store";
import { Layout } from "./components/Layout";
import { ToastHost } from "./components/ToastHost";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { StaffRegister } from "./pages/StaffRegister";
import { StaffProfile } from "./pages/StaffProfile";
import { TrainingMatrix } from "./pages/TrainingMatrix";
import { ModuleCatalogue } from "./pages/ModuleCatalogue";
import { Evidence } from "./pages/Evidence";
import { Overdue } from "./pages/Overdue";
import { Reports } from "./pages/Reports";
import { AnnualReviews } from "./pages/AnnualReviews";
import { AuditLog } from "./pages/AuditLog";
import { Notifications } from "./pages/Notifications";
import { UserManagement } from "./pages/UserManagement";
import { Settings } from "./pages/Settings";

export default function App() {
  const { user } = useStore();
  const location = useLocation();

  if (!user) {
    if (location.pathname !== "/login") {
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }
    return (
      <>
        <Login />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/staff" element={<StaffRegister />} />
          <Route path="/staff/:id" element={<StaffProfile />} />
          <Route path="/matrix" element={<TrainingMatrix />} />
          <Route path="/catalogue" element={<ModuleCatalogue />} />
          <Route path="/evidence" element={<Evidence />} />
          <Route path="/overdue" element={<Overdue />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/reviews" element={<AnnualReviews />} />
          <Route path="/audit" element={<AuditLog />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/users" element={<UserManagement />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <ToastHost />
    </>
  );
}
