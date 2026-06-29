import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";

export const dynamic = "force-dynamic";

// Documents & Appendix D overview (PRD Modules 12 & 13).
export default async function DocumentsPage() {
  const guard = await pageGuard("document.view");
  if (guard) return guard;

  const [missing, recentDocs, summary] = await Promise.all([
    prisma.appendixDItem.findMany({
      where: { required: true, status: { in: ["Missing", "Expired"] } },
      include: { worker: true },
      orderBy: { status: "asc" },
    }),
    prisma.document.findMany({ include: { worker: true }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.appendixDItem.groupBy({ by: ["status"], _count: true }),
  ]);

  return (
    <div className="space-y-5">
      <PageIntro
        title="Documents"
        subtitle="Appendix D checklists, version-controlled uploads, and tamper-evident control (Modules 12 & 13)"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {summary.map((s) => (
          <Card key={s.status}>
            <CardContent className="py-4">
              <div className="text-2xl font-bold text-elms-navy">{s._count}</div>
              <div className="text-xs text-muted-foreground">{s.status}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Required documents missing or expired ({missing.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {missing.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">No outstanding required documents.</TableCell></TableRow>
              ) : missing.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium text-elms-navy">
                    <Link href={`/workers/${m.workerId}`} className="hover:underline">{m.worker?.legalName}</Link>
                  </TableCell>
                  <TableCell>{m.label}</TableCell>
                  <TableCell>{fmtDate(m.expiryDate)}</TableCell>
                  <TableCell><Badge variant="red">{m.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recently uploaded documents</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Uploaded by</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentDocs.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-elms-navy">{d.worker?.legalName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{d.fileName}</TableCell>
                  <TableCell>{d.category}</TableCell>
                  <TableCell>v{d.version}</TableCell>
                  <TableCell>{d.uploadedBy}</TableCell>
                  <TableCell><Badge variant={d.status === "Approved" ? "green" : "amber"}>{d.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Uploads enforce a 25 MB limit and an allow-list (PDF, DOCX, XLSX, JPG, PNG, HEIC) with virus scanning
        before acceptance. Compliance-critical documents cannot be deleted by standard users — deletion requires
        System Administrator approval with an audit-trail entry (ICMS-064).
      </p>
    </div>
  );
}
