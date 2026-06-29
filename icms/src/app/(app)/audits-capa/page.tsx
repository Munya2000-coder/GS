import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";

export const dynamic = "force-dynamic";

const catVariant = (c: string): "critical" | "red" | "amber" | "green" =>
  c === "Critical" ? "critical" : c === "Major" ? "red" : c === "Minor" ? "amber" : "green";

// Internal audit findings + CAPA management (PRD Modules 16 & 17).
export default async function AuditsCapaPage() {
  const [findings, capas] = await Promise.all([
    prisma.auditFinding.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.capa.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-5">
      <PageIntro title="Audits & CAPA" subtitle="Audit findings and corrective/preventive action management (Modules 16 & 17)" />

      <Card>
        <CardHeader><CardTitle>Audit findings</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {findings.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-mono text-xs">{f.reference}</TableCell>
                  <TableCell><Badge variant={catVariant(f.category)}>{f.category}</Badge></TableCell>
                  <TableCell className="text-sm">{f.description}</TableCell>
                  <TableCell>{f.owner ?? "—"}</TableCell>
                  <TableCell>{fmtDate(f.dueDate)}</TableCell>
                  <TableCell><Badge variant={f.status === "Closed" ? "green" : "amber"}>{f.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>CAPA register</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Corrective action</TableHead>
                <TableHead>Preventive action</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {capas.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.reference}</TableCell>
                  <TableCell className="text-sm">{c.correctiveAction}</TableCell>
                  <TableCell className="text-sm">{c.preventiveAction}</TableCell>
                  <TableCell>{c.owner ?? "—"}</TableCell>
                  <TableCell>{fmtDate(c.dueDate)}</TableCell>
                  <TableCell><Badge variant={c.status === "Closed" ? "green" : "amber"}>{c.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        CAPAs cannot be closed without uploaded evidence and Compliance Manager approval (ICMS-076). Overdue CAPAs
        escalate to the AO at 3, 7, and 14 days past due (ICMS-077). Interactive closure workflow arrives in the next phase.
      </p>
    </div>
  );
}
