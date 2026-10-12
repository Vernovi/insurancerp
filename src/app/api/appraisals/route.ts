import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePerformance } from "@/lib/permissions";
import { appraisalSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManagePerformance(auth.session.role)) return jsonError("Your role cannot record an appraisal.", 403);
  const parsed = await readJson(request, appraisalSchema);
  if (parsed.error) return parsed.error;
  const count = await prisma.appraisal.count();
  const id = `APR-${String(count + 1).padStart(2, "0")}`;
  const appraisal = await prisma.appraisal.create({
    data: {
      id,
      userId: parsed.data.userId,
      reviewerId: auth.session.id,
      period: parsed.data.period,
      overallScore: parsed.data.overallScore,
      rating: parsed.data.rating,
      narrative: parsed.data.narrative,
      riskComplianceNote: parsed.data.riskComplianceNote,
      status: parsed.data.status ?? "COMPLETED",
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "CREATE",
    entityType: "APPRAISAL",
    entityId: appraisal.id,
    summary: `Recorded a ${parsed.data.period} appraisal.`,
  });
  return NextResponse.json({ id: appraisal.id });
}
