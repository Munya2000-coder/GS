import Link from "next/link";
import { FileQuestion } from "lucide-react";

// In-shell 404 (e.g. a worker/CoS id that doesn't exist via notFound()).
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <FileQuestion className="mb-3 h-10 w-10 text-elms-grey-mid" />
      <h2 className="text-lg font-semibold text-elms-navy">Record not found</h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The record you’re looking for doesn’t exist or may have been removed.
      </p>
      <Link href="/" className="mt-4 text-sm text-elms-teal hover:underline">← Back to dashboard</Link>
    </div>
  );
}
