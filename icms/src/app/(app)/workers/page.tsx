import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate, daysUntil } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RagBadge, ScoreBar } from "@/components/rag-badge";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";

export const dynamic = "force-dynamic";

// Sponsored worker master list (PRD Module 5 / §8.2).
export default async function WorkersPage() {
  const guard = await pageGuard("worker.view");
  if (guard) return guard;

  const workers = await prisma.worker.findMany({
    orderBy: [{ ragStatus: "asc" }, { complianceScore: "asc" }],
    include: { visas: { orderBy: { expiryDate: "desc" }, take: 1 } },
  });

  return (
    <div>
      <PageIntro
        title="Sponsored Workers"
        subtitle={`${workers.length} sponsored workers · live compliance scoring (Module 14)`}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>WCID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Visa expiry</TableHead>
                <TableHead>Compliance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workers.map((w) => {
                const visa = w.visas[0];
                const vd = daysUntil(visa?.expiryDate);
                return (
                  <TableRow key={w.id} className="cursor-pointer">
                    <TableCell className="font-mono text-xs">
                      <Link href={`/workers/${w.id}`} className="text-elms-teal hover:underline">{w.wcid}</Link>
                    </TableCell>
                    <TableCell className="font-medium text-elms-navy">
                      <Link href={`/workers/${w.id}`} className="hover:underline">{w.legalName}</Link>
                    </TableCell>
                    <TableCell>{w.jobTitle}</TableCell>
                    <TableCell>{w.workLocation}</TableCell>
                    <TableCell>
                      <span>{fmtDate(visa?.expiryDate)}</span>{" "}
                      {vd !== null && vd < 30 && (
                        <Badge variant={vd < 0 ? "critical" : "red"} className="ml-1">
                          {vd < 0 ? "expired" : `${vd}d`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell><ScoreBar score={w.complianceScore} rag={w.ragStatus} /></TableCell>
                    <TableCell><RagBadge status={w.ragStatus} /></TableCell>
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
