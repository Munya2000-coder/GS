import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { ROLES, type RoleKey } from "@/lib/rbac";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { EmptyState } from "@/components/empty-state";
import { attestPolicy } from "./actions";

export const dynamic = "force-dynamic";

// Policy attestation register (PRD Module 29).
export default async function PoliciesPage() {
  const guard = await pageGuard("policy.view");
  if (guard) return guard;

  const user = await getCurrentUser();
  const policies = await prisma.policyDocument.findMany({
    include: { attestations: true },
    orderBy: { title: "asc" },
  });

  const userName = user?.displayName ?? "";
  const userRoles = user?.roles ?? [];

  return (
    <div className="space-y-5">
      <PageIntro
        title="Policies"
        subtitle="Controlled compliance policies — version-controlled, with electronic acknowledgement tracking (Module 29)"
      />

      <Card>
        <CardHeader><CardTitle>Controlled policies</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {policies.length === 0 ? (
            <EmptyState
              title="No policies published"
              message="Controlled compliance policies will appear here once published and version-controlled."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Attestations</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((p) => {
                  const requiredRoles = p.requiredRoles
                    .split("|")
                    .map((r) => r.trim())
                    .filter(Boolean);
                  const isRequiredForUser = requiredRoles.some((r) => (userRoles as string[]).includes(r));
                  const hasAttested = p.attestations.some((a) => a.userName === userName);
                  const actionRequired = isRequiredForUser && !hasAttested;

                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium text-elms-navy">{p.title}</div>
                        {requiredRoles.length > 0 && (
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            Required for: {requiredRoles
                              .map((r) => ROLES[r as RoleKey]?.label ?? r)
                              .join(", ")}
                          </div>
                        )}
                        {actionRequired && (
                          <Badge variant="amber" className="mt-1">Action required</Badge>
                        )}
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.version}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.category ?? "—"}</TableCell>
                      <TableCell className="text-sm">{fmtDate(p.publishedAt)}</TableCell>
                      <TableCell className="text-sm">{p.attestations.length}</TableCell>
                      <TableCell>
                        {hasAttested ? (
                          <Badge variant="green">Acknowledged</Badge>
                        ) : (
                          <form action={attestPolicy}>
                            <input type="hidden" name="policyId" value={p.id} />
                            <Button type="submit" size="sm">Acknowledge</Button>
                          </form>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <p className="text-xs text-muted-foreground">
            Overdue attestations escalate automatically. Acknowledgement records are retained in worker personnel
            files (ICMS-104).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
