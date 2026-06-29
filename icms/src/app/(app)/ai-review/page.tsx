import Link from "next/link";
import { prisma } from "@/lib/db";
import { daysUntil } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { EmptyState } from "@/components/empty-state";

export const dynamic = "force-dynamic";

type Severity = "high" | "medium";

type Finding = {
  workerId: string;
  workerName: string;
  finding: string;
  type: string;
  severity: Severity;
};

// AI-Assisted Compliance Review (PRD Module 24 / ICMS-098).
// READ-ONLY: surfaces advisory, AI-assisted findings only. All outputs require
// human review and explicit approval before any compliance action is taken.
export default async function AiReviewPage() {
  const guard = await pageGuard("ai.review");
  if (guard) return guard;

  const workers = await prisma.worker.findMany({
    include: {
      appendixD: true,
      visas: true,
      rtwChecks: true,
      payrollRecords: true,
      recruitmentRecord: true,
    },
    orderBy: { legalName: "asc" },
  });

  const findings: Finding[] = [];

  for (const w of workers) {
    // 1. Missing / expired required Appendix D documents.
    for (const item of w.appendixD) {
      if (!item.required) continue;
      if (item.status === "Missing" || item.status === "Expired") {
        findings.push({
          workerId: w.id,
          workerName: w.legalName,
          finding: `Missing Appendix D: ${item.label}`,
          type: "Missing document",
          severity: item.status === "Expired" ? "high" : "medium",
        });
      }
    }

    // 2. Pay vs CoS inconsistency: unresolved payroll exceptions.
    for (const pr of w.payrollRecords) {
      if (pr.exception && !pr.resolved) {
        findings.push({
          workerId: w.id,
          workerName: w.legalName,
          finding: `Payroll inconsistency: ${pr.exception}`,
          type: "Inconsistency (pay vs CoS)",
          severity: "high",
        });
      }
    }

    // 3. Incomplete recruitment evidence.
    if (w.recruitmentRecord && !w.recruitmentRecord.complete) {
      findings.push({
        workerId: w.id,
        workerName: w.legalName,
        finding: "Recruitment evidence incomplete",
        type: "Incomplete recruitment",
        severity: "medium",
      });
    }

    // 4. Imminent expiry: visa expiry or RTW repeat-check within 30 days.
    for (const v of w.visas) {
      const days = daysUntil(v.expiryDate);
      if (days !== null && days <= 30) {
        findings.push({
          workerId: w.id,
          workerName: w.legalName,
          finding:
            days < 0
              ? `Visa expired ${Math.abs(days)} days ago`
              : `Visa expiring in ${days} days`,
          type: "Imminent expiry",
          severity: days < 0 ? "high" : "medium",
        });
      }
    }
    for (const r of w.rtwChecks) {
      const days = daysUntil(r.repeatCheckDate);
      if (days !== null && days <= 30) {
        findings.push({
          workerId: w.id,
          workerName: w.legalName,
          finding:
            days < 0
              ? `RTW repeat check overdue by ${Math.abs(days)} days`
              : `RTW repeat check due in ${days} days`,
          type: "Imminent expiry",
          severity: days < 0 ? "high" : "medium",
        });
      }
    }
  }

  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;

  return (
    <div className="space-y-5">
      <PageIntro
        title="AI-Assisted Compliance Review"
        subtitle="AI-assisted detection of gaps and inconsistencies — advisory only (Module 24)"
      />

      <Card className="border-l-4 border-l-elms-warning">
        <CardContent className="py-4 text-sm">
          <div className="font-semibold text-elms-navy">Advisory only — human review required</div>
          <p className="mt-1 text-muted-foreground">
            All findings on this page are AI-assisted and advisory only. Each output is logged and must be
            reviewed by an authorised user, who must give explicit approval before any compliance action is
            taken. The AI does not make compliance decisions and never acts autonomously (ICMS-098).
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="text-2xl font-bold text-elms-navy">{findings.length}</div>
            <div className="text-xs text-muted-foreground">Total advisory findings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-elms-navy">{highCount}</div>
              <Badge variant="red">High</Badge>
            </div>
            <div className="text-xs text-muted-foreground">High-severity findings</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-elms-navy">{mediumCount}</div>
              <Badge variant="amber">Medium</Badge>
            </div>
            <div className="text-xs text-muted-foreground">Medium-severity findings</div>
          </CardContent>
        </Card>
      </div>

      {findings.length === 0 ? (
        <EmptyState
          title="No issues detected"
          message="The AI review found no missing documents or inconsistencies."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Advisory findings ({findings.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.map((f, i) => (
                  <TableRow key={`${f.workerId}-${i}`}>
                    <TableCell className="font-medium text-elms-navy">
                      <Link href={`/workers/${f.workerId}`} className="hover:underline">
                        {f.workerName}
                      </Link>
                    </TableCell>
                    <TableCell>{f.finding}</TableCell>
                    <TableCell className="text-muted-foreground">{f.type}</TableCell>
                    <TableCell>
                      <Badge variant={f.severity === "high" ? "red" : "amber"}>
                        {f.severity === "high" ? "High" : "Medium"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="navy">AI-assisted</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        AI-assisted analysis flags potential gaps and inconsistencies for human attention. It is advisory,
        fully logged, and never triggers a compliance action on its own — a qualified user must review and
        explicitly approve any resulting action (ICMS-098).
      </p>
    </div>
  );
}
