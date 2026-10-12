import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "../db";
import { readSession, SESSION_COOKIE } from "./session";
import type { Role } from "../defs/types";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  title: string | null;
  roles: Role[];
  orgUnitId: number | null;
  managerId: number | null;
}

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const s = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, s.uid));
  if (!u || !u.active) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    title: u.title,
    roles: (u.roles ?? []) as Role[],
    orgUnitId: u.orgUnitId,
    managerId: u.managerId,
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
