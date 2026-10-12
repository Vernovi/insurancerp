import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageCompliance } from "@/lib/permissions";
import { assessmentSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManageCompliance(auth.session.role)) return jsonError("Your role cannot record an assessment.", 403);
  const parsed = await readJson(request, assessmentSchema);
  if (parsed.error) return parsed.error;
  const requirement = await prisma.requirement.findUnique({ where: { id: parsed.data.requirementId } });
  if (!requirement) return jsonError("Requirement not found.", 404);
  const assessment = await prisma.assessment.upsert({
    where: { requirementId_period: { requirementId: requirement.id, period: parsed.data.period } },
    create: {
      id: `assess-${requirement.id}-${parsed.data.period}`,
      requirementId: requirement.id,
      period: parsed.data.period,
      status: parsed.data.status,
      notes: parsed.data.notes,
      assessorId: auth.session.id,
      assessedAt: new Date(),
    },
    update: {
      status: parsed.data.status,
      notes: parsed.data.notes,
      assessorId: auth.session.id,
      assessedAt: new Date(),
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "ASSESS",
    entityType: "REQUIREMENT",
    entityId: requirement.id,
    summary: `Assessed ${requirement.code} as ${parsed.data.status} for ${parsed.data.period}.`,
  });
  return NextResponse.json({ id: assessment.id });
}
