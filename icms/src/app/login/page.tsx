import { ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { parseRoles, ROLES } from "@/lib/rbac";
import { devLogin } from "./actions";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: { displayName: "asc" },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-elms-navy p-6">
      <div className="w-full max-w-2xl rounded-xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-9 w-9 text-elms-teal" />
          <div>
            <h1 className="text-xl font-semibold text-elms-navy">ICMS</h1>
            <p className="text-sm text-muted-foreground">
              Immigration Compliance Management System · ELMS Health Solutions Ltd
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-md bg-elms-teal-light p-3 text-xs text-elms-navy">
          <strong>Development sign-in.</strong> In production, all internal staff authenticate via
          Azure Entra ID SSO with MFA (PRD §7.2). Pick a seeded user below to explore the system
          under different roles and RBAC scopes.
        </div>

        {users.length === 0 ? (
          <p className="text-sm text-elms-alert">
            No users found. Run <code className="font-mono">npm run db:seed</code> first.
          </p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const roles = parseRoles(u.roles);
              return (
                <form key={u.id} action={devLogin}>
                  <input type="hidden" name="userId" value={u.id} />
                  <button
                    type="submit"
                    className="flex w-full items-center justify-between rounded-md border border-input px-4 py-3 text-left transition-colors hover:border-elms-teal hover:bg-elms-teal-light/40"
                  >
                    <div>
                      <div className="font-medium text-elms-navy">{u.displayName}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </div>
                    <div className="flex max-w-[55%] flex-wrap justify-end gap-1">
                      {roles.map((r) => (
                        <Badge key={r} variant="default" className="text-[10px]">{ROLES[r].label}</Badge>
                      ))}
                    </div>
                  </button>
                </form>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
