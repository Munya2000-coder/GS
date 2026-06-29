"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Route error boundary — surfaces server-action / render errors with a plain-English
// message and a recovery action (PRD §10.5 — actionable error messages).
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Server actions throw plain Error("FORBIDDEN: ..."), Error("ICMS-012 ...") etc.
  const message = error.message?.replace(/^Error:\s*/, "") || "An unexpected error occurred.";
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <AlertTriangle className="mb-3 h-10 w-10 text-elms-warning" />
      <h2 className="text-lg font-semibold text-elms-navy">Something went wrong</h2>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">{message}</p>
      <Button onClick={reset} className="mt-4">Try again</Button>
    </div>
  );
}
