import Link from "next/link";
import { ShieldX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import type { Permission } from "@/lib/rbac";

/**
 * Page-level RBAC guard (PRD §10.1 — enforce RBAC at the UI layer too, not only nav).
 * Returns the guard UI to render when the user lacks `permission`, or null to proceed.
 */
export async function pageGuard(permission: Permission): Promise<React.ReactNode | null> {
  const user = await getCurrentUser();
  if (user?.permissions.has(permission)) return null;
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <ShieldX className="mb-3 h-10 w-10 text-elms-alert" />
      <h2 className="text-lg font-semibold text-elms-navy">Access restricted</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Your role does not grant the <code className="font-mono text-xs">{permission}</code> permission required to
        view this page. Access is controlled by role-based access control (PRD Module 19).
      </p>
      <Link href="/" className="mt-4 text-sm text-elms-teal hover:underline">← Back to dashboard</Link>
    </div>
  );
}
