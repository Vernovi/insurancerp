import "server-only";
import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import { ROLES, type Role } from "./defs/types";
import { deniedEntities, type PermUser } from "./engine/permissions";

/**
 * A bearer token acts as the roles and entities chosen when it was created.
 * It is not an administrator, and an empty entity list grants nothing unless the token is group-wide.
 * Group-wide still hides walled entities. Records with no entity are visible only to group-wide tokens.
 */
export async function apiUser(req: Request): Promise<PermUser | null> {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(grc_[a-f0-9]{48})$/.exec(h.trim());
  if (!m) return null;
  const db = await getDb();
  const [t] = await db.select().from(schema.apiTokens).where(and(eq(schema.apiTokens.tokenHash, createHash("sha256").update(m[1]).digest("hex")), eq(schema.apiTokens.revoked, false)));
  if (!t) return null;
  const entities = await db.select({ id: schema.entities.id, walled: schema.entities.walled }).from(schema.entities);
  const entityIds = ((t.entityIds ?? []) as number[]).map(Number);
  const groupWide = t.groupWide === true;
  const roles = ((t.roles ?? []) as string[]).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  return {
    id: t.createdBy ?? 0,
    roles,
    entityIds: groupWide ? [] : entityIds,
    groupWide,
    deniedEntities: deniedEntities(entities, groupWide ? [] : entityIds),
  };
}
