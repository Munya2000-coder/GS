"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChevronLeft, ShieldCheck, LayoutDashboard, Users, FileCheck2, FolderOpen, Briefcase,
  Wallet, Send, ClipboardCheck, ClipboardList, AlertTriangle, Landmark, ScanSearch,
  BarChart3, Settings, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarItem = {
  label: string;
  href: string;
  iconName: string;
  ready: boolean;
};

// Icons are resolved client-side from a small map to keep the server payload light.
const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Users, FileCheck2, ShieldCheck, FolderOpen, Briefcase, Wallet, Send,
  ClipboardCheck, ClipboardList, AlertTriangle, Landmark, ScanSearch, BarChart3, Settings,
};

export function Sidebar({ items }: { items: SidebarItem[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "sticky top-0 flex h-screen flex-col bg-elms-navy text-white transition-all",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-white/10">
        <ShieldCheck className="h-7 w-7 shrink-0 text-elms-teal" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-semibold">ICMS</div>
            <div className="text-[10px] text-white/60">ELMS Health Solutions</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2">
        {items.map((item) => {
          const Icon = ICONS[item.iconName] ?? LayoutDashboard;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors",
                active ? "bg-elms-teal/20 border-l-2 border-elms-teal text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && (
                <span className="flex-1">{item.label}</span>
              )}
              {!collapsed && !item.ready && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/50">soon</span>
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-white/60 hover:text-white"
      >
        <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
        {!collapsed && "Collapse"}
      </button>
    </aside>
  );
}
