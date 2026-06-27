import type { ReactNode } from "react";
import { useEffect } from "react";
import type { RagStatus } from "../data/types";
import { RAG_META, initials } from "../lib/domain";
import { Icon, type IconName } from "./Icon";

/* ----------------------------- Avatar ----------------------------- */
export function Avatar({
  first,
  last,
  color,
  size = "md",
}: {
  first: string;
  last: string;
  color: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={`avatar ${size}`} style={{ background: color }}>
      {initials(first, last).toUpperCase()}
    </span>
  );
}

/* ----------------------------- Badge ------------------------------ */
type Tone = "green" | "amber" | "red" | "grey" | "blue" | "violet" | "outline";
export function Badge({ tone = "grey", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge ${tone}`}>
      {dot && <span className="dotc" />}
      {children}
    </span>
  );
}

/* --------------------------- RAG pill ----------------------------- */
const RAG_TONE: Record<RagStatus, Tone> = {
  green: "green",
  amber: "amber",
  red: "red",
  grey: "grey",
  na: "grey",
};
export function RagBadge({ rag, label }: { rag: RagStatus; label?: string }) {
  return (
    <Badge tone={RAG_TONE[rag]} dot>
      {label ?? RAG_META[rag].label}
    </Badge>
  );
}

/* --------------------------- Card --------------------------------- */
export function Card({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function CardHead({
  title,
  sub,
  icon,
  right,
}: {
  title: string;
  sub?: string;
  icon?: IconName;
  right?: ReactNode;
}) {
  return (
    <div className="card-head">
      {icon && (
        <span style={{ color: "var(--accent)", display: "grid", placeItems: "center" }}>
          <Icon name={icon} size={18} />
        </span>
      )}
      <div>
        <h3>{title}</h3>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  );
}

/* --------------------------- Button ------------------------------- */
export function Button({
  children,
  variant = "default",
  size,
  icon,
  iconRight,
  block,
  ...rest
}: {
  children?: ReactNode;
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "sm" | "lg";
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const cls = [
    "btn",
    variant !== "default" ? variant : "",
    size ?? "",
    block ? "block" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === "sm" ? 14 : 16} />}
    </button>
  );
}

/* --------------------------- KPI ---------------------------------- */
export function Kpi({
  label,
  value,
  icon,
  tone = "brand",
  trend,
  sub,
}: {
  label: string;
  value: ReactNode;
  icon: IconName;
  tone?: "brand" | "green" | "amber" | "red" | "blue" | "violet";
  trend?: { dir: "up" | "down"; value: string; good?: boolean };
  sub?: string;
}) {
  const toneMap: Record<string, { bg: string; fg: string }> = {
    brand: { bg: "var(--brand-50)", fg: "var(--brand-700)" },
    green: { bg: "var(--green-bg)", fg: "var(--green-ink)" },
    amber: { bg: "var(--amber-bg)", fg: "var(--amber-ink)" },
    red: { bg: "var(--red-bg)", fg: "var(--red-ink)" },
    blue: { bg: "var(--blue-bg)", fg: "var(--blue-ink)" },
    violet: { bg: "var(--violet-bg)", fg: "var(--violet-ink)" },
  };
  const t = toneMap[tone];
  return (
    <Card className="kpi card-pad">
      <div className="row between items-start">
        <div className="kpi-label">{label}</div>
        <span className="kpi-icon" style={{ background: t.bg, color: t.fg }}>
          <Icon name={icon} size={20} />
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="row gap-8" style={{ marginTop: 7 }}>
        {trend && (
          <span className={`trend ${trend.good === false ? "down" : trend.dir}`}>
            <Icon name={trend.dir === "up" ? "arrowUp" : "arrowDown"} size={12} />
            {trend.value}
          </span>
        )}
        {sub && <span className="tiny muted">{sub}</span>}
      </div>
    </Card>
  );
}

/* ----------------------- Progress ring ---------------------------- */
export function ProgressRing({
  value,
  size = 120,
  stroke = 11,
  color,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const col = color ?? (value >= 90 ? "#16a34a" : value >= 75 ? "#d97706" : "#dc2626");
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
        />
      </svg>
      <div className="donut-center">
        <b style={{ color: col }}>{label ?? `${value}%`}</b>
        {sublabel && <span>{sublabel}</span>}
      </div>
    </div>
  );
}

/* --------------------------- Donut -------------------------------- */
export function Donut({
  segments,
  size = 150,
  stroke = 20,
  centerTop,
  centerBottom,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  centerTop?: ReactNode;
  centerBottom?: string;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="donut-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.value / total) * c;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-acc}
              style={{ transition: "stroke-dasharray 0.8s var(--ease)" }}
            />
          );
          acc += len;
          return seg;
        })}
      </svg>
      <div className="donut-center">
        {centerTop}
        {centerBottom && <span>{centerBottom}</span>}
      </div>
    </div>
  );
}

/* --------------------------- Meter -------------------------------- */
export function Meter({ value, color }: { value: number; color?: string }) {
  const col = color ?? (value >= 90 ? "var(--green)" : value >= 75 ? "var(--amber)" : "var(--red)");
  return (
    <div className="meter">
      <i style={{ width: `${value}%`, background: col }} />
    </div>
  );
}

/* --------------------------- Empty -------------------------------- */
export function Empty({ icon = "search", title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <div className="empty">
      <Icon name={icon} size={40} />
      <div style={{ fontWeight: 600, color: "var(--ink-2)", marginBottom: 2 }}>{title}</div>
      {hint && <div className="small">{hint}</div>}
    </div>
  );
}

/* --------------------------- Modal -------------------------------- */
export function Modal({
  title,
  icon,
  onClose,
  children,
  footer,
  drawer,
  wide,
}: {
  title: string;
  icon?: IconName;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  drawer?: boolean;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div
      className={`overlay ${drawer ? "right" : "center"}`}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={drawer ? `drawer ${wide ? "wide" : ""}` : "modal"}>
        <div className={drawer ? "drawer-head" : "modal-head"}>
          {icon && (
            <span style={{ color: "var(--accent)", display: "grid", placeItems: "center" }}>
              <Icon name={icon} size={19} />
            </span>
          )}
          <h3 className="flex-1">{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close" style={{ width: 32, height: 32 }}>
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className={drawer ? "drawer-body" : "modal-body"}>{children}</div>
        {footer && <div className={drawer ? "drawer-foot" : "modal-foot"}>{footer}</div>}
      </div>
    </div>
  );
}

/* --------------------------- CQC chip ----------------------------- */
export function CqcChip({ domain, color }: { domain: string; color: string }) {
  return (
    <span className="cqc-chip">
      <span className="d" style={{ background: color }} />
      {domain}
    </span>
  );
}

/* --------------------------- Field -------------------------------- */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/* --------------------------- Tabs --------------------------------- */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (k: T) => void;
}) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.key}
          className={`tab ${active === t.key ? "active" : ""}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
