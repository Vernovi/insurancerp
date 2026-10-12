import type { AssessmentStatus } from "./domain";

export type ScoreBand = "LOW" | "MEDIUM" | "HIGH" | "SEVERE";
export type AppetitePosition = "WITHIN" | "APPROACHING" | "ABOVE";
export type Rag = "GREEN" | "AMBER" | "RED";
export type KriDirection = "LOWER_IS_BETTER" | "HIGHER_IS_BETTER";

export function riskScore(likelihood: number, impact: number): number {
  if (!Number.isInteger(likelihood) || !Number.isInteger(impact)) {
    throw new Error("Likelihood and impact must be whole numbers from 1 to 5.");
  }
  if (likelihood < 1 || likelihood > 5 || impact < 1 || impact > 5) {
    throw new Error("Likelihood and impact must be from 1 to 5.");
  }
  return likelihood * impact;
}

export function scoreBand(score: number): ScoreBand {
  if (score >= 16) return "SEVERE";
  if (score >= 10) return "HIGH";
  if (score >= 5) return "MEDIUM";
  return "LOW";
}

export function appetitePosition(residual: number, limit: number): AppetitePosition {
  if (residual > limit) return "ABOVE";
  if (limit > 0 && residual / limit >= 0.8) return "APPROACHING";
  return "WITHIN";
}

export function kriRag(
  value: number,
  green: number,
  amber: number,
  direction: KriDirection,
): Rag {
  if (direction === "LOWER_IS_BETTER") {
    if (value <= green) return "GREEN";
    if (value <= amber) return "AMBER";
    return "RED";
  }
  if (value >= green) return "GREEN";
  if (value >= amber) return "AMBER";
  return "RED";
}

export function kpiScore(actual: number, target: number, direction: KriDirection): number {
  if (target === 0) return actual === 0 ? 100 : 0;
  const ratio = direction === "LOWER_IS_BETTER" ? target / actual : actual / target;
  if (!Number.isFinite(ratio)) return 0;
  return Math.round(Math.max(0, Math.min(100, ratio * 100)));
}

const POINTS: Record<AssessmentStatus, number | null> = {
  COMPLIANT: 100,
  PARTIAL: 50,
  NON_COMPLIANT: 0,
  NOT_ASSESSED: null,
};

export function compliancePercent(statuses: AssessmentStatus[]): {
  percent: number | null;
  assessed: number;
  total: number;
} {
  const scored = statuses
    .map((status) => POINTS[status])
    .filter((points): points is number => points !== null);
  if (scored.length === 0) {
    return { percent: null, assessed: 0, total: statuses.length };
  }
  const percent = Math.round(scored.reduce((sum, points) => sum + points, 0) / scored.length);
  return { percent, assessed: scored.length, total: statuses.length };
}

export function isOverdue(due: Date, status: string, now = new Date()): boolean {
  if (status === "COMPLETED" || status === "CANCELLED" || status === "CLOSED") return false;
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return dueDay < today;
}

export function topRisks<T extends { residualScore: number; inherentScore: number; code: string }>(
  risks: T[],
  count = 10,
): T[] {
  return [...risks]
    .sort((a, b) => b.residualScore - a.residualScore || b.inherentScore - a.inherentScore || a.code.localeCompare(b.code))
    .slice(0, count);
}
