import type { TypeDef, Role } from "../defs/types";

export interface PermUser {
  id: number;
  roles: Role[];
  /** Walled entities (e.g. a PFA or a bank) whose records this person may not see. */
  deniedEntities?: number[];
}
export interface PermRecord {
  ownerId: number | null;
  createdBy: number | null;
  confidential: boolean;
  entityId?: number | null;
}

const has = (u: PermUser, roles: Role[] = []) => u.roles.includes("admin") || roles.some((r) => u.roles.includes(r));

/** Walled entities a person is not a member of. */
export function deniedEntities(walled: number[], memberOf: number[]): number[] {
  const m = new Set(memberOf);
  return walled.filter((id) => !m.has(id));
}

/** Entity wall: records of a walled entity are visible only to that entity's people (plus the record's owner and creator). */
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
