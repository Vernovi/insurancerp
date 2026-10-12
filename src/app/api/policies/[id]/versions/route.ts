import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePolicies } from "@/lib/permissions";
import { versionSchema } from "@/lib/schemas";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManagePolicies(auth.session.role)) return jsonError("Your role cannot draft a policy version.", 403);
  const { id } = await context.params;
  const parsed = await readJson(request, versionSchema);
  if (parsed.error) return parsed.error;
  const policy = await prisma.policy.findUnique({ where: { id } });
  if (!policy) return jsonError("Policy not found.", 404);
  const version = await prisma.policyVersion.create({
    data: {
      id: `${policy.id}-${parsed.data.versionLabel}`,
      policyId: policy.id,
      versionLabel: parsed.data.versionLabel,
      content: parsed.data.content,
      changeNotes: parsed.data.changeNotes,
      status: "DRAFT",
      authorId: auth.session.id,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "CREATE",
    entityType: "POLICY",
    entityId: policy.id,
    summary: `Drafted version ${version.versionLabel} of ${policy.code}.`,
  });
  return NextResponse.json({ id: version.id });
}
