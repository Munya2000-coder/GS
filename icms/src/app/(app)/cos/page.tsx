import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";

export const dynamic = "force-dynamic";

const statusVariant = (s: string): "green" | "amber" | "red" | "outline" | "navy" => {
  if (["Approved", "Assigned", "Used", "Worker Started"].includes(s)) return "green";
  if (["Draft", "Pending Approval"].includes(s)) return "amber";
  if (["Rejected", "Withdrawn", "Expired", "Worker Did Not Start"].includes(s)) return "red";
  return "outline";
};

// CoS register (PRD Module 7 / ICMS-030,031).
export default async function CosPage() {
  const guard = await pageGuard("cos.view");
  if (guard) return guard;

  const records = await prisma.cos.findMany({
    orderBy: { createdAt: "desc" },
    include: { worker: true, approvals: true },
  });

  return (
    <div>
      <PageIntro
        title="CoS Management"
        subtitle="Certificate of Sponsorship register and 5-stage gated approval workflow (Module 2 & 7)"
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CoS number</TableHead>
                <TableHead>Candidate / worker</TableHead>
                <TableHead>Job title</TableHead>
                <TableHead>SOC</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Approval progress</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((c) => {
                const done = c.approvals.filter((a) => a.decision === "approved").length;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/cos/${c.id}`} className="text-elms-teal hover:underline">{c.cosNumber ?? "(draft)"}</Link>
                    </TableCell>
                    <TableCell className="font-medium text-elms-navy">{c.candidateName ?? c.worker?.legalName ?? "—"}</TableCell>
                    <TableCell>{c.jobTitle}</TableCell>
                    <TableCell className="font-mono text-xs">{c.socCode}</TableCell>
                    <TableCell>£{c.salary.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <span key={n} className={`h-2 w-5 rounded-sm ${n <= done ? "bg-elms-success" : "bg-elms-grey"}`} />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">{done}/5</span>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
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
