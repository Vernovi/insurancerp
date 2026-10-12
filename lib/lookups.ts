import "server-only";
import { cache } from "react";
import { asc } from "drizzle-orm";
import { getDb, schema } from "./db";

export const loadUsers = cache(async () => {
  const db = await getDb();
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, title: schema.users.title, roles: schema.users.roles, active: schema.users.active, orgUnitId: schema.users.orgUnitId, managerId: schema.users.managerId })
    .from(schema.users)
    .orderBy(asc(schema.users.name));
});

export const loadOrgUnits = cache(async () => {
  const db = await getDb();
  return db.select().from(schema.orgUnits).orderBy(asc(schema.orgUnits.id));
});

export async function userMap(): Promise<Map<number, string>> {
  return new Map((await loadUsers()).map((u) => [u.id, u.name]));
}

export async function unitMap(): Promise<Map<number, string>> {
  return new Map((await loadOrgUnits()).map((u) => [u.id, u.name]));
}
