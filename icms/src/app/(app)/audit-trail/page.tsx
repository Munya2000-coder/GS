import { prisma } from "@/lib/db";
import { fmtDateTime } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";

export const dynamic = "force-dynamic";

// Tamper-evident audit trail viewer (PRD Module 20 / ICMS-085..087).
export default async function AuditTrailPage() {
  const guard = await pageGuard("audittrail.view");
  if (guard) return guard;

  const entries = await prisma.auditTrail.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div>
      <PageIntro
        title="Audit Trail"
        subtitle="Complete, append-only record of system actions — non-editable, exportable for inspection (Module 20)"
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>New value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-muted-foreground">No audit entries yet.</TableCell></TableRow>
              ) : entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap font-mono text-xs">{fmtDateTime(e.createdAt)}</TableCell>
                  <TableCell>{e.actorName}</TableCell>
                  <TableCell><Badge variant="navy" className="font-mono text-[10px]">{e.action}</Badge></TableCell>
                  <TableCell className="text-xs">{e.entityType}</TableCell>
                  <TableCell className="text-sm">{e.summary}</TableCell>
                  <TableCell className="text-xs">{e.newValue ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">
        Audit records cannot be edited or deleted by any user, including System Administrators (ICMS-086).
        In production on PostgreSQL this is reinforced with an append-only table grant / row-level-security policy.
      </p>
    </div>
  );
}
