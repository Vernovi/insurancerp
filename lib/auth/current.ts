import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { readSession, SESSION_COOKIE } from "./session";
import type { Role } from "../defs/types";
import { mfaMandatory } from "./totp";
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
  /** Walled entities this person has no access to. */
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
  // A session issued without a second factor stops working once MFA becomes mandatory.
  if (mfaMandatory({ roles: (u.roles ?? []) as string[], mfaRequired: u.mfaRequired }) && !s.mfa) return null;
  const entityIds = ((u.entityIds ?? []) as number[]).map(Number);
  const walled = await db.select({ id: schema.entities.id }).from(schema.entities).where(eq(schema.entities.walled, true));
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    title: u.title,
    roles: (u.roles ?? []) as Role[],
    orgUnitId: u.orgUnitId,
    managerId: u.managerId,
    entityIds,
    deniedEntities: deniedEntities(walled.map((w) => w.id), entityIds),
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
