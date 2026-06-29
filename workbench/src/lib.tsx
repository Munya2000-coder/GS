import type { TrafficLight } from "./types";

export const lightClass = (s: TrafficLight | string): string =>
  s === "green_confirmed" ? "green" : s === "amber_review" ? "amber" : "red";

export const pillClass = (s: TrafficLight | string): string =>
  s === "green_confirmed" ? "g" : "a";

export const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  return String(v);
};

export const label = (k: string): string => k.replace(/_/g, " ");
