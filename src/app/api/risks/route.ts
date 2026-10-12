import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { canManageRisks } from "@/lib/permissions";
import { riskSchema } from "@/lib/schemas";
import { prisma } from "@/lib/db";
import { riskScore } from "@/lib/scoring";
import { nextRiskCode } from "@/server/codes";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManageRisks(auth.session.role)) return jsonError("Your role cannot edit the risk register.", 403);
  const parsed = await readJson(request, riskSchema);
  if (parsed.error) return parsed.error;
  const input = parsed.data;
  const code = await nextRiskCode();
  const risk = await prisma.risk.create({
    data: {
      id: code,
      code,
      title: input.title,
      description: input.description,
      category: input.category,
      lineOfBusiness: input.lineOfBusiness,
      departmentId: input.departmentId,
      ownerId: input.ownerId,
      likelihoodInherent: input.likelihoodInherent,
      impactInherent: input.impactInherent,
      likelihoodResidual: input.likelihoodResidual,
      impactResidual: input.impactResidual,
      inherentScore: riskScore(input.likelihoodInherent, input.impactInherent),
      residualScore: riskScore(input.likelihoodResidual, input.impactResidual),
      treatment: input.treatment,
      status: input.status,
      trend: input.trend,
      emerging: input.emerging === "yes",
      strategicObjective: input.strategicObjective,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "CREATE",
    entityType: "RISK",
    entityId: risk.id,
    summary: `Added ${risk.code} ${risk.title}.`,
  });
  return NextResponse.json({ id: risk.id, code: risk.code });
}
