import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";

const schema = z.object({ campaignId: z.string().min(1) });

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (auth.session.role === "BOARD_VIEWER") return jsonError("Board viewers file declarations through the company secretary.", 403);
  const parsed = await readJson(request, schema);
  if (parsed.error) return parsed.error;
  const campaign = await prisma.declarationCampaign.findUnique({ where: { id: parsed.data.campaignId } });
  if (!campaign) return jsonError("Campaign not found.", 404);
  const existing = await prisma.declaration.findUnique({
    where: { campaignId_userId: { campaignId: campaign.id, userId: auth.session.id } },
  });
  if (existing) return NextResponse.json({ id: existing.id });
  const declaration = await prisma.declaration.create({
    data: {
      id: `dec-${campaign.id}-${auth.session.id}`,
      campaignId: campaign.id,
      userId: auth.session.id,
      type: campaign.type,
      status: "DRAFT",
      payload: "{}",
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "CREATE",
    entityType: "DECLARATION",
    entityId: declaration.id,
    summary: `Started ${campaign.name}.`,
  });
  return NextResponse.json({ id: declaration.id });
}
