import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { importBrightPay, resolvePayrollException } from "./actions";

export const dynamic = "force-dynamic";

const SAMPLE_CSV = `wcid,period,grossPay,hoursPaid
WCID-0001,2026-06,1950.00,150
WCID-0002,2026-06,1820.50,148
WCID-0003,2026-06,2100.00,160`;

const gbp = (n: number | null | undefined) =>
  n === null || n === undefined
    ? "—"
    : `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// BrightPay payroll reconciliation + CareLineLive rota monitoring (PRD Modules 9 & 10).
export default async function PayrollRotaPage() {
  const guard = await pageGuard("payroll.view");
  if (guard) return guard;

  const [reconciliation, shifts, exceptions, user] = await Promise.all([
    prisma.payrollReconciliation.findFirst({ orderBy: { runAt: "desc" } }),
    prisma.rotaShift.findMany(),
    prisma.payrollRecord.findMany({
      where: { exception: { not: null } },
      include: { worker: true },
      orderBy: { payPeriod: "desc" },
    }),
    getCurrentUser(),
  ]);
  const canManage = !!user?.permissions.has("payroll.manage");

  // Rota utilisation aggregation (Module 10).
  const plannedHours = shifts.reduce((sum, s) => sum + (s.plannedHours ?? 0), 0);
  const actualHours = shifts.reduce((sum, s) => sum + (s.actualHours ?? 0), 0);
  const noShowCount = shifts.filter((s) => ["No Show", "Absent"].includes(s.status)).length;

  return (
    <div className="space-y-5">
      <PageIntro
        title="Payroll & Rota"
        subtitle="BrightPay payroll reconciliation and CareLineLive rota monitoring (Modules 9 & 10)"
      />

      {/* Reconciliation summary (Module 9) */}
      <Card>
        <CardHeader><CardTitle>Latest reconciliation</CardTitle></CardHeader>
        <CardContent>
          {reconciliation ? (
            <div className="grid grid-cols-4 gap-4">
              <Stat label="Period" value={reconciliation.period} />
              <Stat label="Records" value={reconciliation.totalRecords} />
              <Stat
                label="Exceptions"
                value={reconciliation.exceptionsCount}
                tone={reconciliation.exceptionsCount ? "alert" : "ok"}
              />
              <StatBadge
                label="Status"
                badge={
                  <Badge variant={reconciliation.status === "Completed" ? "green" : "amber"}>
                    {reconciliation.status}
                  </Badge>
                }
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No reconciliation has been run yet. Import a BrightPay export below to create one.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Rota utilisation (Module 10) */}
      <Card>
        <CardHeader><CardTitle>Rota utilisation</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Planned hours" value={plannedHours.toLocaleString("en-GB")} />
            <Stat label="Actual hours" value={actualHours.toLocaleString("en-GB")} />
            <Stat
              label="No-shows / absences"
              value={noShowCount}
              tone={noShowCount ? "alert" : "ok"}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            CareLineLive integration is delivered via REST API v2 + webhook in production (ICMS-046); this view shows
            imported shift data.
          </p>
        </CardContent>
      </Card>

      {/* BrightPay import (Module 9 / ICMS-039) */}
      <Card>
        <CardHeader><CardTitle>BrightPay import</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {canManage ? (
            <form action={importBrightPay} className="space-y-3">
              <Textarea name="csv" defaultValue={SAMPLE_CSV} rows={6} className="font-mono text-xs" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Accepted columns: <code className="font-mono">wcid, period, grossPay, hoursPaid</code>. The import is
                  all-or-nothing — the whole batch is rejected with a specific reason if any row is invalid or references
                  an unknown WCID (ICMS-088).
                </p>
                <Button type="submit" variant="navy">Import &amp; reconcile</Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              You do not have the <code className="font-mono text-xs">payroll.manage</code> permission required to import
              payroll data.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Payroll exceptions (ICMS-041) */}
      <Card>
        <CardHeader><CardTitle>Payroll exceptions</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Expected gross</TableHead>
                <TableHead>Gross pay</TableHead>
                <TableHead>Exception</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">
                    No payroll exceptions outstanding.
                  </TableCell>
                </TableRow>
              )}
              {exceptions.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell>
                    {rec.worker ? (
                      <Link href={`/workers/${rec.workerId}`} className="hover:underline text-elms-navy">
                        {rec.worker.legalName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{rec.payPeriod}</TableCell>
                  <TableCell>{gbp(rec.expectedGross)}</TableCell>
                  <TableCell>{gbp(rec.grossPay)}</TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="red">{rec.exception}</Badge>
                  </TableCell>
                  <TableCell>
                    {rec.resolved ? (
                      <div className="space-y-1">
                        <Badge variant="green">Resolved</Badge>
                        <div className="text-xs text-muted-foreground">by {rec.resolvedBy ?? "—"}</div>
                      </div>
                    ) : canManage ? (
                      <form action={resolvePayrollException} className="space-y-2">
                        <input type="hidden" name="recordId" value={rec.id} />
                        <Textarea
                          name="investigation"
                          required
                          rows={2}
                          placeholder="Documented investigation (ICMS-042)"
                          className="text-xs"
                        />
                        <Button type="submit" size="sm">Resolve</Button>
                      </form>
                    ) : (
                      <Badge variant="amber">Open</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Payroll is reconciled against CoS salary, contract and rota hours (ICMS-040). Unresolved discrepancies older
        than 5 working days auto-escalate to the Authorising Officer (ICMS-043). Closure requires a documented
        investigation (ICMS-042).
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "alert" | "ok" }) {
  const color = tone === "alert" ? "text-elms-alert" : tone === "ok" ? "text-elms-success" : "text-elms-navy";
  return (
    <Card><CardContent className="py-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}

function StatBadge({ label, badge }: { label: string; badge: React.ReactNode }) {
  return (
    <Card><CardContent className="py-4">
      <div className="text-2xl font-bold">{badge}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}
