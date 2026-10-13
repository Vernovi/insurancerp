import type { TypeDef, Role } from "../defs/types";

export interface PermUser {
  id: number;
  roles: Role[];
  /** Entities whose records this person may not see (see deniedEntities). */
  deniedEntities?: number[];
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

/** Entity scope: records of an entity outside the person's scope are visible only to the record's owner and creator. */
export function entityAllowed(u: PermUser, r: PermRecord): boolean {
  if (r.entityId === null || r.entityId === undefined) return true;
  if (!(u.deniedEntities ?? []).includes(r.entityId)) return true;
  return r.ownerId === u.id || r.createdBy === u.id;
}

/** Can this person file or move records into an entity? */
export function canUseEntity(u: PermUser, entityId: number | null | undefined): boolean {
  return entityId === null || entityId === undefined || !(u.deniedEntities ?? []).includes(entityId);
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
 * visible to their owner, creator and the type's named roles only. Admins do not see them by default.
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
