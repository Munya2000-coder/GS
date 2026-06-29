import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { NAV } from "@/lib/navigation";
import { ROLES } from "@/lib/rbac";
import { Sidebar, type SidebarItem } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // Filter nav to what this user's roles permit (PRD §10.1 — RBAC at UI layer).
  const items: SidebarItem[] = NAV.filter(
    (n) => !n.permission || user.permissions.has(n.permission),
  ).map((n) => ({ label: n.label, href: n.href, iconName: n.iconName, ready: n.ready }));

  const roleLabels = user.roles.map((r) => ROLES[r].label);

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header displayName={user.displayName} roleLabels={roleLabels} siteScope={user.siteScope} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
