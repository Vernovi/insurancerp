import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePolicies } from "@/lib/permissions";
import { policySchema } from "@/lib/schemas";
import { nextPolicyCode } from "@/server/codes";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManagePolicies(auth.session.role)) return jsonError("Your role cannot add a policy.", 403);
  const parsed = await readJson(request, policySchema);
  if (parsed.error) return parsed.error;
  const code = await nextPolicyCode();
  const review = new Date(parsed.data.nextReviewDate);
  if (Number.isNaN(review.getTime())) return jsonError("Enter a valid review date.");
  const policy = await prisma.policy.create({
    data: {
      id: code,
      code,
      title: parsed.data.title,
      category: parsed.data.category,
      summary: parsed.data.summary,
      ownerId: parsed.data.ownerId,
      status: "DRAFT",
      nextReviewDate: review,
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "CREATE",
    entityType: "POLICY",
    entityId: policy.id,
    summary: `Opened draft policy ${policy.code} ${policy.title}.`,
  });
  return NextResponse.json({ id: policy.id });
}
