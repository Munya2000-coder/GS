import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, XCircle, RotateCcw, Lock } from "lucide-react";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { COS_STAGES } from "@/lib/rbac";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/field";
import { PageIntro } from "@/components/page-header";
import { SalaryComplianceCard } from "@/components/salary-compliance-card";
import { actionCosStage } from "../actions";

export const dynamic = "force-dynamic";

export default async function CosDetailPage({ params }: { params: { id: string } }) {
  const cos = await prisma.cos.findUnique({
    where: { id: params.id },
    include: {
      approvals: { orderBy: { stage: "asc" } },
      worker: { include: { appendixD: true } },
      genuineVacancy: true,
    },
  });
  if (!cos) notFound();

  const user = await getCurrentUser();
  const current = cos.approvals.find((a) => !a.decision);
  const stageDef = current ? COS_STAGES.find((s) => s.stage === current.stage) : null;
  const canActionCurrent = !!(stageDef && user?.permissions.has(stageDef.permission));

  // Evidence gate preview (ICMS-012) for the AO stage.
  const missingEvidence = (cos.worker?.appendixD ?? []).filter(
    (d) => d.required && (d.status === "Missing" || d.status === "Expired"),
  );
  const isSubmitterConflict = current?.stage === 5 && cos.submittedById === user?.id;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <PageIntro
            title={`CoS ${cos.cosNumber ?? "(draft)"}`}
            subtitle={`${cos.candidateName ?? cos.worker?.legalName ?? ""} · ${cos.jobTitle} · SOC ${cos.socCode}`}
          />
        </div>
        <Link href="/cos" className="text-sm text-elms-teal hover:underline">← CoS register</Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Approval workflow stepper */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Approval workflow (5 stages)</span>
              <Badge variant={cos.status === "Approved" ? "green" : cos.status === "Rejected" ? "red" : "amber"}>{cos.status}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cos.approvals.map((a) => {
              const isCurrent = current?.id === a.id;
              return (
                <div key={a.id} className={`rounded-md border p-3 ${isCurrent ? "border-elms-teal bg-elms-teal-light/30" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {a.decision === "approved" ? <CheckCircle2 className="h-5 w-5 text-elms-success" />
                        : a.decision === "rejected" ? <XCircle className="h-5 w-5 text-elms-alert" />
                        : a.decision === "returned" ? <RotateCcw className="h-5 w-5 text-elms-warning" />
                        : isCurrent ? <Circle className="h-5 w-5 text-elms-teal" />
                        : <Lock className="h-4 w-4 text-elms-grey-mid" />}
                      <div>
                        <div className="font-medium text-elms-navy">Stage {a.stage}: {a.stageName}</div>
                        {a.decision ? (
                          <div className="text-xs text-muted-foreground">
                            {a.decision} by {a.approverName} ({a.approverRole}) · {fmtDateTime(a.decidedAt)}
                            {a.comments ? ` · "${a.comments}"` : ""}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">{isCurrent ? "Awaiting decision" : "Locked until prior stages complete"}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action form for the current stage */}
                  {isCurrent && (
                    <div className="mt-3 border-t pt-3">
                      {!user ? null : !canActionCurrent ? (
                        <p className="text-xs text-elms-alert">Your role cannot action this stage. Required: {stageDef?.name}.</p>
                      ) : isSubmitterConflict ? (
                        <p className="text-xs text-elms-alert">
                          You submitted this request and cannot also grant final approval (separation of duties, ICMS-011).
                        </p>
                      ) : (
                        <form action={actionCosStage} className="space-y-2">
                          <input type="hidden" name="cosId" value={cos.id} />
                          {a.stage === 5 && missingEvidence.length > 0 && (
                            <p className="rounded bg-elms-alert/10 p-2 text-xs text-elms-alert">
                              {missingEvidence.length} mandatory Appendix D document(s) missing/expired — approval is blocked (ICMS-012).
                            </p>
                          )}
                          <div>
                            <Label htmlFor="comments" className="text-xs">Decision comments</Label>
                            <Textarea id="comments" name="comments" rows={2} placeholder="Rationale for this decision…" />
                          </div>
                          <div className="flex gap-2">
                            <Button type="submit" name="decision" value="approved"
                              disabled={a.stage === 5 && missingEvidence.length > 0}>Approve</Button>
                            <Button type="submit" name="decision" value="returned" variant="outline">Return</Button>
                            <Button type="submit" name="decision" value="rejected" variant="destructive">Reject</Button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* CoS details + evidence */}
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Request details</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Work location" value={cos.workLocation} />
              <Row label="Contracted hours" value={`${cos.contractedHours}/wk`} />
              <Row label="Salary" value={`£${cos.salary.toLocaleString()}`} />
              <Row label="Hourly rate" value={cos.hourlyRate ? `£${cos.hourlyRate}` : "—"} />
              <Row label="Proposed start" value={fmtDate(cos.proposedStart)} />
              <Row label="Funding source" value={cos.fundingSource ?? "—"} />
              <Row label="SMS reference" value={cos.smsReference ?? "—"} mono />
            </CardContent>
          </Card>
          <SalaryComplianceCard socCode={cos.socCode} salary={cos.salary} contractedHours={cos.contractedHours} />
          <Card>
            <CardHeader><CardTitle>Genuine vacancy (Module 3)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {cos.genuineVacancy ? (
                <>
                  <Row label="Care service" value={cos.genuineVacancy.careService ?? "—"} />
                  <Row label="Hours commissioned" value={String(cos.genuineVacancy.hoursCommissioned ?? "—")} />
                  <Row label="Staffing gap" value={String(cos.genuineVacancy.staffingGap ?? "—")} />
                  <Row label="Evidence complete" value={cos.genuineVacancy.evidenceComplete ? "Yes" : "No"} />
                </>
              ) : <p className="text-muted-foreground">No genuine-vacancy record.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
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
