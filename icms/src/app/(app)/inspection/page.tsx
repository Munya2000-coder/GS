import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { RagBadge } from "@/components/rag-badge";
import { createInspector, revokeInspector } from "./actions";

export const dynamic = "force-dynamic";

// Inspection Mode — UKVI inspection dashboard + evidence pack (PRD Module 18).
export default async function InspectionPage() {
  const guard = await pageGuard("inspection.run");
  if (guard) return guard;

  const [workers, latestRecon, licence, inspectors] = await Promise.all([
    prisma.worker.findMany({
      include: { appendixD: true },
      orderBy: { wcid: "asc" },
    }),
    prisma.payrollReconciliation.findFirst({ orderBy: { runAt: "desc" } }),
    prisma.sponsorLicence.findFirst({ include: { organisation: true } }),
    prisma.user.findMany({ where: { roles: { contains: "INSPECTOR" } }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-5">
      <PageIntro
        title="Inspection Mode"
        subtitle="Read-only UKVI inspection dashboard and on-demand evidence pack (Module 18)"
      />

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-elms-navy">{workers.length}</div>
            <div className="text-xs text-muted-foreground">Sponsored workers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm font-semibold text-elms-navy">
              {latestRecon ? `${latestRecon.period} · ${latestRecon.status}` : "No reconciliation"}
            </div>
            <div className="text-xs text-muted-foreground">
              {latestRecon
                ? `${latestRecon.exceptionsCount} exception(s) of ${latestRecon.totalRecords} · run ${fmtDate(latestRecon.runAt)}`
                : "Latest payroll reconciliation"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm font-semibold text-elms-navy">
              {licence ? `Rating ${licence.rating}` : "No licence"}
            </div>
            <div className="text-xs text-muted-foreground">
              {licence
                ? `${licence.licenceNumber} · expires ${fmtDate(licence.expiryDate)}`
                : "Licence governance status"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate inspection pack (ICMS-078/080) */}
      <Card>
        <CardHeader><CardTitle>Generate inspection pack (ICMS-078/080)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Produces a single structured ZIP containing the sponsor licence pack, the worker register,
            the CoS register, and per-worker Appendix D evidence — ready to hand to a UKVI compliance officer.
          </p>
          <a
            href="/inspection/export"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-elms-navy px-6 text-sm font-medium text-white transition-colors hover:bg-elms-navy/90"
          >
            Download inspection pack (ZIP)
          </a>
        </CardContent>
      </Card>

      {/* UKVI Inspection Dashboard (ICMS-070) */}
      <Card>
        <CardHeader><CardTitle>UKVI Inspection Dashboard (ICMS-070)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WCID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>RAG</TableHead>
                <TableHead>Compliance score</TableHead>
                <TableHead>Appendix D</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-sm text-muted-foreground">No workers.</TableCell>
                </TableRow>
              )}
              {workers.map((w) => {
                const required = w.appendixD.filter((i) => i.required);
                const approved = required.filter((i) => i.status === "Approved");
                const complete = required.length > 0 && approved.length === required.length;
                return (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs">{w.wcid}</TableCell>
                    <TableCell className="font-medium text-elms-navy">{w.legalName}</TableCell>
                    <TableCell><RagBadge status={w.ragStatus} /></TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{w.complianceScore}%</TableCell>
                    <TableCell>
                      <Badge variant={complete ? "green" : "amber"}>
                        {approved.length}/{required.length} approved
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inspector accounts (ICMS-079) */}
      <Card>
        <CardHeader><CardTitle>Read-only inspector accounts (ICMS-079)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Inspector accounts are external, read-only, and automatically expire 72 hours after creation.
            Creation and revocation are recorded in the audit trail.
          </p>

          <form action={createInspector} className="flex flex-wrap items-end gap-2 border-t pt-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Email</label>
              <Input name="email" type="email" placeholder="inspector@homeoffice.gov.uk" required />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground">Display name</label>
              <Input name="displayName" placeholder="UKVI Compliance Officer" required />
            </div>
            <Button type="submit" variant="navy">Create 72-hour inspector</Button>
          </form>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Display name</TableHead>
                <TableHead>Access expires</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inspectors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">No inspector accounts.</TableCell>
                </TableRow>
              )}
              {inspectors.map((u) => {
                const expired = u.accessExpiresAt ? u.accessExpiresAt < new Date() : false;
                const revoked = !u.isActive || expired;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="text-xs">{u.email}</TableCell>
                    <TableCell className="font-medium text-elms-navy">{u.displayName}</TableCell>
                    <TableCell>
                      {fmtDate(u.accessExpiresAt)}{" "}
                      <Badge variant={revoked ? "red" : "green"}>{revoked ? "Expired" : "Active"}</Badge>
                    </TableCell>
                    <TableCell>
                      {!revoked && (
                        <form action={revokeInspector}>
                          <input type="hidden" name="userId" value={u.id} />
                          <Button type="submit" variant="destructive" size="sm">Revoke</Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
