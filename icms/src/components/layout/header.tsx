"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserCog } from "lucide-react";
import { logout } from "@/app/login/actions";
import { Badge } from "@/components/ui/badge";
import { NAV } from "@/lib/navigation";

function titleFor(pathname: string): string {
  // Longest matching nav prefix wins (so /workers/123 → "Sponsored Workers").
  const match = [...NAV]
    .filter((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return match?.label ?? "ICMS";
}

export function Header({
  displayName,
  roleLabels,
  siteScope,
}: {
  displayName: string;
  roleLabels: string[];
  siteScope: string | null;
}) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-3">
      <div>
        <h1 className="text-lg font-semibold text-elms-navy">{titleFor(pathname)}</h1>
        <p className="text-xs text-muted-foreground">
          ELMS Health Solutions Ltd · UKVI Sponsor Compliance
          {siteScope ? ` · ${siteScope}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-sm font-medium text-elms-navy">{displayName}</div>
          <div className="flex flex-wrap justify-end gap-1">
            {roleLabels.slice(0, 2).map((r) => (
              <Badge key={r} variant="default" className="text-[10px]">{r}</Badge>
            ))}
            {roleLabels.length > 2 && (
              <Badge variant="outline" className="text-[10px]">+{roleLabels.length - 2}</Badge>
            )}
          </div>
        </div>
        <Link href="/login" title="Switch user (dev)" className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-elms-navy">
          <UserCog className="h-4 w-4" />
        </Link>
        <form action={logout}>
          <button type="submit" title="Sign out" className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-elms-alert">
            <LogOut className="h-4 w-4" />
          </button>
        </form>
      </div>
    </header>
  );
}
