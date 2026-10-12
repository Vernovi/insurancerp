import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { blankToNull, actionSchema } from "@/lib/schemas";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManageCompliance, canManageRisks } from "@/lib/permissions";
import { nextActionCode } from "@/server/codes";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManageRisks(auth.session.role) && !canManageCompliance(auth.session.role)) {
    return jsonError("Your role cannot open an action.", 403);
  }
  const parsed = await readJson(request, actionSchema);
  if (parsed.error) return parsed.error;
  const due = new Date(parsed.data.dueDate);
  if (Number.isNaN(due.getTime())) return jsonError("Enter a valid due date.");
  const code = await nextActionCode();
  const action = await prisma.actionItem.create({
    data: {
      id: code,
      code,
      title: parsed.data.title,
      description: parsed.data.description,
      sourceType: parsed.data.sourceType,
      riskId: blankToNull(parsed.data.riskId),
      findingId: blankToNull(parsed.data.findingId),
      requirementId: blankToNull(parsed.data.requirementId),
      ownerId: parsed.data.ownerId,
      dueDate: due,
      status: parsed.data.status ?? "OPEN",
      priority: parsed.data.priority,
      completedAt: parsed.data.status === "COMPLETED" ? new Date() : null,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "CREATE",
    entityType: "ACTION",
    entityId: action.id,
    summary: `Opened ${action.code} ${action.title}.`,
  });
  return NextResponse.json({ id: action.id });
}
