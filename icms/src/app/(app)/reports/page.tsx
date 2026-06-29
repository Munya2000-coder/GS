import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { REPORTS } from "./reports";

export const dynamic = "force-dynamic";

// Reports — CSV + printable-PDF exports (PRD Module 31).
export default async function ReportsPage() {
  const guard = await pageGuard("reports.view");
  if (guard) return guard;

  return (
    <div className="space-y-5">
      <PageIntro
        title="Reports"
        subtitle="Compliance reports with CSV and printable-PDF export (Module 31)"
      />

      <p className="text-sm text-muted-foreground">
        Reports respect your role-based access scope and include generation metadata
        (generated date and user) on the printable view (ICMS-107).
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Card key={r.key}>
            <CardHeader><CardTitle>{r.title}</CardTitle></CardHeader>
            <CardContent className="flex h-full flex-col justify-between gap-3">
              <p className="text-sm text-muted-foreground">{r.description}</p>
              <div className="flex items-center gap-3 text-sm">
                <a
                  href={"/reports/export?type=" + r.key}
                  className="font-medium text-elms-teal hover:underline"
                >
                  CSV
                </a>
                <span className="text-muted-foreground">·</span>
                <a
                  href={"/reports/view/" + r.key}
                  target="_blank"
                  className="font-medium text-elms-teal hover:underline"
                >
                  Print / PDF
                </a>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
