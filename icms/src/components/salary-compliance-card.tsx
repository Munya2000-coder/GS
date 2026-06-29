import { checkSalaryCompliance } from "@/lib/salary-compliance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/** Salary & hours compliance panel for a CoS (PRD Module 8). */
export async function SalaryComplianceCard({ socCode, salary, contractedHours }: {
  socCode: string; salary: number; contractedHours: number;
}) {
  const result = await checkSalaryCompliance({ socCode, salary, contractedHours });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Salary compliance (Module 8)</span>
          <Badge variant={result.blocking ? "critical" : result.pass ? "green" : "amber"}>
            {result.blocking ? "Below threshold" : result.pass ? "Compliant" : "Review"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {result.checks.map((c) => (
          <div key={c.label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{c.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">
                {c.actual.toLocaleString()} {c.unit} / req {c.required.toLocaleString()}
              </span>
              <Badge variant={c.pass ? "green" : "red"}>{c.pass ? "✓" : "✗"}</Badge>
            </span>
          </div>
        ))}
        {result.blocking && (
          <p className="rounded bg-elms-alert/10 p-2 text-xs text-elms-alert">
            Finance approval is blocked while a mandatory floor (immigration threshold / NMW) is breached (ICMS-035).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
