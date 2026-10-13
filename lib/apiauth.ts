import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { PermUser } from "./engine/permissions";

/** API tokens act as an administrator without confidential-wall roles, and outside every walled entity. */
export async function apiUser(req: Request): Promise<PermUser | null> {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(grc_[a-f0-9]{48})$/.exec(h.trim());
  if (!m) return null;
  const db = await getDb();
  const [t] = await db.select().from(schema.apiTokens).where(and(eq(schema.apiTokens.tokenHash, createHash("sha256").update(m[1]).digest("hex")), eq(schema.apiTokens.revoked, false)));
  if (!t) return null;
  const walled = await db.select({ id: schema.entities.id }).from(schema.entities).where(eq(schema.entities.walled, true));
  return { id: t.createdBy ?? 0, roles: ["admin"], deniedEntities: walled.map((w) => w.id) };
}
