import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { PageIntro } from "@/components/page-header";
import { pageGuard } from "@/components/forbidden";
import { CONFIG_GROUPS, getConfig } from "@/lib/config";
import { saveConfig } from "./actions";

export const dynamic = "force-dynamic";

// System configuration (PRD §17) — approval-gated, audit-trailed.
export default async function SettingsPage() {
  const guard = await pageGuard("config.manage");
  if (guard) return guard;

  // Resolve current values for every field up-front.
  const groups = await Promise.all(
    CONFIG_GROUPS.map(async (group) => ({
      group,
      fields: await Promise.all(
        group.fields.map(async (field) => ({
          field,
          current: await getConfig(group.category, field.key, field.default),
        })),
      ),
    })),
  );

  return (
    <div className="space-y-5">
      <PageIntro
        title="Settings"
        subtitle="System configuration — all changes require approval and are audit-trailed (§17)"
      />

      <p className="text-sm text-muted-foreground">
        Settings are restricted to System Administrators (config.manage). Every change is recorded
        in the audit trail.
      </p>

      <div className="grid gap-5">
        {groups.map(({ group, fields }) => (
          <Card key={group.category}>
            <CardHeader><CardTitle>{group.title}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{group.description}</p>
              {fields.map(({ field, current }) => (
                <form
                  key={field.key}
                  action={saveConfig}
                  className="flex flex-wrap items-end gap-2 border-t pt-3"
                >
                  <input type="hidden" name="category" value={group.category} />
                  <input type="hidden" name="key" value={field.key} />
                  <div className="flex-1 min-w-[240px]">
                    <label className="text-xs text-muted-foreground">{field.label}</label>
                    <Input name="value" defaultValue={String(current)} />
                  </div>
                  <Button type="submit" variant="navy">Save</Button>
                </form>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
