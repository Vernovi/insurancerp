import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canReviewDeclarations } from "@/lib/permissions";
import { declarationSchema, reviewSchema } from "@/lib/schemas";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const declaration = await prisma.declaration.findUnique({
    where: { id },
    include: { campaign: { include: { policies: true } } },
  });
  if (!declaration) return jsonError("Declaration not found.", 404);
  if (declaration.userId !== auth.session.id && auth.session.role !== "ADMIN") {
    return jsonError("You can edit only your own declaration.", 403);
  }
  const parsed = await readJson(request, declarationSchema);
  if (parsed.error) return parsed.error;
  if (declaration.type === "CODE_OF_CONDUCT" && parsed.data.acknowledge !== "yes") {
    return jsonError("Confirm that you have read the code of conduct.");
  }
  if (declaration.type === "CODE_OF_CONDUCT") {
    const policyIds = declaration.campaign.policies.map((row) => row.policyId);
    const attestations = await prisma.policyAttestation.findMany({
      where: { userId: declaration.userId, policyId: { in: policyIds } },
    });
    const pending = policyIds.filter((policyId) => !attestations.some((row) => row.policyId === policyId && row.status === "ATTESTED"));
    if (pending.length) return jsonError("Attest the linked policies before submitting this declaration.");
    await prisma.policyAttestation.updateMany({
      where: { userId: declaration.userId, policyId: { in: policyIds } },
      data: { declarationId: declaration.id },
    });
  }
  await prisma.declaration.update({
    where: { id },
    data: {
      payload: JSON.stringify(parsed.data),
      status: "SUBMITTED",
      submittedAt: new Date(),
      reviewNotes: null,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "SUBMIT",
    entityType: "DECLARATION",
    entityId: id,
    summary: `Submitted ${declaration.type.replaceAll("_", " ").toLowerCase()} declaration.`,
  });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canReviewDeclarations(auth.session.role)) return jsonError("Your role cannot review declarations.", 403);
  const { id } = await context.params;
  const parsed = await readJson(request, reviewSchema);
  if (parsed.error) return parsed.error;
  const declaration = await prisma.declaration.findUnique({ where: { id } });
  if (!declaration) return jsonError("Declaration not found.", 404);
  if (declaration.status !== "SUBMITTED") return jsonError("Only a submitted declaration can be reviewed.");
  const status = parsed.data.decision === "APPROVE" ? "APPROVED" : "RETURNED";
  await prisma.declaration.update({
    where: { id },
    data: {
      status,
      reviewedById: auth.session.id,
      reviewedAt: new Date(),
      reviewNotes: parsed.data.notes,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: status,
    entityType: "DECLARATION",
    entityId: id,
    summary: `${status === "APPROVED" ? "Approved" : "Returned"} the declaration. ${parsed.data.notes}`,
  });
  return NextResponse.json({ ok: true });
}
