import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate, daysUntil, ALERT_THRESHOLDS } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";

export const dynamic = "force-dynamic";

// Right-to-work management + expiry tracker (PRD Module 6 / ICMS-027,028).
export default async function RightToWorkPage() {
  const guard = await pageGuard("rtw.view");
  if (guard) return guard;

  const checks = await prisma.rightToWorkCheck.findMany({
    include: { worker: true },
    orderBy: { repeatCheckDate: "asc" },
  });

  const nextThreshold = (days: number | null) => {
    if (days === null) return null;
    return [...ALERT_THRESHOLDS].reverse().find((t) => days <= t) ?? null;
  };

  return (
    <div>
      <PageIntro
        title="Right to Work"
        subtitle="RTW checks, share codes, and follow-up expiry tracking (Module 6)"
      />

      <Card className="mb-5">
        <CardHeader><CardTitle>Alert schedule</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Automated reminders fire at <span className="font-mono text-elms-navy">180, 120, 90, 60, 30, 14, 7</span> days
          before the repeat-check date, on the day of expiry, and daily thereafter until resolved (ICMS-028).
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Share code</TableHead>
                <TableHead>Check date</TableHead>
                <TableHead>Checked by</TableHead>
                <TableHead>Repeat check due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checks.map((c) => {
                const d = daysUntil(c.repeatCheckDate);
                const expired = c.status === "Expired" || (d !== null && d < 0);
                const threshold = nextThreshold(d);
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-elms-navy">
                      <Link href={`/workers/${c.workerId}`} className="hover:underline">{c.worker?.legalName}</Link>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.shareCode}</TableCell>
                    <TableCell>{fmtDate(c.checkDate)}</TableCell>
                    <TableCell>{c.checkedBy}</TableCell>
                    <TableCell>
                      {fmtDate(c.repeatCheckDate)}
                      {threshold !== null && !expired && (
                        <Badge variant="amber" className="ml-2">{threshold}d window</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={expired ? "critical" : "green"}>{expired ? "Expired" : "Valid"}</Badge>
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
