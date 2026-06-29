import { Inbox } from "lucide-react";

/**
 * Empty-state guidance (PRD §8.3 — "when a worker file has missing documents,
 * the system shows exactly what is needed and how to upload it").
 */
export function EmptyState({
  title, message, icon: Icon = Inbox, action,
}: {
  title: string;
  message?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-white px-6 py-12 text-center">
      <Icon className="mb-3 h-9 w-9 text-elms-grey-mid" />
      <h3 className="text-sm font-semibold text-elms-navy">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
