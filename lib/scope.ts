import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { asc } from "drizzle-orm";
import { getDb, schema } from "./db";
import { entityAllowed, type PermUser } from "./engine/permissions";

export type Entity = typeof schema.entities.$inferSelect;
export const ENTITY_COOKIE = "grc_entity";

export const loadEntities = cache(async (): Promise<Entity[]> => {
  const db = await getDb();
  return db.select().from(schema.entities).orderBy(asc(schema.entities.sort), asc(schema.entities.id));
});

export async function entityMap(): Promise<Map<number, Entity>> {
  return new Map((await loadEntities()).map((e) => [e.id, e]));
}

export interface Scope {
  /** Entities this person may see (their own; group-wide people see every unwalled one). */
  visible: Entity[];
  /** The entity chosen in the switcher, or null for the whole group. */
  selected: Entity | null;
  /** For list filters: [selected.id] or null for all. */
  ids: number[] | null;
}

/** The entity switcher's current choice, limited to what the person can see. */
export async function getScope(user: PermUser): Promise<Scope> {
  const all = await loadEntities();
  const denied = new Set(user.deniedEntities ?? []);
  const visible = all.filter((e) => e.active && !denied.has(e.id));
  const raw = (await cookies()).get(ENTITY_COOKIE)?.value;
  const selected = visible.find((e) => String(e.id) === raw) ?? null;
  return { visible, selected, ids: selected ? [selected.id] : null };
}

/** Does a row fall inside the scope? Mirrors the entity wall for aggregate views that read rows directly. */
export function inScope(row: { entityId: number | null; ownerId?: number | null; createdBy?: number | null }, scope: Scope, user: PermUser): boolean {
  if (!entityAllowed(user, row)) return false;
  if (scope.selected) return row.entityId === scope.selected.id;
  return true;
}
