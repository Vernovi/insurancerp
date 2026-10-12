import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageRisks } from "@/lib/permissions";
import { escalateSchema } from "@/lib/schemas";
import { appetitePosition } from "@/lib/scoring";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManageRisks(auth.session.role)) return jsonError("Your role cannot escalate a risk.", 403);
  const { id } = await context.params;
  const parsed = await readJson(request, escalateSchema);
  if (parsed.error) return parsed.error;
  const risk = await prisma.risk.findUnique({ where: { id } });
  if (!risk) return jsonError("Risk not found.", 404);
  const limit = await prisma.riskAppetiteLimit.findUnique({ where: { category: risk.category } });
  const position = appetitePosition(risk.residualScore, limit?.maxResidualScore ?? 25);
  if (position !== "ABOVE") return jsonError("Only a risk above appetite can be escalated.");
  const status = parsed.data.decision === "ACKNOWLEDGE" ? "ACKNOWLEDGED" : "ESCALATED";
  await prisma.risk.update({
    where: { id },
    data: {
      escalationStatus: status,
      escalationNote: parsed.data.note,
      escalatedAt: new Date(),
      escalatedById: auth.session.id,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: status === "ACKNOWLEDGED" ? "ACKNOWLEDGE" : "ESCALATE",
    entityType: "RISK",
    entityId: id,
    summary: `${status === "ACKNOWLEDGED" ? "Acknowledged" : "Escalated"} ${risk.code}: ${parsed.data.note}`,
  });
  return NextResponse.json({ ok: true });
}
