import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PageIntro } from "@/components/page-header";

export const dynamic = "force-dynamic";

// Sponsor licence governance (PRD Module 1).
export default async function GovernancePage() {
  const licence = await prisma.sponsorLicence.findFirst({
    include: { organisation: true, smsUsers: { orderBy: { level: "asc" } } },
  });
  if (!licence) return <p className="text-muted-foreground">No sponsor licence configured.</p>;

  const sites: { name: string; postcode: string }[] = licence.organisation.sites
    ? JSON.parse(licence.organisation.sites)
    : [];

  return (
    <div className="space-y-5">
      <PageIntro title="Governance" subtitle="Sponsor licence record, SMS users, and AO/KC management (Module 1)" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Sponsor licence</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Licence number" value={licence.licenceNumber} mono />
            <Row label="Rating" value={licence.rating} />
            <Row label="Type / route" value={`${licence.licenceType} · ${licence.route}`} />
            <Row label="Expiry" value={fmtDate(licence.expiryDate)} />
            <Row label="Renewal deadline" value={fmtDate(licence.renewalDeadline)} />
            <Row label="Authorising Officer" value={licence.authorisingOfficer ?? "—"} />
            <Row label="Key Contact" value={licence.keyContact ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Organisation</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Legal name" value={licence.organisation.legalName} />
            <Row label="Companies House" value={licence.organisation.companiesHouseNo ?? "—"} mono />
            <Row label="CQC provider ID" value={licence.organisation.cqcProviderId ?? "—"} mono />
            <Row label="CQC rating" value={licence.organisation.cqcRating ?? "—"} />
            <div>
              <div className="mb-1 text-muted-foreground">Sites</div>
              {sites.map((s) => (
                <Badge key={s.name} variant="default" className="mr-1">{s.name} · {s.postcode}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>SMS users · quarterly access review (ICMS-002,003)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Added</TableHead>
                <TableHead>Last reviewed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {licence.smsUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-elms-navy">{u.name}</TableCell>
                  <TableCell>{u.level}</TableCell>
                  <TableCell className="text-xs">{u.email}</TableCell>
                  <TableCell>{fmtDate(u.dateAdded)}</TableCell>
                  <TableCell>{fmtDate(u.lastReviewedAt)}</TableCell>
                  <TableCell><Badge variant={u.isLeaver ? "red" : "green"}>{u.isLeaver ? "Remove access" : "Active"}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
