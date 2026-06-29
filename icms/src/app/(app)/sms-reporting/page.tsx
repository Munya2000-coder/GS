import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { fmtDate, daysUntil } from "@/lib/dates";
import { eventTypeLabel, SMS_STATUSES } from "@/lib/sms";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { advanceReportableEvent } from "./actions";

export const dynamic = "force-dynamic";

// SMS reporting workflow (PRD Module 11).
export default async function SmsReportingPage() {
  const guard = await pageGuard("sms.view");
  if (guard) return guard;

  const [events, user] = await Promise.all([
    prisma.reportableEvent.findMany({ include: { worker: true }, orderBy: { reportingDeadline: "asc" } }),
    getCurrentUser(),
  ]);
  const canManage = !!user?.permissions.has("sms.manage");

  const open = events.filter((e) => e.status !== "Closed");
  const overdue = open.filter((e) => (daysUntil(e.reportingDeadline) ?? 0) < 0);

  return (
    <div className="space-y-5">
      <PageIntro
        title="SMS Reporting"
        subtitle="Reportable event register, deadline tracking, and AO escalation (Module 11)"
      />

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Open events" value={open.length} />
        <Stat label="Overdue" value={overdue.length} tone={overdue.length ? "alert" : undefined} />
        <Stat label="Closed" value={events.length - open.length} tone="ok" />
      </div>

      <Card>
        <CardHeader><CardTitle>Reportable events</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 && <p className="text-sm text-muted-foreground">No reportable events.</p>}
          {events.map((e) => {
            const d = daysUntil(e.reportingDeadline);
            const stageIdx = SMS_STATUSES.indexOf(e.status as (typeof SMS_STATUSES)[number]);
            const overdueFlag = e.status !== "Closed" && d !== null && d < 0;
            return (
              <div key={e.id} className={`rounded-md border p-3 ${overdueFlag ? "border-elms-alert" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium text-elms-navy">{eventTypeLabel(e.eventType)}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.worker ? <Link href={`/workers/${e.workerId}`} className="hover:underline">{e.worker.legalName}</Link> : "—"}
                      {" · "}event {fmtDate(e.eventDate)} · deadline {fmtDate(e.reportingDeadline)}
                      {e.smsReference ? ` · ref ${e.smsReference}` : ""}
                      {e.autoCreated ? " · auto-created" : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {e.status === "Closed" ? <Badge variant="green">Closed</Badge>
                      : overdueFlag ? <Badge variant="critical">{Math.abs(d!)}d overdue</Badge>
                      : <Badge variant={d !== null && d <= 3 ? "red" : "amber"}>{d}d left</Badge>}
                  </div>
                </div>

                {/* Lifecycle stepper */}
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {SMS_STATUSES.map((s, i) => (
                    <span key={s} className={`rounded px-2 py-0.5 text-[10px] ${i <= stageIdx ? "bg-elms-teal text-white" : "bg-elms-grey text-muted-foreground"}`}>
                      {s}
                    </span>
                  ))}
                </div>

                {/* Advance action */}
                {canManage && e.status !== "Closed" && (
                  <form action={advanceReportableEvent} className="mt-3 flex items-end gap-2 border-t pt-3">
                    <input type="hidden" name="eventId" value={e.id} />
                    <div className="flex-1 max-w-xs">
                      <label className="text-xs text-muted-foreground">SMS reference (required to submit/close)</label>
                      <Input name="smsReference" defaultValue={e.smsReference ?? ""} placeholder="e.g. SMS-2026-00123" />
                    </div>
                    <Button type="submit" size="sm">
                      Advance to “{SMS_STATUSES[stageIdx + 1]}”
                    </Button>
                  </form>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "alert" | "ok" }) {
  const color = tone === "alert" ? "text-elms-alert" : tone === "ok" ? "text-elms-success" : "text-elms-navy";
  return (
    <Card><CardContent className="py-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </CardContent></Card>
  );
}
