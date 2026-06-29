import { prisma } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/field";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { EmptyState } from "@/components/empty-state";
import { submitSelfServiceRequest, reviewSelfServiceRequest } from "./actions";

export const dynamic = "force-dynamic";

const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: "address", label: "Address" },
  { value: "phone", label: "Phone" },
  { value: "passport", label: "Passport" },
  { value: "share_code", label: "Share code" },
  { value: "absence", label: "Absence" },
  { value: "emergency_contact", label: "Emergency contact" },
];

function statusVariant(status: string): "amber" | "green" | "red" | "outline" {
  if (status === "Approved") return "green";
  if (status === "Rejected") return "red";
  if (status === "Pending") return "amber";
  return "outline";
}

// Worker self-service portal (PRD Module 22).
export default async function PortalPage() {
  const guard = await pageGuard("selfservice.review");
  if (guard) return guard;

  const [workers, requests] = await Promise.all([
    prisma.worker.findMany({ orderBy: { legalName: "asc" } }),
    prisma.selfServiceRequest.findMany({ orderBy: { submittedAt: "desc" } }),
  ]);

  return (
    <div className="space-y-5">
      <PageIntro
        title="Worker Self-Service"
        subtitle="Worker-submitted updates held in a pending queue for HR/Compliance approval (Module 22)"
      />

      <Card>
        <CardHeader><CardTitle>Submit an update (ICMS-091)</CardTitle></CardHeader>
        <CardContent>
          <form action={submitSelfServiceRequest} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="workerId">Worker</Label>
              <Select id="workerId" name="workerId" required defaultValue="">
                <option value="" disabled>Select worker…</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>{w.legalName}</option>
                ))}
              </Select>
            </div>
            <div className="min-w-[160px]">
              <Label htmlFor="field">Field</Label>
              <Select id="field" name="field" required defaultValue="address">
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </Select>
            </div>
            <div className="min-w-[200px] flex-1">
              <Label htmlFor="newValue">New value</Label>
              <Input id="newValue" name="newValue" required placeholder="Updated value" />
            </div>
            <Button type="submit" variant="navy">Submit update</Button>
          </form>
          <p className="mt-3 text-xs text-muted-foreground">
            All worker-submitted changes require HR or Compliance Manager approval before they are applied to the
            master record (ICMS-092).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Approval queue</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState
              title="No pending requests"
              message="Worker-submitted change requests will appear here for review and approval."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Worker</TableHead>
                  <TableHead>Field</TableHead>
                  <TableHead>Old → New</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-elms-navy">{r.workerName}</TableCell>
                    <TableCell className="text-sm">{r.field}</TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">{r.oldValue ?? "—"}</span>
                      {" → "}
                      <span className="font-medium text-elms-navy">{r.newValue}</span>
                    </TableCell>
                    <TableCell className="text-sm">{fmtDate(r.submittedAt)}</TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)}>{r.status}</Badge></TableCell>
                    <TableCell>
                      {r.status === "Pending" ? (
                        <div className="flex items-center gap-2">
                          <form action={reviewSelfServiceRequest}>
                            <input type="hidden" name="requestId" value={r.id} />
                            <input type="hidden" name="decision" value="approve" />
                            <Button type="submit" size="sm" variant="navy">Approve</Button>
                          </form>
                          <form action={reviewSelfServiceRequest}>
                            <input type="hidden" name="requestId" value={r.id} />
                            <input type="hidden" name="decision" value="reject" />
                            <Button type="submit" size="sm" variant="destructive">Reject</Button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {r.reviewedBy ? `by ${r.reviewedBy}` : "—"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
