import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageRisks } from "@/lib/permissions";
import { kriSchema } from "@/lib/schemas";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManageRisks(auth.session.role)) return jsonError("Your role cannot update a KRI.", 403);
  const { id } = await context.params;
  const parsed = await readJson(request, kriSchema);
  if (parsed.error) return parsed.error;
  const kri = await prisma.kri.update({
    where: { id },
    data: { currentValue: parsed.data.currentValue, measuredAt: new Date() },
  });
  await recordAudit({
    actor: auth.session,
    action: "UPDATE",
    entityType: "KRI",
    entityId: id,
    summary: `Updated ${kri.code} to ${kri.currentValue} ${kri.unit}.`,
  });
  return NextResponse.json({ ok: true });
}
