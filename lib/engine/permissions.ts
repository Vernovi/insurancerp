import type { TypeDef, Role } from "../defs/types";

export interface PermUser {
  id: number;
  roles: Role[];
}
export interface PermRecord {
  ownerId: number | null;
  createdBy: number | null;
  confidential: boolean;
}

const has = (u: PermUser, roles: Role[] = []) => u.roles.includes("admin") || roles.some((r) => u.roles.includes(r));

export function canCreate(u: PermUser, def: TypeDef): boolean {
  return !def.createRoles || def.createRoles.length === 0 || has(u, def.createRoles);
}

export function isConfidential(def: TypeDef, data: Record<string, unknown>): boolean {
  const c = def.confidential;
  if (!c) return false;
  if (!c.whenField) return true;
  return (c.whenIn ?? []).includes(String(data[c.whenField]));
}

/** Confidential records are visible to their owner, creator and the type's named roles only. Admins do not see them by default. */
export function canView(u: PermUser, def: TypeDef, r: PermRecord): boolean {
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
