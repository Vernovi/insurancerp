import { prisma } from "@/lib/db";
import { CATEGORY_LABEL, type AssessmentStatus, type RiskCategory } from "@/lib/domain";
import { appetitePosition, compliancePercent, isOverdue, kriRag, scoreBand, topRisks, type KriDirection } from "@/lib/scoring";

export async function getBoardPack() {
  const [risks, limits, actions, findings, frameworks, kris] = await Promise.all([
    prisma.risk.findMany({ include: { owner: true, department: true } }),
    prisma.riskAppetiteLimit.findMany(),
    prisma.actionItem.findMany({ include: { owner: true, risk: true }, orderBy: { dueDate: "asc" } }),
    prisma.finding.findMany({ where: { status: { not: "CLOSED" } }, include: { owner: true }, orderBy: { raisedAt: "desc" } }),
    prisma.framework.findMany({ include: { requirements: { include: { assessments: true } } }, orderBy: { name: "asc" } }),
    prisma.kri.findMany({ include: { owner: true, risk: true }, orderBy: { code: "asc" } }),
  ]);

  const limitByCategory = new Map(limits.map((limit) => [limit.category, limit.maxResidualScore]));
  const scored = risks.map((risk) => {
    const appetiteLimit = limitByCategory.get(risk.category) ?? 25;
    const appetite = appetitePosition(risk.residualScore, appetiteLimit);
    return { ...risk, appetiteLimit, appetite, band: scoreBand(risk.residualScore) };
  });
  const above = scored.filter((risk) => risk.appetite === "ABOVE").sort((a, b) => b.residualScore - a.residualScore);
  const openActions = actions.filter((action) => action.status === "OPEN" || action.status === "IN_PROGRESS");
  const actionRows = openActions.map((action) => ({ ...action, overdue: isOverdue(action.dueDate, action.status) }));
  const frameworkScores = frameworks.map((framework) => {
    const latest = framework.requirements.map((requirement) => {
      const sorted = [...requirement.assessments].sort((a, b) => b.assessedAt.getTime() - a.assessedAt.getTime());
      return (sorted[0]?.status ?? "NOT_ASSESSED") as AssessmentStatus;
    });
    const summary = compliancePercent(latest);
    return { id: framework.id, name: framework.name, code: framework.code, ...summary };
  });
  const scoredFrameworks = frameworkScores.filter((framework) => framework.percent !== null);
  const complianceScore = scoredFrameworks.length
    ? Math.round(scoredFrameworks.reduce((sum, framework) => sum + (framework.percent ?? 0), 0) / scoredFrameworks.length)
    : null;
  const kriRows = kris.map((kri) => ({
    ...kri,
    rag: kriRag(kri.currentValue, kri.greenThreshold, kri.amberThreshold, kri.direction as KriDirection),
  }));

  return {
    company: "Harbourline Assurance Plc",
    profile: "Multi-line insurer — motor, property, marine, energy, health, life and aviation",
    generatedAt: new Date(),
    topRisks: topRisks(scored, 10),
    aboveAppetite: above,
    openActions: actionRows,
    overdueCount: actionRows.filter((action) => action.overdue).length,
    findings,
    frameworkScores,
    complianceScore,
    kris: kriRows,
    categoryLabel: CATEGORY_LABEL as Record<string, string>,
    limits,
  };
}

export type BoardPack = Awaited<ReturnType<typeof getBoardPack>>;

export function categoryName(pack: BoardPack, category: string): string {
  return pack.categoryLabel[category as RiskCategory] ?? category;
}
