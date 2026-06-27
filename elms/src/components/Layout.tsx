import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store/store";
import { Icon, type IconName } from "./Icon";
import { ProgressRing } from "./ui";
import { compliancePct } from "../lib/analytics";
import { pendingApprovals } from "../lib/analytics";
import { ORG } from "../data/seed";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  badge?: number;
}

const PAGE_META: Record<string, { eyebrow: string; title: string }> = {
  "/": { eyebrow: "Overview", title: "Compliance Dashboard" },
  "/staff": { eyebrow: "Workforce", title: "Staff Register" },
  "/matrix": { eyebrow: "Compliance", title: "Training Matrix" },
  "/catalogue": { eyebrow: "Configuration", title: "Module Catalogue" },
  "/evidence": { eyebrow: "Workflow", title: "Evidence & Approvals" },
  "/overdue": { eyebrow: "Risk", title: "Overdue & Due Soon" },
  "/reports": { eyebrow: "Compliance", title: "Reports & CQC Export" },
  "/reviews": { eyebrow: "Governance", title: "Annual Review Log" },
  "/audit": { eyebrow: "Governance", title: "Audit Trail" },
  "/notifications": { eyebrow: "Activity", title: "Notifications" },
  "/users": { eyebrow: "Administration", title: "User Management" },
  "/settings": { eyebrow: "Administration", title: "Settings" },
};

export function Layout() {
  const { user, logout, computed, notifications, inspectionMode } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [search, setSearch] = useState("");

  const pct = useMemo(() => compliancePct(computed), [computed]);
  const pendingCount = useMemo(() => pendingApprovals(computed).length, [computed]);
  const unread = notifications.filter((n) => !n.read).length;

  const primaryNav: NavItem[] = [
    { to: "/", label: "Dashboard", icon: "dashboard" },
    { to: "/staff", label: "Staff Register", icon: "staff" },
    { to: "/matrix", label: "Training Matrix", icon: "matrix" },
    { to: "/catalogue", label: "Module Catalogue", icon: "book" },
  ];
  const complianceNav: NavItem[] = [
    { to: "/evidence", label: "Evidence & Approvals", icon: "upload", badge: pendingCount },
    { to: "/overdue", label: "Overdue & Due Soon", icon: "alert" },
    { to: "/reports", label: "Reports & Export", icon: "report" },
  ];
  const govNav: NavItem[] = [
    { to: "/reviews", label: "Annual Reviews", icon: "clipboard" },
    { to: "/audit", label: "Audit Trail", icon: "history" },
    { to: "/notifications", label: "Notifications", icon: "bell", badge: unread },
  ];
  const adminNav: NavItem[] = [
    { to: "/users", label: "User Management", icon: "shield" },
    { to: "/settings", label: "Settings", icon: "settings" },
  ];

  const meta = PAGE_META[location.pathname] ?? { eyebrow: "ELMS", title: "Training Management" };

  const renderGroup = (label: string, items: NavItem[]) => (
    <>
      <div className="nav-group-label">{label}</div>
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === "/"} className="nav-link">
          <Icon name={n.icon} size={18} />
          <span>{n.label}</span>
          {n.badge ? <span className="nav-badge">{n.badge}</span> : null}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">EH</div>
          <div>
            <div className="brand-name">ELMS Health</div>
            <div className="brand-sub">Training &amp; Compliance</div>
          </div>
        </div>
        <nav className="nav">
          {renderGroup("Overview", primaryNav)}
          {renderGroup("Compliance", complianceNav)}
          {renderGroup("Governance", govNav)}
          {!inspectionMode && renderGroup("Administration", adminNav)}
        </nav>
        <div className="sidebar-foot">
          <div className="org-chip">
            <div className="ring">
              <ProgressRing value={pct} size={42} stroke={5} sublabel="" label={`${pct}%`} />
            </div>
            <div className="org-chip-meta">
              <b>Org compliance</b>
              <span>{ORG.name.split(" ").slice(0, 2).join(" ")}</span>
            </div>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <div>
          <div className="page-eyebrow">{meta.eyebrow}</div>
          <div className="page-title">{meta.title}</div>
        </div>

        {inspectionMode && (
          <span className="badge violet" style={{ marginLeft: 6 }}>
            <Icon name="eye" size={12} /> Inspection mode · read-only
          </span>
        )}

        <div className="topbar-search">
          <Icon name="search" size={16} />
          <input
            placeholder="Search staff, modules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && search.trim()) navigate("/staff");
            }}
          />
        </div>

        <button className="icon-btn" onClick={() => navigate("/notifications")} aria-label="Notifications">
          <Icon name="bell" size={18} />
          {unread > 0 && <span className="dot" />}
        </button>

        <button className="user-chip" onClick={() => navigate(inspectionMode ? "/" : "/settings")}>
          <span className="avatar sm" style={{ background: user?.avatarColor ?? "#0f766e" }}>
            {user?.name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
          <span className="user-chip-meta">
            <b>{user?.name}</b>
            <span>{user?.roleLabel}</span>
          </span>
        </button>

        <button className="icon-btn" onClick={() => { logout(); navigate("/login"); }} aria-label="Sign out">
          <Icon name="logout" size={18} />
        </button>
      </header>

      <main className="main">
        <div className="main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
