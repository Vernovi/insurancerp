import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageRisks } from "@/lib/permissions";
import { controlSchema } from "@/lib/schemas";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManageRisks(auth.session.role)) return jsonError("Your role cannot update a control.", 403);
  const { id } = await context.params;
  const parsed = await readJson(request, controlSchema);
  if (parsed.error) return parsed.error;
  const control = await prisma.control.update({
    where: { id },
    data: { effectiveness: parsed.data.effectiveness, lastTestedAt: new Date() },
  });
  await recordAudit({
    actor: auth.session,
    action: "UPDATE",
    entityType: "CONTROL",
    entityId: id,
    summary: `Set ${control.code} effectiveness to ${control.effectiveness}.`,
  });
  return NextResponse.json({ ok: true });
}
