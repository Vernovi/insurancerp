import { prisma } from "./db";
import type { SessionUser } from "./session";

export async function recordAudit(input: {
  actor?: Pick<SessionUser, "id" | "name" | "role"> | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  detail?: unknown;
}): Promise<void> {
  await prisma.auditEvent.create({
    data: {
      actorId: input.actor?.id ?? null,
      actorName: input.actor?.name ?? "System",
      actorRole: input.actor?.role ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary,
      detail: input.detail === undefined ? null : JSON.stringify(input.detail),
    },
  });
}
