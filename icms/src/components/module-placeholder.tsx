import { Construction } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageIntro } from "@/components/page-header";

/**
 * Placeholder for modules scaffolded but not built in the vertical-slice MVP.
 * Lists the PRD requirements the module will satisfy so scope is explicit.
 */
export function ModulePlaceholder({
  title, subtitle, requirements,
}: { title: string; subtitle: string; requirements: { id: string; text: string }[] }) {
  return (
    <div>
      <PageIntro title={title} subtitle={subtitle} />
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-5 w-5 text-elms-warning" />
            Planned module — not in the current MVP slice
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            The data model and navigation for this module are in place. The interactive workflows below are
            scheduled for the next build phase.
          </p>
          <ul className="space-y-2">
            {requirements.map((r) => (
              <li key={r.id} className="flex gap-3 text-sm">
                <span className="font-mono text-xs text-elms-teal">{r.id}</span>
                <span className="text-elms-navy">{r.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
