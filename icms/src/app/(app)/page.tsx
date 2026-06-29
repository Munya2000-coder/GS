import Link from "next/link";
import { AlertTriangle, FileWarning, ShieldAlert, Clock, Users, FileCheck2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { fmtDate, daysUntil } from "@/lib/dates";
import { eventTypeLabel } from "@/lib/sms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RagBadge } from "@/components/rag-badge";
import { PageIntro } from "@/components/page-header";

export const dynamic = "force-dynamic";

// Executive compliance dashboard (PRD Module 15 / ICMS-069).
export default async function DashboardPage() {
  const [licence, workers, openCos, rtwSoon, docsMissing, payrollExc, smsOpen] = await Promise.all([
    prisma.sponsorLicence.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.worker.findMany({ orderBy: { complianceScore: "asc" } }),
    prisma.cos.count({ where: { status: { in: ["Draft", "Pending Approval"] } } }),
    prisma.rightToWorkCheck.findMany({ where: { repeatCheckDate: { not: null } } }),
    prisma.appendixDItem.count({ where: { required: true, status: { in: ["Missing", "Expired"] } } }),
    prisma.payrollRecord.count({ where: { exception: { not: null }, resolved: false } }),
    prisma.reportableEvent.findMany({ where: { status: { not: "Closed" } }, include: { worker: true } }),
  ]);

  const byRag = (rag: string) => workers.filter((w) => w.ragStatus === rag).length;
  const critical = workers.filter((w) => w.ragStatus === "Critical");
  const licenceDays = daysUntil(licence?.expiryDate);
  const smsOverdue = smsOpen.filter((e) => (daysUntil(e.reportingDeadline) ?? 0) < 0);

  return (
    <div>
      <PageIntro
        title="Compliance Dashboard"
        subtitle="Sponsor licence compliance status at a glance (PRD Module 15)"
      />

      {/* Licence banner */}
      <Card className="mb-5 border-l-4 border-l-elms-teal">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Sponsor Licence</div>
            <div className="font-mono text-lg font-semibold text-elms-navy">{licence?.licenceNumber ?? "—"}</div>
            <div className="text-sm text-muted-foreground">{licence?.route} · Rating {licence?.rating}</div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Licence expiry</div>
            <div className="font-semibold text-elms-navy">{fmtDate(licence?.expiryDate)}</div>
            <Badge variant={licenceDays !== null && licenceDays < 90 ? "amber" : "green"}>
              {licenceDays} days remaining
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* RAG summary cards */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <RagCard label="Green — compliant" count={byRag("Green")} variant="green" />
        <RagCard label="Amber — action required" count={byRag("Amber")} variant="amber" />
        <RagCard label="Red — significant risk" count={byRag("Red")} variant="red" />
        <RagCard label="Critical — escalate" count={byRag("Critical")} variant="critical" />
      </div>

      {/* Metric tiles */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Metric icon={Users} label="Sponsored workers" value={workers.length} href="/workers" />
        <Metric icon={FileCheck2} label="CoS in progress" value={openCos} href="/cos" />
        <Metric icon={ShieldAlert} label="RTW checks tracked" value={rtwSoon.length} href="/right-to-work" />
        <Metric icon={FileWarning} label="Docs missing/expired" value={docsMissing} href="/documents" tone={docsMissing ? "warn" : undefined} />
        <Metric icon={AlertTriangle} label="Payroll exceptions" value={payrollExc} href="/payroll-rota" tone={payrollExc ? "warn" : undefined} />
        <Metric icon={Clock} label="SMS events open" value={smsOpen.length} href="/sms-reporting" tone={smsOverdue.length ? "alert" : undefined} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Critical / high-risk workers */}
        <Card>
          <CardHeader><CardTitle>High-risk &amp; critical workers</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {critical.length === 0 && workers.filter((w) => w.ragStatus === "Red").length === 0 ? (
              <p className="text-sm text-muted-foreground">No high-risk workers. 🎉</p>
            ) : (
              [...critical, ...workers.filter((w) => w.ragStatus === "Red")].map((w) => (
                <Link key={w.id} href={`/workers/${w.id}`} className="flex items-center justify-between rounded-md border p-2.5 hover:bg-secondary">
                  <div>
                    <div className="font-medium text-elms-navy">{w.legalName}</div>
                    <div className="font-mono text-xs text-muted-foreground">{w.wcid} · {w.jobTitle}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{w.complianceScore}%</span>
                    <RagBadge status={w.ragStatus} />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Upcoming deadlines: visa expiries + SMS */}
        <Card>
          <CardHeader><CardTitle>Upcoming compliance deadlines</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {smsOpen.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open reportable events.</p>
            ) : (
              smsOpen
                .sort((a, b) => +new Date(a.reportingDeadline) - +new Date(b.reportingDeadline))
                .map((e) => {
                  const d = daysUntil(e.reportingDeadline);
                  return (
                    <Link key={e.id} href="/sms-reporting" className="flex items-center justify-between rounded-md border p-2.5 hover:bg-secondary">
                      <div>
                        <div className="font-medium text-elms-navy">{eventTypeLabel(e.eventType)}</div>
                        <div className="text-xs text-muted-foreground">{e.worker?.legalName ?? "—"} · due {fmtDate(e.reportingDeadline)}</div>
                      </div>
                      <Badge variant={d !== null && d < 0 ? "critical" : d !== null && d <= 3 ? "red" : "amber"}>
                        {d !== null && d < 0 ? `${Math.abs(d)}d overdue` : `${d}d left`}
                      </Badge>
                    </Link>
                  );
                })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RagCard({ label, count, variant }: { label: string; count: number; variant: "green" | "amber" | "red" | "critical" }) {
  const ring = { green: "border-l-elms-success", amber: "border-l-elms-warning", red: "border-l-elms-alert", critical: "border-l-elms-alert" }[variant];
  return (
    <Card className={`border-l-4 ${ring}`}>
      <CardContent className="py-4">
        <div className="text-3xl font-bold text-elms-navy">{count}</div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ icon: Icon, label, value, href, tone }: {
  icon: any; label: string; value: number; href: string; tone?: "warn" | "alert";
}) {
  const color = tone === "alert" ? "text-elms-alert" : tone === "warn" ? "text-[#B45309]" : "text-elms-teal";
  return (
    <Link href={href}>
      <Card className="transition-colors hover:border-elms-teal">
        <CardContent className="py-4">
          <Icon className={`h-5 w-5 ${color}`} />
          <div className="mt-2 text-2xl font-bold text-elms-navy">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </CardContent>
      </Card>
    </Link>
  );
}
