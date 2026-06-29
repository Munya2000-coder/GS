import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NAV } from "@/lib/navigation";
import { ROLES } from "@/lib/rbac";
import { type SidebarItem } from "@/components/layout/sidebar";
import { Shell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Filter nav to what this user's roles permit (PRD §10.1 — RBAC at UI layer).
  const items: SidebarItem[] = NAV.filter(
    (n) => !n.permission || user.permissions.has(n.permission),
  ).map((n) => ({ label: n.label, href: n.href, iconName: n.iconName, ready: n.ready }));

  const roleLabels = user.roles.map((r) => ROLES[r].label);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-elms-navy focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Shell items={items} displayName={user.displayName} roleLabels={roleLabels} siteScope={user.siteScope}>
        {children}
      </Shell>
    </>
  );
}
