import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const attestation = await prisma.policyAttestation.findUnique({
    where: { id },
    include: { policy: true },
  });
  if (!attestation) return jsonError("Attestation not found.", 404);
  const allowed = auth.session.id === attestation.userId || auth.session.role === "ADMIN" || auth.session.role === "COMPLIANCE_OFFICER";
  if (!allowed) return jsonError("You can only attest a policy assigned to you.", 403);
  await prisma.policyAttestation.update({
    where: { id },
    data: { status: "ATTESTED", attestedAt: new Date() },
  });
  await recordAudit({
    actor: auth.session,
    action: "ATTEST",
    entityType: "POLICY",
    entityId: attestation.policyId,
    summary: `${auth.session.name} attested ${attestation.policy.title}.`,
  });
  return NextResponse.json({ ok: true });
}
