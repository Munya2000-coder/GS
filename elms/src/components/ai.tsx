import { useCallback, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/** Run an AI task with loading / result state.
 *  Uses a ref so `run` always calls the latest closure (avoids stale props). */
export function useAiTask<T>(fn: () => Promise<T>) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const run = useCallback(async () => {
    setLoading(true);
    setData(null);
    try {
      setData(await fnRef.current());
    } finally {
      setLoading(false);
    }
  }, []);
  const reset = useCallback(() => setData(null), []);
  return { loading, data, run, reset };
}

export function AiChip({ label = "AI" }: { label?: string }) {
  return (
    <span className="ai-chip">
      <Icon name="sparkle" size={12} /> {label}
    </span>
  );
}

export function AiPanel({
  title,
  sub,
  children,
  right,
  icon = "sparkle",
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  right?: ReactNode;
  icon?: "sparkle" | "brain" | "scan" | "target" | "message" | "stars";
}) {
  return (
    <div className="ai-panel">
      <div className="ai-head">
        <span className="ai-mark">
          <Icon name={icon} size={17} />
        </span>
        <div className="flex-1">
          <div className="ai-title">{title}</div>
          {sub && <div className="ai-sub">{sub}</div>}
        </div>
        {right}
      </div>
      <div className="ai-body">{children}</div>
    </div>
  );
}

export function AiThinking({ label = "Analysing…" }: { label?: string }) {
  return (
    <div className="ai-thinking">
      <span className="ai-dots">
        <i />
        <i />
        <i />
      </span>
      {label}
    </div>
  );
}

export function Confidence({ value }: { value: number }) {
  return (
    <div className="row gap-8" style={{ minWidth: 150 }}>
      <span className="tiny" style={{ color: "#6b5e9b", fontWeight: 600 }}>Confidence</span>
      <span className="conf">
        <i style={{ width: `${value}%` }} />
      </span>
      <b className="tiny mono" style={{ color: "#5b25ab" }}>{value}%</b>
    </div>
  );
}
