interface Props { value: string }

const OK = new Set(["active", "posted", "approved", "succeeded", "matched", "signed_off"]);
const WARN = new Set(["draft", "pending_review", "soft_close", "reopened", "queued", "running", "pending", "in_review", "validated"]);
const ERR = new Set(["rejected", "failed", "break", "cancelled"]);

export default function StateBadge({ value }: Props) {
  const v = (value ?? "").toLowerCase();
  const cls = OK.has(v) ? "ok" : WARN.has(v) ? "warn" : ERR.has(v) ? "err" : "muted";
  return <span className={`badge ${cls}`}>{v}</span>;
}
