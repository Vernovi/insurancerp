import type { TypeDef, Role } from "../defs/types";

export interface PermUser {
  id: number;
  roles: Role[];
  /** Entities whose records this person may not see. For group-wide people this is the walled entities. */
  deniedEntities?: number[];
  /**
   * Allow-list. Empty means group-wide only when `groupWide` is true (or omitted): every non-walled
   * entity, plus records with no entity. A non-empty list is the only set of entities this person may see.
   */
  entityIds?: number[];
  /**
   * Set false for an API token with no entities ticked, so an empty list means no access.
   * Omitted, an empty `entityIds` still means group-wide, which is how people are stored.
   */
  groupWide?: boolean;
}
export interface PermRecord {
  ownerId: number | null;
  createdBy: number | null;
  confidential: boolean;
  entityId?: number | null;
}

const has = (u: PermUser, roles: Role[] = []) => u.roles.includes("admin") || roles.some((r) => u.roles.includes(r));

/**
 * Entities a person may not see. A non-empty membership is an allow-list: everything else is denied.
 * An empty membership means group-wide: every entity except the walled ones.
 */
export function deniedEntities(entities: { id: number; walled: boolean }[], memberOf: number[]): number[] {
  const m = new Set(memberOf);
  if (m.size > 0) return entities.filter((e) => !m.has(e.id)).map((e) => e.id);
  return entities.filter((e) => e.walled).map((e) => e.id);
}

/** Empty membership on a person. Tokens pass `groupWide: false` so an empty list grants nothing. */
export function isGroupWide(u: PermUser): boolean {
  if (typeof u.groupWide === "boolean") return u.groupWide;
  return (u.entityIds ?? []).length === 0;
}

/**
 * Entity scope. Group-wide people see every non-walled entity and records with no entity.
 * Everyone else sees only their allow-list. Owning or creating a row does not cross that line,
 * and a row with no entity is not on a subsidiary allow-list.
 */
export function entityAllowed(u: PermUser, r: { entityId?: number | null }): boolean {
  const entityId = r.entityId ?? null;
  if (entityId === null) return isGroupWide(u);
  if (isGroupWide(u)) return !(u.deniedEntities ?? []).includes(entityId);
  return (u.entityIds ?? []).includes(entityId);
}

/** Can this person file or move records into an entity? Null is the group-wide bucket. */
export function canUseEntity(u: PermUser, entityId: number | null | undefined): boolean {
  return entityAllowed(u, { entityId: entityId ?? null });
}

/**
 * When a caller omits the entity, file into their first allowed entity.
 * Group-wide callers, and an explicit null, stay on the group-wide bucket (null), which `canUseEntity` then accepts or refuses.
 */
export function defaultEntityId(u: PermUser): number | null {
  if (isGroupWide(u)) return null;
  return u.entityIds?.[0] ?? null;
}

export function canCreate(u: PermUser, def: TypeDef): boolean {
  return !def.createRoles || def.createRoles.length === 0 || has(u, def.createRoles);
}

export function isConfidential(def: TypeDef, data: Record<string, unknown>): boolean {
  const c = def.confidential;
  if (!c) return false;
  if (!c.whenField) return true;
  return (c.whenIn ?? []).includes(String(data[c.whenField]));
}

/**
 * Two walls apply: the entity wall, then the type's confidentiality wall. Confidential records are
 * visible to their owner, creator and the type's named roles only, and only inside an entity they may see.
 * Admins do not see confidential records by default.
 */
export function canView(u: PermUser, def: TypeDef, r: PermRecord): boolean {
  if (!entityAllowed(u, r)) return false;
  if (!r.confidential) return true;
  if (r.ownerId === u.id || r.createdBy === u.id) return true;
  return (def.confidential?.roles ?? []).some((role) => u.roles.includes(role));
}

export function canEdit(u: PermUser, def: TypeDef, r: PermRecord): boolean {
  if (!canView(u, def, r)) return false;
  if (r.ownerId === u.id || r.createdBy === u.id) return true;
  return has(u, def.editRoles ?? []);
}

/** Roles that may see confidential records of this type, for SQL filters. */
export function confidentialRoles(def: TypeDef): Role[] {
  return def.confidential?.roles ?? [];
}

/**
 * Entity to file a campaign child into for one person.
 * `undefined` means they share no in-scope entity with the launcher (skip them).
 * `null` means a group-wide row, which only a group-wide person can see.
 * When `recordEntityId` is set (a policy), the child stays on that entity and the person must be able to see it.
 */
export function campaignEntity(
  launcher: PermUser,
  targetEntityIds: number[],
  entities: { id: number; walled: boolean }[],
  recordEntityId?: number | null,
): number | null | undefined {
  const target: PermUser = {
    id: 0,
    roles: [],
    entityIds: targetEntityIds,
    groupWide: targetEntityIds.length === 0,
    deniedEntities: deniedEntities(entities, targetEntityIds),
  };
  if (recordEntityId !== undefined) {
    return entityAllowed(target, { entityId: recordEntityId }) ? recordEntityId : undefined;
  }
  const walled = new Set(entities.filter((e) => e.walled).map((e) => e.id));
  if (isGroupWide(launcher) && targetEntityIds.length === 0) return null;
  if (isGroupWide(launcher)) return targetEntityIds.find((id) => !walled.has(id));
  if (targetEntityIds.length === 0) return (launcher.entityIds ?? []).find((id) => !walled.has(id));
  return (launcher.entityIds ?? []).find((id) => targetEntityIds.includes(id));
}
