"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SidebarNav, type SidebarItem } from "./sidebar";
import { Header } from "./header";

/**
 * Responsive application shell (PRD §8.2/§8.3 — persistent left nav on desktop,
 * collapses to a drawer on mobile). Owns the mobile drawer + desktop collapse state.
 */
export function Shell({
  items, displayName, roleLabels, siteScope, children,
}: {
  items: SidebarItem[];
  displayName: string;
  roleLabels: string[];
  siteScope: string | null;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop rail */}
      <div className="sticky top-0 hidden h-screen md:block">
        <SidebarNav items={items} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className={cn("fixed inset-y-0 left-0 z-50 h-screen md:hidden", "animate-in slide-in-from-left duration-200")}>
            <SidebarNav items={items} mobile onNavigate={() => setMobileOpen(false)} />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          displayName={displayName}
          roleLabels={roleLabels}
          siteScope={siteScope}
          onOpenMobile={() => setMobileOpen(true)}
        />
        <main id="main-content" tabIndex={-1} className="flex-1 p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
