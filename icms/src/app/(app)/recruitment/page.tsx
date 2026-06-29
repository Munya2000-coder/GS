import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { parseItems, recruitmentCompleteness } from "@/lib/recruitment";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { approveRecruitmentException } from "./actions";

export const dynamic = "force-dynamic";

// Recruitment evidence + genuine-vacancy support (PRD Modules 3 & 4).
export default async function RecruitmentPage() {
  const guard = await pageGuard("recruitment.view");
  if (guard) return guard;

  const [records, user] = await Promise.all([
    prisma.recruitmentRecord.findMany({
      include: { worker: true },
      orderBy: { worker: { legalName: "asc" } },
    }),
    getCurrentUser(),
  ]);
  const canManage = !!user?.permissions.has("recruitment.manage");

  const rows = records.map((r) => {
    const items = parseItems(r.items);
    return { record: r, ...recruitmentCompleteness(items) };
  });

  const total = rows.length;
  const fullyComplete = rows.filter((r) => r.missing.length === 0).length;
  const needingException = rows.filter((r) => r.missing.length > 0 && !r.record.exceptionApproved).length;

  return (
    <div className="space-y-5">
      <PageIntro
        title="Recruitment"
        subtitle="Recruitment evidence and genuine-vacancy support (Modules 3 & 4)"
      />

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Sponsored workers" value={total} />
        <Stat label="Evidence complete" value={fullyComplete} tone="ok" />
        <Stat label="Needing exception" value={needingException} tone={needingException ? "alert" : undefined} />
      </div>

      <p className="text-sm text-muted-foreground">
        CoS approval is blocked where mandatory recruitment documents are missing, unless a Compliance Manager /
        HR Manager approves a documented exception (ICMS-021).
      </p>

      <Card>
        <CardHeader><CardTitle>Recruitment evidence records</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Completeness</TableHead>
                <TableHead>Missing documents</TableHead>
                <TableHead>Exception</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">
                    No recruitment records.
                  </TableCell>
                </TableRow>
              )}
              {rows.map(({ record, approved, total: totalDocs, missing }) => {
                const pct = totalDocs ? Math.round((approved / totalDocs) * 100) : 0;
                const tone: "green" | "amber" | "red" =
                  approved === totalDocs ? "green" : approved >= totalDocs / 2 ? "amber" : "red";
                return (
                  <TableRow key={record.id}>
                    <TableCell>
                      <Link href={`/workers/${record.workerId}`} className="text-elms-navy hover:underline">
                        {record.worker?.legalName ?? record.workerId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={tone}>{approved}/{totalDocs}</Badge>
                        <div className="h-1.5 w-24 overflow-hidden rounded bg-elms-grey">
                          <div className="h-full bg-elms-teal" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {missing.length === 0 ? "—" : missing.join(", ")}
                    </TableCell>
                    <TableCell>
                      {record.exceptionApproved ? (
                        <Badge variant="green">
                          Exception approved{record.exceptionApprovedBy ? ` · ${record.exceptionApprovedBy}` : ""}
                        </Badge>
                      ) : missing.length > 0 && canManage ? (
                        <form action={approveRecruitmentException}>
                          <input type="hidden" name="workerId" value={record.workerId} />
                          <Button type="submit" size="sm" variant="outline">Approve exception</Button>
                        </form>
                      ) : missing.length > 0 ? (
                        <Badge variant="amber">Exception required</Badge>
                      ) : (
                        "—"
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

function Stat({ label, value, tone }: { label: string; value: number; tone?: "alert" | "ok" }) {
  const color = tone === "alert" ? "text-elms-alert" : tone === "ok" ? "text-elms-success" : "text-elms-navy";
  return (
    <Card><CardContent className="py-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}
