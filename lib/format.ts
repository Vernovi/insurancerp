import type { FieldDef } from "./defs/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function fmtDate(v: unknown): string {
  if (!v) return "";
  const s = v instanceof Date ? v.toISOString() : String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

export function fmtDateTime(v: Date | string | null | undefined): string {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return `${fmtDate(d.toISOString())} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")} UTC`;
}

export function fmtNaira(v: unknown, compact = true): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  if (!compact) return `₦${n.toLocaleString("en-NG")}`;
  const a = Math.abs(n);
  if (a >= 1e9) return `₦${(n / 1e9).toFixed(a >= 1e10 ? 0 : 1)}bn`;
  if (a >= 1e6) return `₦${(n / 1e6).toFixed(a >= 1e7 ? 0 : 1)}m`;
  if (a >= 1e3) return `₦${(n / 1e3).toFixed(0)}k`;
  return `₦${n}`;
}

export function fmtNumber(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-GB", { maximumFractionDigits: 2 }) : String(v);
}

export function displayValue(f: FieldDef, v: unknown, users: Map<number, string>, units: Map<number, string>): string {
  if (v === null || v === undefined || v === "") return "";
  switch (f.type) {
    case "date":
      return fmtDate(v);
    case "currency":
      return fmtNaira(v, false);
    case "checkbox":
      return v === true ? "Yes" : "No";
    case "multiselect":
      return Array.isArray(v) ? v.join(", ") : String(v);
    case "user":
      return users.get(Number(v)) ?? "";
    case "orgunit":
      return units.get(Number(v)) ?? "";
    case "number":
      return fmtNumber(v);
    case "computed":
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
      if (typeof v === "number") return fmtNumber(v);
      return String(v);
    default:
      return String(v);
  }
}

export type Tone = "neutral" | "info" | "good" | "warn" | "bad" | "crit";

/** Map well-known values to colours so status reads at a glance. */
export function toneFor(value: unknown): Tone | null {
  const s = String(value ?? "");
  const map: Record<string, Tone> = {
    "Outside appetite": "bad",
    "Approaching appetite": "warn",
    "Within appetite": "good",
    Critical: "crit",
    High: "bad",
    Medium: "warn",
    Low: "good",
    Red: "bad",
    Amber: "warn",
    Green: "good",
    Effective: "good",
    "Partially effective": "warn",
    Ineffective: "bad",
    Compliant: "good",
    "Partially compliant": "warn",
    "Non-compliant": "bad",
    "Tier 1": "bad",
    "Tier 2": "warn",
    "Tier 3": "neutral",
    "Within tolerance": "good",
    "Outside tolerance": "bad",
    "Compliance review": "warn",
    "Nil return": "good",
    Fail: "bad",
    Pass: "good",
    "Pass with exceptions": "warn",
    Satisfactory: "good",
    "Needs improvement": "warn",
    Unsatisfactory: "bad",
  };
  return map[s] ?? null;
}

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-line-2 text-ink-2",
  info: "bg-info-soft text-info",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  crit: "bg-crit text-white",
};
