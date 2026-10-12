import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageRisks } from "@/lib/permissions";
import { riskSchema } from "@/lib/schemas";
import { riskScore } from "@/lib/scoring";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManageRisks(auth.session.role)) return jsonError("Your role cannot edit the risk register.", 403);
  const { id } = await context.params;
  const parsed = await readJson(request, riskSchema);
  if (parsed.error) return parsed.error;
  const input = parsed.data;
  const existing = await prisma.risk.findUnique({ where: { id } });
  if (!existing) return jsonError("Risk not found.", 404);
  const risk = await prisma.risk.update({
    where: { id },
    data: {
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
    action: "UPDATE",
    entityType: "RISK",
    entityId: risk.id,
    summary: `Updated ${risk.code}. Residual score is now ${risk.residualScore}.`,
  });
  return NextResponse.json({ id: risk.id });
}
