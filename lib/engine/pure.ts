// Pure business rules. No database access, so they are unit-tested directly.
import type { FieldDef, TransitionDef, TypeDef, Role } from "../defs/types";

export type Rating = "Low" | "Medium" | "High" | "Critical";

export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Likelihood x impact on a 5x5 matrix. Returns null unless both are 1-5. */
export function score(likelihood: unknown, impact: unknown): number | null {
  const l = num(likelihood);
  const i = num(impact);
  if (l === null || i === null || l < 1 || l > 5 || i < 1 || i > 5) return null;
  return l * i;
}

/** Rating bands for a 1-25 score. */
export function rating(s: number | null): Rating | null {
  if (s === null) return null;
  if (s >= 15) return "Critical";
  if (s >= 10) return "High";
  if (s >= 5) return "Medium";
  return "Low";
}

export type AppetiteStatus = "Within appetite" | "Approaching appetite" | "Outside appetite" | "No appetite set";

/** Residual above threshold is outside; within 2 points at or below threshold is approaching. */
export function appetiteStatus(residual: number | null, threshold: number | null): AppetiteStatus {
  if (threshold === null || residual === null) return "No appetite set";
  if (residual > threshold) return "Outside appetite";
  if (residual >= threshold - 2) return "Approaching appetite";
  return "Within appetite";
}

