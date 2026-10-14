import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { readSession, SESSION_COOKIE } from "./session";
import type { Role } from "../defs/types";
import { mfaMandatory } from "./totp";
import { getMfaPolicy } from "./policy";
import { deniedEntities } from "../engine/permissions";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  title: string | null;
  roles: Role[];
  orgUnitId: number | null;
  managerId: number | null;
  entityIds: number[];
  /** No entities ticked: every non-walled entity, and records with no entity. */
  groupWide: boolean;
  /** Entities outside this person's scope. */
  deniedEntities: number[];
  lineOfDefence: string | null;
  mfaEnabled: boolean;
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const s = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, s.uid));
  if (!u || !u.active || u.email !== s.em) return null;
  // Sign-out, a password change, deactivation or an MFA reset bumps the generation and ends every session.
  if ((u.sessionGen ?? 0) !== s.gen) return null;
  // A session issued without a second factor stops working once MFA becomes mandatory.
  if (mfaMandatory({ roles: (u.roles ?? []) as string[], mfaRequired: u.mfaRequired }, await getMfaPolicy()) && !s.mfa) return null;
  const entityIds = ((u.entityIds ?? []) as number[]).map(Number);
  const entities = await db.select({ id: schema.entities.id, walled: schema.entities.walled }).from(schema.entities);
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    title: u.title,
    roles: (u.roles ?? []) as Role[],
    orgUnitId: u.orgUnitId,
    managerId: u.managerId,
    entityIds,
    groupWide: entityIds.length === 0,
    deniedEntities: deniedEntities(entities, entityIds),
    lineOfDefence: u.lineOfDefence,
    mfaEnabled: u.mfaEnabled,
  };
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export function hasRole(u: SessionUser, ...roles: Role[]): boolean {
  return u.roles.includes("admin") || roles.some((r) => u.roles.includes(r));
}
