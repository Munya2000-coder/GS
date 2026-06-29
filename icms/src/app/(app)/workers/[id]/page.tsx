import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { computeWorkerScore } from "@/lib/compliance-score";
import { fmtDate, daysUntil, expiryRag } from "@/lib/dates";
import { eventTypeLabel } from "@/lib/sms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RagBadge } from "@/components/rag-badge";
import { pageGuard } from "@/components/forbidden";

export const dynamic = "force-dynamic";

const docStatusVariant: Record<string, "green" | "amber" | "red" | "outline"> = {
  Approved: "green",
  "Uploaded (pending review)": "amber",
  Required: "outline",
  Missing: "red",
  Expired: "red",
  Rejected: "red",
  "Not Applicable": "outline",
};

export default async function WorkerDetailPage({ params }: { params: { id: string } }) {
  const guard = await pageGuard("worker.view");
  if (guard) return guard;

  const worker = await prisma.worker.findUnique({
    where: { id: params.id },
    include: {
      visas: { orderBy: { expiryDate: "desc" } },
      rtwChecks: { orderBy: { checkDate: "desc" } },
      cosRecords: { orderBy: { createdAt: "desc" } },
      appendixD: { orderBy: { label: "asc" } },
      reportableEvents: { orderBy: { reportingDeadline: "asc" } },
      payrollRecords: { orderBy: { payPeriod: "desc" } },
    },
  });
  if (!worker) notFound();

  const breakdown = await computeWorkerScore(worker.id);
  const visa = worker.visas[0];
  const rtw = worker.rtwChecks[0];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-elms-navy">{worker.legalName}</h2>
            <RagBadge status={worker.ragStatus} />
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {worker.wcid} · {worker.jobTitle} · SOC {worker.socCode} · {worker.workLocation}
          </p>
        </div>
        <Link href="/workers" className="text-sm text-elms-teal hover:underline">← All workers</Link>
      </div>

      {/* Compliance score breakdown (Module 14) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Compliance score</span>
            <span className="font-mono text-2xl">{breakdown.score}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {breakdown.critical && (
            <div className="mb-3 rounded-md bg-elms-alert/10 p-3 text-sm font-medium text-elms-alert">
              ⚠ Critical: illegal-working risk or expired visa — immediate escalation to Authorising Officer (ICMS-068).
            </div>
          )}
          <div className="space-y-2">
            {breakdown.factors.map((f) => (
              <div key={f.key} className="flex items-center gap-3">
                <div className="w-44 text-sm text-elms-navy">{f.label}</div>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-elms-grey">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(f.earned / f.weight) * 100}%`,
                      backgroundColor: f.earned >= f.weight ? "#10B981" : f.earned > 0 ? "#F59E0B" : "#EF4444",
                    }}
                  />
                </div>
                <div className="w-12 text-right font-mono text-xs">{Math.round(f.earned)}/{f.weight}</div>
                <div className="w-64 truncate text-xs text-muted-foreground" title={f.note}>{f.note}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Master record */}
        <Card>
          <CardHeader><CardTitle>Master record (Module 5)</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Field label="Nationality" value={worker.nationality} />
            <Field label="Date of birth" value={fmtDate(worker.dateOfBirth)} />
            <Field label="Passport" value={worker.passportNumber} mono />
            <Field label="Passport expiry" value={fmtDate(worker.passportExpiry)} />
            <Field label="NI number" value={worker.niNumber} mono />
            <Field label="Email" value={worker.email} />
            <Field label="Contracted hours" value={worker.contractedHours ? `${worker.contractedHours}/wk` : null} />
            <Field label="Salary" value={worker.salary ? `£${worker.salary.toLocaleString()}` : null} />
            <Field label="Hourly rate" value={worker.hourlyRate ? `£${worker.hourlyRate}` : null} />
            <Field label="Line manager" value={worker.lineManager} />
            <Field label="Employment start" value={fmtDate(worker.employmentStart)} />
            <Field label="Sponsorship status" value={worker.sponsorshipStatus} />
          </CardContent>
        </Card>

        {/* Immigration */}
        <Card>
          <CardHeader><CardTitle>Immigration &amp; right to work (Modules 6 &amp; 25)</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="mb-1 font-medium text-elms-navy">Visa</div>
              {visa ? (
                <div className="flex items-center justify-between">
                  <span>{visa.route} · expires {fmtDate(visa.expiryDate)}</span>
                  <RagBadge status={expiryRag(daysUntil(visa.expiryDate))} />
                </div>
              ) : <span className="text-muted-foreground">No visa record</span>}
            </div>
            <div className="rounded-md border p-3">
              <div className="mb-1 font-medium text-elms-navy">Right to work</div>
              {rtw ? (
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs">Share code {rtw.shareCode} · repeat {fmtDate(rtw.repeatCheckDate)}</span>
                  <Badge variant={rtw.status === "Valid" ? "green" : "red"}>{rtw.status}</Badge>
                </div>
              ) : <span className="text-muted-foreground">No RTW check</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Appendix D checklist (Module 12) */}
      <Card>
        <CardHeader><CardTitle>Appendix D document checklist (Module 12)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {worker.appendixD.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-elms-navy">{item.label}</TableCell>
                  <TableCell>{item.required ? "Yes" : "—"}</TableCell>
                  <TableCell>{fmtDate(item.expiryDate)}</TableCell>
                  <TableCell><Badge variant={docStatusVariant[item.status] ?? "outline"}>{item.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* CoS + SMS */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Certificates of Sponsorship (Module 7)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {worker.cosRecords.length === 0 ? <p className="text-muted-foreground">No CoS records.</p> :
              worker.cosRecords.map((c) => (
                <Link key={c.id} href={`/cos/${c.id}`} className="flex items-center justify-between rounded-md border p-2.5 hover:bg-secondary">
                  <span className="font-mono text-xs">{c.cosNumber ?? "(draft)"} · {c.jobTitle}</span>
                  <Badge variant="default">{c.status}</Badge>
                </Link>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>SMS reportable events (Module 11)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {worker.reportableEvents.length === 0 ? <p className="text-muted-foreground">No reportable events.</p> :
              worker.reportableEvents.map((e) => {
                const d = daysUntil(e.reportingDeadline);
                return (
                  <Link key={e.id} href="/sms-reporting" className="flex items-center justify-between rounded-md border p-2.5 hover:bg-secondary">
                    <span>{eventTypeLabel(e.eventType)} · due {fmtDate(e.reportingDeadline)}</span>
                    <Badge variant={e.status === "Closed" ? "green" : d !== null && d < 0 ? "critical" : "amber"}>
                      {e.status === "Closed" ? "Closed" : d !== null && d < 0 ? `${Math.abs(d)}d overdue` : e.status}
                    </Badge>
                  </Link>
                );
              })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm" : "text-sm"}>{value || "—"}</div>
    </div>
  );
}
