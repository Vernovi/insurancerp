import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePerformance } from "@/lib/permissions";
import { scoreSchema } from "@/lib/schemas";
import { kpiScore, type KriDirection } from "@/lib/scoring";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManagePerformance(auth.session.role)) return jsonError("Your role cannot score a KPI.", 403);
  const parsed = await readJson(request, scoreSchema);
  if (parsed.error) return parsed.error;
  const kpi = await prisma.kpi.findUnique({ where: { id: parsed.data.kpiId } });
  if (!kpi) return jsonError("KPI not found.", 404);
  const score = kpiScore(parsed.data.actual, kpi.target, kpi.direction as KriDirection);
  const row = await prisma.kpiScore.upsert({
    where: { kpiId_period: { kpiId: kpi.id, period: parsed.data.period } },
    create: {
      id: `${kpi.id}-${parsed.data.period}`,
      kpiId: kpi.id,
      period: parsed.data.period,
      actual: parsed.data.actual,
      score,
      notes: parsed.data.notes,
      scoredById: auth.session.id,
      scoredAt: new Date(),
    },
    update: {
      actual: parsed.data.actual,
      score,
      notes: parsed.data.notes,
      scoredById: auth.session.id,
      scoredAt: new Date(),
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "SCORE",
    entityType: "OBJECTIVE",
    entityId: kpi.objectiveId,
    summary: `Scored ${kpi.name} for ${parsed.data.period} at ${score}.`,
  });
  return NextResponse.json({ id: row.id, score });
}
