import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePolicies } from "@/lib/permissions";
import { decisionSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManagePolicies(auth.session.role)) return jsonError("Your role cannot move a policy through approval.", 403);
  const { id } = await context.params;
  const parsed = await readJson(request, decisionSchema);
  if (parsed.error) return parsed.error;
  const version = await prisma.policyVersion.findFirst({ where: { id: parsed.data.versionId, policyId: id } });
  if (!version) return jsonError("Version not found.", 404);

  if (parsed.data.decision === "SUBMIT") {
    if (version.status !== "DRAFT") return jsonError("Only a draft can be submitted.");
    await prisma.policyVersion.update({ where: { id: version.id }, data: { status: "SUBMITTED" } });
    await prisma.policy.update({ where: { id }, data: { status: "IN_REVIEW" } });
  } else if (parsed.data.decision === "APPROVE") {
    if (version.status !== "SUBMITTED" && version.status !== "DRAFT") {
      return jsonError("This version is not waiting for approval.");
    }
    await prisma.policyVersion.updateMany({
      where: { policyId: id, status: "APPROVED" },
      data: { status: "SUPERSEDED" },
    });
    await prisma.policyVersion.update({
      where: { id: version.id },
      data: { status: "APPROVED", approvedById: auth.session.id, approvedAt: new Date() },
    });
    await prisma.policy.update({
      where: { id },
      data: { status: "APPROVED", lastReviewDate: new Date() },
    });
  } else {
    await prisma.policyVersion.update({ where: { id: version.id }, data: { status: "REJECTED" } });
    const stillApproved = await prisma.policyVersion.count({ where: { policyId: id, status: "APPROVED" } });
    await prisma.policy.update({ where: { id }, data: { status: stillApproved ? "APPROVED" : "DRAFT" } });
  }

  await recordAudit({
    actor: auth.session,
    action: parsed.data.decision,
    entityType: "POLICY",
    entityId: id,
    summary: `${parsed.data.decision} version ${version.versionLabel}. ${parsed.data.notes ?? ""}`.trim(),
  });
  return NextResponse.json({ ok: true });
}