/** Review cadence driven by residual rating (days). */
export function reviewDays(r: Rating | null): number {
  switch (r) {
    case "Critical":
      return 30;
    case "High":
      return 30;
    case "Medium":
      return 90;
    default:
      return 365;
  }
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export type KriStatus = "Green" | "Amber" | "Red" | "No data";

export function kriStatus(value: number | null, amber: number | null, red: number | null, direction: string | undefined): KriStatus {
  if (value === null || amber === null || red === null) return "No data";
  const higherWorse = direction !== "Lower is worse";
  if (higherWorse) {
    if (value >= red) return "Red";
    if (value >= amber) return "Amber";
    return "Green";
  }
  if (value <= red) return "Red";
  if (value <= amber) return "Amber";
  return "Green";
}

/** Third-party tier from tiering answers: 1 = most critical. */
export function thirdPartyTier(d: Record<string, unknown>): { tier: string; reassessMonths: number } {
  let pts = 0;
  if (d.critical_service === "Yes") pts += 3;
  if (d.data_access === "Extensive") pts += 2;
  else if (d.data_access === "Limited") pts += 1;
  if (d.substitutability === "Hard") pts += 2;
  else if (d.substitutability === "Moderate") pts += 1;
  if (d.regulatory_significance === true) pts += 2;
  if (d.tp_type === "Reinsurer") pts += 2;
  if (pts >= 6) return { tier: "Tier 1", reassessMonths: 12 };
  if (pts >= 3) return { tier: "Tier 2", reassessMonths: 24 };
  return { tier: "Tier 3", reassessMonths: 36 };
}

export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Regulatory and internal response clocks per case type, in days from the reported date.
 * CASE_CLOCK_BASIS records where each value comes from; "Internal" values are service standards
 * the client sets, not regulatory deadlines.
 */
export const CASE_CLOCK_DAYS: Record<string, number> = {
  "Claim awaiting settlement or decision": 60, // NIIRA 2025 s.210
  "Customer complaint": 60, // claims complaints follow NIIRA 2025 s.210
  "Data protection breach": 3, // NDPA 2023 s.40: notify NDPC within 72 hours where required
  "Whistleblowing report": 7, // acknowledge reporter
  "AML/CFT suspicious activity": 1, // STR to NFIU; 24 hours unverified against primary text
  "Regulatory breach": 5,
  "Suspected claims fraud": 30,
  "Internal fraud or misconduct": 30,
  "Operational incident": 10,
  "HSE incident": 2,
};

export const CASE_CLOCK_BASIS: Record<string, string> = {
  "Claim awaiting settlement or decision": "NIIRA 2025 s.210: admitted claims settled, special-risk claims admitted or denied, and declines given in writing within 60 days",
  "Customer complaint": "NIIRA 2025 s.210 60-day claims clock for claims-related complaints; set a shorter internal acknowledgement standard if wanted",
  "Data protection breach": "NDPA 2023 s.40: 72 hours to notify the NDPC where required",
  "Whistleblowing report": "Internal standard: acknowledge the reporter within 7 days",
  "AML/CFT suspicious activity": "NFIU suspicious transaction report; 24 hours to be confirmed against the regulations",
  "Regulatory breach": "Internal standard: 5 days to assess and decide on notification",
  "Suspected claims fraud": "Internal standard",
  "Internal fraud or misconduct": "Internal standard",
  "Operational incident": "Internal standard",
  "HSE incident": "Internal standard",
};

export function caseClock(caseType: unknown, reportedDate: unknown): string | null {
  if (typeof caseType !== "string" || typeof reportedDate !== "string" || !reportedDate) return null;
  const days = CASE_CLOCK_DAYS[caseType];
  if (days === undefined) return null;
  return addDays(reportedDate, days);
}

/** Severity default from amount at risk when not set. */
export function severityFromAmount(amount: number | null): Rating | null {
  if (amount === null) return null;
  if (amount >= 100_000_000) return "Critical";
  if (amount >= 20_000_000) return "High";
  if (amount >= 2_000_000) return "Medium";
  return "Low";
}

/** Audit priority: inherent risk weight plus years since last audit plus regulatory focus. */
export function auditPriority(inherent: unknown, lastAudit: unknown, regulatoryFocus: unknown, asOf = today()): number {
  const w: Record<string, number> = { Low: 1, Medium: 2, High: 3, Critical: 4 };
  let p = (w[String(inherent)] ?? 2) * 2;
  if (typeof lastAudit === "string" && lastAudit) {
    const years = (Date.parse(asOf) - Date.parse(lastAudit)) / (365.25 * 864e5);
    p += Math.min(3, Math.max(0, Math.floor(years)));
  } else {
    p += 3;
  }
  if (regulatoryFocus === true) p += 2;
  return p;
}

/** Declaration routing. */
export function declarationTriage(d: Record<string, unknown>, giftThreshold = 50_000): "Nil return" | "Compliance review" | "Manager review" {
  if (d.decl_type === "Annual conflict of interest declaration" && d.nil_return === true) return "Nil return";
  const highRisk = ["Broker", "Reinsurer", "Claimant", "Supplier", "Regulator"];
  if (highRisk.includes(String(d.counterparty_type))) return "Compliance review";
  if (d.decl_type === "Related-party transaction" || d.decl_type === "Personal account dealing") return "Compliance review";
  const v = num(d.gift_value);
  if (d.decl_type === "Gift or hospitality" && v !== null && v > giftThreshold) return "Compliance review";
  return "Manager review";
}

export function isEmpty(v: unknown): boolean {
  return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || v === false;
}

export interface Actor {
  id: number;
  roles: Role[];
}

export interface RecordLike {
  status: string;
  ownerId: number | null;
  createdBy: number | null;
  data: Record<string, unknown>;
}

/** User ids that have already taken a four-eyes step on this record. */
export const FOUR_EYES_ACTORS = "_four_eyes";

export function fourEyesActors(data: Record<string, unknown>): number[] {
  const v = data[FOUR_EYES_ACTORS];
  if (!Array.isArray(v)) return [];
  return v.map((x) => Number(x)).filter((n) => Number.isFinite(n));
}

/** Returns an error message, or null when the transition is allowed. */
export function checkTransition(
  def: TypeDef,
  rec: RecordLike,
  t: TransitionDef,
  actor: Actor,
  comment?: string,
  canEdit = false,
): string | null {
  if (!t.from.includes(rec.status)) return `"${t.label}" is not available at this stage.`;
  const isOwner = rec.ownerId === actor.id;
  const isCreator = rec.createdBy === actor.id;
  const isAdmin = actor.roles.includes("admin");
  const roleMatch = (isAdmin && !t.strictRoles) || (t.roles ?? []).some((r) => actor.roles.includes(r));
  if (t.ownerAllowed === false && isOwner) return `The record owner cannot "${t.label}"; someone independent must do it.`;
  if (t.fourEyes && isCreator) return `Four-eyes rule: the person who raised this record cannot "${t.label}".`;
  if (t.fourEyes && fourEyesActors(rec.data).includes(actor.id)) return `Four-eyes rule: someone who already took a four-eyes step cannot "${t.label}".`;
  if (t.roles && t.roles.length > 0) {
    if (t.strictRoles && !roleMatch) return `Only these roles can "${t.label}": ${t.roles.join(", ")}.`;
    if (!roleMatch && !(isOwner && t.ownerAllowed !== false)) return `Only these roles can "${t.label}": ${t.roles.join(", ")}.`;
  } else if (!(isOwner || isCreator || canEdit || isAdmin)) {
    return `Only the owner or an editor can "${t.label}".`;
  }
  for (const f of t.distinctFrom ?? []) {
    if (rec.data[f] !== null && rec.data[f] !== undefined && Number(rec.data[f]) === actor.id) {
      return `"${t.label}" needs a different person from the one who already signed.`;
    }
  }
  if (t.commentRequired && !(comment && comment.trim())) return `Add a comment to "${t.label}".`;
  for (const f of t.requires ?? []) {
    const fd = def.fields.find((x) => x.key === f);
    if (fd && fd.type === "checkbox" ? rec.data[f] !== true : isEmpty(rec.data[f])) {
      return `Fill in "${fd?.label ?? f}" before "${t.label}".`;
    }
  }
  return null;
}

/** Coerce raw form values to typed values according to field definitions. */
export function coerceFields(fields: FieldDef[], raw: Record<string, unknown>): { data: Record<string, unknown>; errors: string[] } {
  const data: Record<string, unknown> = {};
  const errors: string[] = [];
  for (const f of fields) {
    if (f.readOnly || f.type === "computed") continue;
    if (!(f.key in raw)) {
      if (f.type === "checkbox") data[f.key] = false;
      continue;
    }
    const v = raw[f.key];
    switch (f.type) {
      case "number":
      case "currency":
      case "score": {
        const n = num(v);
        if (v !== "" && v !== null && v !== undefined && n === null) errors.push(`${f.label} must be a number.`);
        if (n !== null && f.min !== undefined && n < f.min) errors.push(`${f.label} must be at least ${f.min}.`);
        if (n !== null && f.max !== undefined && n > f.max) errors.push(`${f.label} must be at most ${f.max}.`);
        if (n !== null && f.type === "score" && (n < 1 || n > 5 || !Number.isInteger(n))) errors.push(`${f.label} must be a whole number from 1 to 5.`);
        data[f.key] = n;
        break;
      }
      case "checkbox":
        data[f.key] = v === true || v === "on" || v === "true";
        break;
      case "multiselect":
        data[f.key] = Array.isArray(v) ? v.map(String) : v ? [String(v)] : [];
        break;
      case "user":
      case "orgunit":
        data[f.key] = num(v);
        break;
      case "date": {
        const sv = v ? String(v) : "";
        if (sv && !/^\d{4}-\d{2}-\d{2}$/.test(sv)) errors.push(`${f.label} must be a date.`);
        data[f.key] = sv || null;
        break;
      }
      case "select":
        if (v && f.options && !f.options.includes(String(v))) errors.push(`${f.label} has an unknown value.`);
        data[f.key] = v ? String(v) : null;
        break;
      default:
        data[f.key] = v === null || v === undefined ? null : String(v).slice(0, 20000);
    }
  }
  return { data, errors };
}

/** Is a field visible given its showIf condition? */
export function fieldVisible(f: FieldDef, data: Record<string, unknown>): boolean {
  if (!f.showIf) return true;
  const v = data[f.showIf.field];
  const norm = v === undefined || v === null ? (f.showIf.in.includes(false) ? false : v) : v;
  return f.showIf.in.includes(norm as string | boolean);
}

// ---------------------------------------------------------------------------
// Capital, claims ageing, losses, returns and reminders
// ---------------------------------------------------------------------------

/** Non-life minimum capital under NIIRA 2025 (NAICOM recapitalisation circular). */
export const NON_LIFE_MCR_NGN = 15_000_000_000;

/** Capital against a minimum or risk-based requirement. Red below 100%, amber inside the buffer. */
export function capitalCover(capital: number | null, requirement: number | null, bufferPct = 20): { ratio: number | null; status: KriStatus } {
  if (capital === null || requirement === null || requirement <= 0) return { ratio: null, status: "No data" };
  const ratio = Math.round((capital / requirement) * 1000) / 10;
  if (ratio < 100) return { ratio, status: "Red" };
  if (ratio < 100 + bufferPct) return { ratio, status: "Amber" };
  return { ratio, status: "Green" };
}

/** Open claim cases past the 60-day NIIRA s.210 clock, as a count and share. */
export function claimsAgeing(cases: { caseType: string; reportedDate: string | null; open: boolean }[], asOf = today(), days = 60): { open: number; late: number; pct: number } {
  const claims = cases.filter((c) => c.open && c.caseType === "Claim awaiting settlement or decision" && c.reportedDate);
  const late = claims.filter((c) => addDays(c.reportedDate!, days) < asOf).length;
  return { open: claims.length, late, pct: claims.length ? Math.round((late / claims.length) * 100) : 0 };
}

export const LOSS_THRESHOLDS = { record: 1_000_000, board: 50_000_000 };

/** Loss amounts converted to naira. Near misses carry no loss. */
export function lossFigures(d: { currency?: unknown; fx_rate?: unknown; gross_loss?: unknown; recoveries?: unknown; insurance_recoveries?: unknown; near_miss?: unknown }) {
  const g = num(d.gross_loss) ?? 0;
  const rec = (num(d.recoveries) ?? 0) + (num(d.insurance_recoveries) ?? 0);
  const net = d.near_miss === true ? 0 : g - rec;
  const rate = d.currency === "USD" ? num(d.fx_rate) : 1;
  const netNgn = rate === null ? null : Math.round(net * rate);
  const grossNgn = rate === null ? null : Math.round((d.near_miss === true ? 0 : g) * rate);
  return { net, netNgn, grossNgn };
}

/** Problems that stop a loss event being saved: recoveries above the gross loss, impossible dates. */
export function lossProblems(d: { gross_loss?: unknown; recoveries?: unknown; insurance_recoveries?: unknown; near_miss?: unknown; event_date?: unknown; discovery_date?: unknown }, todayIso: string): string | null {
  const g = num(d.gross_loss) ?? 0;
  const rec = (num(d.recoveries) ?? 0) + (num(d.insurance_recoveries) ?? 0);
  if (d.near_miss !== true && rec > g) return "Recoveries can't be more than the gross loss.";
  const ev = typeof d.event_date === "string" ? d.event_date : null;
  const disc = typeof d.discovery_date === "string" && d.discovery_date ? d.discovery_date : null;
  if (ev && ev > todayIso) return "The event date can't be in the future.";
  if (disc && disc > todayIso) return "The discovery date can't be in the future.";
  if (ev && disc && disc < ev) return "The discovery date can't be before the event date.";
  return null;
}

export function lossBand(netNgn: number | null, nearMiss = false): string {
  if (nearMiss) return "Near miss";
  if (netNgn === null) return "Enter the exchange rate";
  if (netNgn >= LOSS_THRESHOLDS.board) return "Board-reportable";
  if (netNgn >= LOSS_THRESHOLDS.record) return "Reportable";
  return "Below threshold";
}

export const RECURRENCE = ["One-off", "Monthly", "Quarterly", "Semi-annual", "Annual"] as const;

/** Next due date for a recurring return, or null for one-off returns. */
export function nextDue(due: string, recurrence: unknown): string | null {
  switch (recurrence) {
    case "Monthly":
      return addMonths(due, 1);
    case "Quarterly":
      return addMonths(due, 3);
    case "Semi-annual":
      return addMonths(due, 6);
    case "Annual":
      return addMonths(due, 12);
    default:
      return null;
  }
}

export type FilingStatus = "Filed on time" | "Filed late" | "Overdue" | "Due soon" | "Scheduled";

export function filingStatus(due: string | null, submittedOn: string | null, asOf = today(), soonDays = 14): FilingStatus | null {
  if (!due) return null;
  if (submittedOn) return submittedOn <= due ? "Filed on time" : "Filed late";
  if (due < asOf) return "Overdue";
  if (due <= addDays(asOf, soonDays)) return "Due soon";
  return "Scheduled";
}

export interface Reminder {
  to: "owner" | "manager" | "escalation";
  message: string;
}

/**
 * Daily reminder plan for one open record. Regulatory returns get an early reminder
 * (`leadDays`, default 14), 7 days, 1 day and on the day; once overdue they escalate to
 * Compliance and the CRO every day for the first week and weekly after that.
 * Other records keep the 7-day / due-day / weekly-overdue pattern with manager escalation.
 */
export function reminderPlan(r: { label: string; ref: string; due: string; isReturn: boolean; leadDays?: number | null }, asOf = today()): Reminder[] {
  const daysTo = Math.round((Date.parse(r.due) - Date.parse(asOf)) / 864e5);
  const out: Reminder[] = [];
  if (daysTo > 0) {
    const marks = r.isReturn ? [r.leadDays ?? 14, 7, 1] : [7];
    if (marks.includes(daysTo)) out.push({ to: "owner", message: `${r.label} ${r.ref} is due in ${daysTo} ${daysTo === 1 ? "day" : "days"}.` });
    return out;
  }
  if (daysTo === 0) return [{ to: "owner", message: `${r.label} ${r.ref} is due today.` }];
  const late = -daysTo;
  if (r.isReturn) {
    if (late <= 7 || late % 7 === 0) {
      out.push({ to: "owner", message: `${r.label} ${r.ref} is ${late} ${late === 1 ? "day" : "days"} overdue. File it or record why.` });
      out.push({ to: "escalation", message: `Filing overdue: ${r.label} ${r.ref} is ${late} ${late === 1 ? "day" : "days"} past its due date.` });
    }
    return out;
  }
  if (late === 1 || late % 7 === 0) {
    out.push({ to: "owner", message: `${r.label} ${r.ref} is ${late} ${late === 1 ? "day" : "days"} overdue.` });
    if (late >= 7) out.push({ to: "manager", message: `Escalation: ${r.label} ${r.ref} owned by your team is ${late} days overdue.` });
  }
  return out;
}

/** ORSA submission falls 60 days after the financial year end (NAICOM Prudential Guidelines 2022 s.6.4). */
export function orsaDue(yearEnd: unknown): string | null {
  return typeof yearEnd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(yearEnd) ? addDays(yearEnd, 60) : null;
}

/** Financial Condition Report publication falls 14 days after the report date (Prudential Guidelines 2022 s.6.5). */
export function fcrPublishDue(reportDate: unknown): string | null {
  return typeof reportDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(reportDate) ? addDays(reportDate, 14) : null;
}
