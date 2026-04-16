import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { username, signOut } = useAuth();

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">GS · Private Capital</div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <div className="sidebar-section">Structure</div>
          <NavLink to="/funds">Funds</NavLink>
          <NavLink to="/investors">Investors</NavLink>
          <div className="sidebar-section">Operations</div>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/transactions/import">Import</NavLink>
          <NavLink to="/capital-calls">Capital Calls</NavLink>
          <NavLink to="/distributions">Distributions</NavLink>
          <NavLink to="/nav">NAV</NavLink>
          <div className="sidebar-section">Accounting</div>
          <NavLink to="/fees">Fees</NavLink>
          <NavLink to="/waterfall">Waterfall</NavLink>
          <NavLink to="/periods">Periods</NavLink>
          <NavLink to="/reconciliation">Reconciliation</NavLink>
          <div className="sidebar-section">Reporting</div>
          <NavLink to="/reports">Reports</NavLink>
          <NavLink to="/operations">Operations</NavLink>
          <NavLink to="/audit">Audit</NavLink>
          <div className="sidebar-section">System</div>
          <NavLink to="/admin">Admin</NavLink>
        </nav>
      </aside>

      <header className="topbar">
        <span className="muted">{import.meta.env.DEV ? "development" : "production"}</span>
        <div className="spacer" />
        <span className="mono">{username}</span>
        <button className="btn ghost" onClick={signOut}>sign out</button>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
