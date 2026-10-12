import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageCompliance, canManageRisks } from "@/lib/permissions";
import { evidenceSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManageCompliance(auth.session.role) && !canManageRisks(auth.session.role)) {
    return jsonError("Your role cannot add evidence.", 403);
  }
  const parsed = await readJson(request, evidenceSchema);
  if (parsed.error) return parsed.error;
  const evidence = await prisma.evidence.create({
    data: {
      id: `ev-${Date.now()}`,
      requirementId: parsed.data.requirementId,
      title: parsed.data.title,
      description: parsed.data.description,
      reference: parsed.data.reference,
      uploadedById: auth.session.id,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "CREATE",
    entityType: "REQUIREMENT",
    entityId: parsed.data.requirementId,
    summary: `Added evidence “${evidence.title}”.`,
  });
  return NextResponse.json({ id: evidence.id });
}
