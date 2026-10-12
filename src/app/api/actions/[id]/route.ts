import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageCompliance, canManageRisks } from "@/lib/permissions";

const schema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  note: z.string().trim().min(3),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const action = await prisma.actionItem.findUnique({ where: { id } });
  if (!action) return jsonError("Action not found.", 404);
  const manager = canManageRisks(auth.session.role) || canManageCompliance(auth.session.role);
  if (!manager && action.ownerId !== auth.session.id) {
    return jsonError("You can update only actions you own.", 403);
  }
  if (auth.session.role === "BOARD_VIEWER") return jsonError("Board viewers cannot update actions.", 403);
  const parsed = await readJson(request, schema);
  if (parsed.error) return parsed.error;
  await prisma.actionItem.update({
    where: { id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "UPDATE",
    entityType: "ACTION",
    entityId: id,
    summary: `Set ${action.code} to ${parsed.data.status}. ${parsed.data.note}`,
  });
  return NextResponse.json({ ok: true });
}
