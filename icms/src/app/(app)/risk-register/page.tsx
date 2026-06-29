import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";

export const dynamic = "force-dynamic";

const impactVariant = (s?: string | null): "red" | "amber" | "green" =>
  s === "Critical" || s === "High" ? "red" : s === "Medium" ? "amber" : "green";

// Compliance risk register (PRD Module 1 / §16).
export default async function RiskRegisterPage() {
  const risks = await prisma.riskRegisterEntry.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div>
      <PageIntro title="Risk Register" subtitle="Compliance risks, mitigations, and owners (Module 1 & §16)" />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Likelihood</TableHead>
                <TableHead>Impact</TableHead>
                <TableHead>Mitigation</TableHead>
                <TableHead>Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-elms-navy">{r.description}</TableCell>
                  <TableCell>{r.owner ?? "—"}</TableCell>
                  <TableCell><Badge variant={impactVariant(r.likelihood)}>{r.likelihood}</Badge></TableCell>
                  <TableCell><Badge variant={impactVariant(r.impact)}>{r.impact}</Badge></TableCell>
                  <TableCell className="text-xs">{r.mitigation}</TableCell>
                  <TableCell>{fmtDate(r.reviewDate)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
