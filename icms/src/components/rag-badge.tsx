import { Badge } from "@/components/ui/badge";

type Rag = "Green" | "Amber" | "Red" | "Critical";

const VARIANT: Record<Rag, "green" | "amber" | "red" | "critical"> = {
  Green: "green",
  Amber: "amber",
  Red: "red",
  Critical: "critical",
};

/** RAG status pill used across worker/CoS/document rows (PRD §8.3 "RAG everywhere"). */
export function RagBadge({ status }: { status: string }) {
  const variant = VARIANT[(status as Rag)] ?? "amber";
  return <Badge variant={variant}>{status}</Badge>;
}

/** Slim score bar with RAG colour for compliance percentages. */
export function ScoreBar({ score, rag }: { score: number; rag: string }) {
  const color =
    rag === "Green" ? "#10B981" : rag === "Amber" ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-elms-grey">
        <div className="h-full rounded-full" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-xs tabular-nums text-elms-navy">{score}%</span>
    </div>
  );
}
