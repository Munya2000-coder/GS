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
          <NavLink to="/funds">Funds</NavLink>
          <NavLink to="/investors">Investors</NavLink>
          <NavLink to="/transactions">Transactions</NavLink>
          <NavLink to="/capital-calls">Capital Calls</NavLink>
          <NavLink to="/distributions">Distributions</NavLink>
          <NavLink to="/periods">Periods</NavLink>
          <NavLink to="/operations">Operations</NavLink>
          <NavLink to="/audit">Audit</NavLink>
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
