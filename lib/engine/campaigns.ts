import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "../db";
import type { Role } from "../defs/types";
import { addDays, today } from "./pure";
import { campaignEntity, type PermUser } from "./permissions";
import { audit, createRecord, getRecordForUser } from "./records";
import { EngineError } from "./errors";

function canLaunch(u: PermUser, role: Role): boolean {
  return u.roles.includes("admin") || u.roles.includes(role);
}

function isPureAdmin(roles: string[]): boolean {
  return roles.length > 0 && roles.every((r) => r === "admin");
}

/** Send a published policy for attestation, only to people who can see that policy's entity. */
export async function launchAttestationCampaign(user: PermUser, policyId: number, scope = "all"): Promise<string> {
  if (!canLaunch(user, "compliance")) throw new EngineError("Only Compliance can launch attestation campaigns.");
  const found = await getRecordForUser(user, policyId);
  if (!found || found.record.typeKey !== "policy") throw new EngineError("Record not found.");
  if (found.record.status !== "published") throw new EngineError("Only published policies can be sent for attestation.");
  const policy = found.record;
  const db = await getDb();
  const entities = await db.select({ id: schema.entities.id, walled: schema.entities.walled }).from(schema.entities);
  const users = await db.select().from(schema.users).where(eq(schema.users.active, true));
  const existing = await db.execute(sql`
    select r.owner_id from records r join record_links l on (l.to_id = r.id and l.from_id = ${policyId})
    where r.type_key = 'attestation' and r.status = 'pending'`);
  const already = new Set((existing.rows as { owner_id: number }[]).map((r) => r.owner_id));
  const version = String((policy.data as Record<string, unknown>).version ?? "");
  const targets = users.filter((u) => {
    const roles = (u.roles ?? []) as string[];
    if (already.has(u.id) || isPureAdmin(roles)) return false;
    if (scope !== "all" && !roles.includes(scope)) return false;
    return campaignEntity(user, (u.entityIds ?? []) as number[], entities, policy.entityId) !== undefined;
  });
  for (const u of targets) {
    const entityId = campaignEntity(user, (u.entityIds ?? []) as number[], entities, policy.entityId);
    if (entityId === undefined) continue;
    await createRecord(user, "attestation", {
      title: `Attest: ${policy.title}`,
      ownerId: u.id,
      orgUnitId: u.orgUnitId,
      entityId,
      raw: { policy_version: version, acknowledged: false },
      linkTo: { id: policyId, kind: "attestation" },
      quiet: true,
    });
  }
  if (targets.length) {
    await db.insert(schema.notifications).values(targets.map((u) => ({ userId: u.id, recordId: policyId, message: `Please read and attest to ${policy.title} (v${version}).` })));
  }
  await audit(db, user.id, "campaign_attestation", policyId, { count: targets.length });
  return `Sent to ${targets.length} people.`;
}

/** Draft annual declarations for people who share an entity with the launcher. A group-wide launcher does not reach walled-only people. */
export async function launchDeclarationCampaign(user: PermUser, year: string): Promise<string> {
  if (!canLaunch(user, "compliance")) throw new EngineError("Only Compliance can launch declaration campaigns.");
  const db = await getDb();
  const entities = await db.select({ id: schema.entities.id, walled: schema.entities.walled }).from(schema.entities);
  const users = await db.select().from(schema.users).where(eq(schema.users.active, true));
  const title = `Annual declaration ${year}`;
  const existing = await db.select({ ownerId: schema.records.ownerId }).from(schema.records).where(and(eq(schema.records.typeKey, "declaration"), eq(schema.records.title, title)));
  const has = new Set(existing.map((e) => e.ownerId));
  const notify: number[] = [];
  for (const u of users) {
    const roles = (u.roles ?? []) as string[];
    if (has.has(u.id) || isPureAdmin(roles)) continue;
    const entityId = campaignEntity(user, (u.entityIds ?? []) as number[], entities);
    if (entityId === undefined) continue;
    await createRecord(user, "declaration", {
      title,
      ownerId: u.id,
      orgUnitId: u.orgUnitId,
      entityId,
      raw: { decl_type: "Annual conflict of interest declaration" },
      quiet: true,
    });
    notify.push(u.id);
  }
  if (notify.length) {
    await db.insert(schema.notifications).values(notify.map((userId) => ({ userId, recordId: null, message: `Complete your ${title} by ${addDays(today(), 21)}.` })));
  }
  await audit(db, user.id, "campaign_declaration", null, { year, count: notify.length });
  return `Created ${notify.length} declarations for ${year}.`;
}
