import { cn } from "@/lib/utils";

/** Section heading used at the top of module pages (distinct from the app Header bar). */
export function PageIntro({ title, subtitle, action, className }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-4", className)}>
      <div>
        <h2 className="text-xl font-semibold text-elms-navy">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
