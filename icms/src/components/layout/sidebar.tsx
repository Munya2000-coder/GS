"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft, ShieldCheck, LayoutDashboard, Users, FileCheck2, FolderOpen, Briefcase,
  Wallet, Send, ClipboardCheck, ClipboardList, AlertTriangle, Landmark, ScanSearch,
  BarChart3, Settings, Sparkles, HeartPulse, BookCheck, UserCircle, X, type LucideIcon,
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
  Sparkles, HeartPulse, BookCheck, UserCircle,
};

/**
 * Presentational navigation. Used in two contexts:
 *  - desktop: a static, collapsible rail (md and up)
 *  - mobile: a slide-in drawer (controlled by the parent Shell)
 */
export function SidebarNav({
  items, collapsed = false, mobile = false, onToggleCollapse, onNavigate,
}: {
  items: SidebarItem[];
  collapsed?: boolean;
  mobile?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className={cn("flex h-full flex-col bg-elms-navy text-white", collapsed ? "w-16" : "w-64")}>
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
        <ShieldCheck className="h-7 w-7 shrink-0 text-elms-teal" />
        {!collapsed && (
          <div className="leading-tight">
            <div className="font-semibold">ICMS</div>
            <div className="text-[10px] text-white/60">ELMS Health Solutions</div>
          </div>
        )}
        {mobile && (
          <button onClick={onNavigate} aria-label="Close menu" className="ml-auto rounded p-1 text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-2" aria-label="Primary">
        {items.map((item) => {
          const Icon = ICONS[item.iconName] ?? LayoutDashboard;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-elms-teal",
                active ? "border-l-2 border-elms-teal bg-elms-teal/20 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="flex-1">{item.label}</span>}
              {!collapsed && !item.ready && (
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-white/50">soon</span>
              )}
            </Link>
          );
        })}
      </nav>

      {!mobile && (
        <button
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex items-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-white/60 hover:text-white"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          {!collapsed && "Collapse"}
        </button>
      )}
    </div>
  );
}
