import "server-only";
import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema, type DB } from "../db";
import type { TypeDef, Role } from "../defs/types";
import { getTypeDef, loadTypes } from "./registry";
import { canCreate, canEdit, canUseEntity, canView, defaultEntityId, isConfidential, isGroupWide, type PermUser } from "./permissions";
import { checkTransition, coerceFields, fieldVisible, today } from "./pure";
import { after, compute, onTransition, type HookCtx, type HookRecord } from "./hooks";

export type RecordRow = typeof schema.records.$inferSelect;

import { EngineError } from "./errors";
export { EngineError };

function toHook(r: RecordRow): HookRecord {
  return {
    id: r.id,
    typeKey: r.typeKey,
    ref: r.ref,
    title: r.title,
    status: r.status,
    ownerId: r.ownerId,
    orgUnitId: r.orgUnitId,
    entityId: r.entityId ?? null,
    createdBy: r.createdBy,
    data: (r.data ?? {}) as Record<string, unknown>,
  };
}

async function nextRef(db: DB, def: TypeDef): Promise<string> {
  const res = await db.execute(
    sql`INSERT INTO counters (type_key, n) VALUES (${def.key}, 1) ON CONFLICT (type_key) DO UPDATE SET n = counters.n + 1 RETURNING n`,
  );
  const n = Number((res as unknown as { rows: { n: number }[] }).rows[0].n);
  return `${def.prefix}-${String(n).padStart(4, "0")}`;
}

export async function audit(db: DB, actorId: number | null, action: string, recordId: number | null, detail?: unknown) {
  await db.insert(schema.auditLog).values({ actorId, action, recordId, detail: (detail ?? null) as object | null });
}

async function writeVersion(db: DB, r: RecordRow, changedBy: number | null, note?: string) {
  await db.insert(schema.recordVersions).values({
    recordId: r.id,
    version: r.version,
    title: r.title,
    status: r.status,
    ownerId: r.ownerId,
    data: r.data as object,
    changedBy,
    note: note ?? null,
  });
}

async function notifyUsers(db: DB, userIds: (number | null | undefined)[], recordId: number | null, message: string) {
  const ids = [...new Set(userIds.filter((x): x is number => typeof x === "number"))];
  if (ids.length === 0) return;
  await db.insert(schema.notifications).values(ids.map((userId) => ({ userId, recordId, message })));
}

export async function usersWithRoles(db: DB, roles: Role[]): Promise<number[]> {
  if (roles.length === 0) return [];
  const all = await db.select({ id: schema.users.id, roles: schema.users.roles }).from(schema.users).where(eq(schema.users.active, true));
  return all.filter((u) => (u.roles ?? []).some((r) => roles.includes(r as Role))).map((u) => u.id);
}

/** Build the hook context. Depth limits cascades (a hook updating a record whose hook creates another...). */
function makeCtx(db: DB, actorId: number | null, depth: number): HookCtx {
  return {
    db,
    actorId,
    async createRecord(typeKey, input, linkTo) {
      const def = await getTypeDefFromDb(db, typeKey);
      const rec = await insertRecord(db, def, { ...input, orgUnitId: input.orgUnitId ?? null, entityId: input.entityId ?? null }, actorId, depth + 1, input.status);
      if (linkTo) await insertLink(db, linkTo.id, rec.id, linkTo.kind, actorId);
      return rec;
    },
    async patchRecord(id, patch, note) {
      if (depth > 3) return;
      await patchData(db, id, patch, actorId, note, depth + 1);
    },
    async linked(id, typeKey) {
      return (await linkedRecords(db, id, typeKey)).map((l) => toHook(l.record));
    },
    async createLink(fromId, toId, kind) {
      await insertLink(db, fromId, toId, kind, actorId);
    },
    async notifyUsers(ids, recordId, message) {
      await notifyUsers(db, ids, recordId, message);
    },
    async notifyRoles(roles, recordId, message) {
      await notifyUsers(db, await usersWithRoles(db, roles), recordId, message);
    },
  };
}

async function getTypeDefFromDb(db: DB, key: string): Promise<TypeDef> {
  const [row] = await db.select().from(schema.recordTypes).where(eq(schema.recordTypes.key, key));
  if (!row) throw new EngineError(`Unknown record type ${key}`);
  return row.def as TypeDef;
}

async function insertLink(db: DB, fromId: number, toId: number, kind: string, actorId: number | null) {
  if (fromId === toId) return;
  const existing = await db
    .select({ id: schema.recordLinks.id })
    .from(schema.recordLinks)
    .where(
      or(
        and(eq(schema.recordLinks.fromId, fromId), eq(schema.recordLinks.toId, toId)),
        and(eq(schema.recordLinks.fromId, toId), eq(schema.recordLinks.toId, fromId)),
      ),
    );
  if (existing.length) return;
  await db.insert(schema.recordLinks).values({ fromId, toId, kind, createdBy: actorId });
  await audit(db, actorId, "link", fromId, { toId, kind });
}

async function insertRecord(
  db: DB,
  def: TypeDef,
  input: { title: string; ownerId: number | null; orgUnitId: number | null; entityId?: number | null; data: Record<string, unknown> },
  actorId: number | null,
  depth: number,
  status?: string,
): Promise<HookRecord> {
  const ref = await nextRef(db, def);
  const { data, dueDate } = await compute(def, input.data, { db, entityId: input.entityId ?? null });
  const [row] = await db
    .insert(schema.records)
    .values({
      typeKey: def.key,
      ref,
      title: input.title.trim().slice(0, 300),
      status: status ?? def.workflow.initial,
      ownerId: input.ownerId,
      orgUnitId: input.orgUnitId,
      entityId: input.entityId ?? null,
      data,
      dueDate,
      confidential: isConfidential(def, data),
      createdBy: actorId,
    })
    .returning();
  await writeVersion(db, row, actorId, "Created");
  await audit(db, actorId, "create", row.id, { ref, type: def.key });
  if (depth <= 3) await after("create", def, toHook(row), null, makeCtx(db, actorId, depth), undefined);
  return toHook(row);
}

async function patchData(db: DB, id: number, patch: Record<string, unknown>, actorId: number | null, note: string, depth: number) {
  const [prev] = await db.select().from(schema.records).where(eq(schema.records.id, id));
  if (!prev) return;
  const def = await getTypeDefFromDb(db, prev.typeKey);
  const merged = { ...(prev.data as Record<string, unknown>), ...patch };
  const { data, dueDate } = await compute(def, merged, { db, createdAt: prev.createdAt, entityId: prev.entityId });
  const [row] = await db
    .update(schema.records)
    .set({ data, dueDate, updatedAt: new Date(), version: prev.version + 1, confidential: isConfidential(def, data) })
    .where(eq(schema.records.id, id))
    .returning();
  await writeVersion(db, row, actorId, note);
  await audit(db, actorId, "update", id, { note, fields: Object.keys(patch) });
  if (depth <= 3) await after("update", def, toHook(row), toHook(prev), makeCtx(db, actorId, depth), undefined);
}

// ---------------------------------------------------------------------------
// Public API used by server actions and the REST API
// ---------------------------------------------------------------------------

export interface RecordInput {
  title: string;
  ownerId: number | null;
  orgUnitId: number | null;
  /** Legal entity the record belongs to; undefined keeps the current one on update. */
  entityId?: number | null;
  raw: Record<string, unknown>;
  linkTo?: { id: number; kind: string };
  /** Skip the "you were made owner" notice. Campaigns send their own. */
  quiet?: boolean;
}

export async function createRecord(user: PermUser, typeKey: string, input: RecordInput): Promise<HookRecord> {
  const db = await getDb();
  const def = await getTypeDef(typeKey);
  if (!def) throw new EngineError("Unknown record type.");
  if (!canCreate(user, def)) throw new EngineError(`You don't have permission to create a ${def.label.toLowerCase()}.`);
  if (!input.title.trim()) throw new EngineError("Title is required.");
  const entityId = input.entityId === undefined ? defaultEntityId(user) : input.entityId;
  if (!canUseEntity(user, entityId)) throw new EngineError("You don't have access to that entity.");
  const { data, errors } = coerceFields(def.fields, input.raw);
  // Read-only display fields (for example the policy version on an attestation) are not on the form.
  // A caller that passes them in raw may set them on create; computed fields are left to the hook.
  for (const f of def.fields) {
    if (f.readOnly && f.type !== "computed" && input.raw[f.key] !== undefined && input.raw[f.key] !== "") data[f.key] = input.raw[f.key];
  }
  const missing = def.fields.filter((f) => f.required && !f.readOnly && fieldVisible(f, data) && f.type !== "checkbox" && (data[f.key] === null || data[f.key] === undefined || data[f.key] === ""));
  if (errors.length) throw new EngineError(errors.join(" "));
  if (missing.length) throw new EngineError(`Fill in: ${missing.map((f) => f.label).join(", ")}.`);
  const rec = await insertRecord(db, def, { title: input.title, ownerId: input.ownerId, orgUnitId: input.orgUnitId, entityId, data }, user.id, 0);
  if (input.linkTo) {
    const [target] = await db.select().from(schema.records).where(eq(schema.records.id, input.linkTo.id));
    if (target) await insertLink(db, input.linkTo.id, rec.id, input.linkTo.kind, user.id);
  }
  if (!input.quiet && rec.ownerId && rec.ownerId !== user.id && def.hook !== "action") {
    await notifyUsers(db, [rec.ownerId], rec.id, `You were made owner of ${rec.ref}: ${rec.title}.`);
  }
  return rec;
}

export async function updateRecord(user: PermUser, id: number, input: Omit<RecordInput, "linkTo">): Promise<void> {
  const db = await getDb();
  const [prev] = await db.select().from(schema.records).where(eq(schema.records.id, id));
  if (!prev) throw new EngineError("Record not found.");
  const def = await getTypeDef(prev.typeKey);
  if (!def) throw new EngineError("Unknown record type.");
  if (!canEdit(user, def, prev)) throw new EngineError("You don't have permission to edit this record.");
  const entityId = input.entityId === undefined ? prev.entityId : input.entityId;
  if (entityId !== prev.entityId && !canUseEntity(user, entityId)) throw new EngineError("You don't have access to that entity.");
  const { data: coerced, errors } = coerceFields(def.fields, input.raw);
  if (errors.length) throw new EngineError(errors.join(" "));
  const merged = { ...(prev.data as Record<string, unknown>), ...coerced };
  const { data, dueDate } = await compute(def, merged, { db, createdAt: prev.createdAt, entityId });
  const changed = Object.keys(coerced).filter((k) => JSON.stringify((prev.data as Record<string, unknown>)[k] ?? null) !== JSON.stringify(coerced[k] ?? null));
  if (prev.title !== input.title.trim()) changed.push("title");
  if (prev.ownerId !== input.ownerId) changed.push("owner");
  if (prev.orgUnitId !== input.orgUnitId) changed.push("org unit");
  if (prev.entityId !== entityId) changed.push("entity");
  const [row] = await db
    .update(schema.records)
    .set({
      title: input.title.trim().slice(0, 300) || prev.title,
      ownerId: input.ownerId,
      orgUnitId: input.orgUnitId,
      entityId,
      data,
      dueDate,
      confidential: isConfidential(def, data),
      updatedAt: new Date(),
      version: prev.version + 1,
    })
    .where(eq(schema.records.id, id))
    .returning();
  await writeVersion(db, row, user.id, changed.length ? `Edited: ${changed.join(", ")}` : "Saved");
  await audit(db, user.id, "update", id, { fields: changed });
  if (prev.ownerId !== row.ownerId && row.ownerId && row.ownerId !== user.id) {
    await notifyUsers(db, [row.ownerId], id, `You were made owner of ${row.ref}: ${row.title}.`);
  }
  await after("update", def, toHook(row), toHook(prev), makeCtx(db, user.id, 0), undefined);
}

export async function transitionRecord(user: PermUser, id: number, key: string, comment?: string): Promise<string> {
  const db = await getDb();
  const [prev] = await db.select().from(schema.records).where(eq(schema.records.id, id));
  if (!prev) throw new EngineError("Record not found.");
  const def = await getTypeDef(prev.typeKey);
  if (!def) throw new EngineError("Unknown record type.");
  if (!canView(user, def, prev)) throw new EngineError("Record not found.");
  const t = def.workflow.transitions.find((x) => x.key === key);
  if (!t) throw new EngineError("Unknown action.");
  const err = checkTransition(def, { status: prev.status, ownerId: prev.ownerId, createdBy: prev.createdBy, data: prev.data as Record<string, unknown> }, t, user, comment, canEdit(user, def, prev));
  if (err) throw new EngineError(err);
  const adj = onTransition(def, key, t.to, prev.data as Record<string, unknown>, user.id);
  const { data, dueDate } = await compute(def, adj.data, { db, createdAt: prev.createdAt, entityId: prev.entityId });
  const [row] = await db
    .update(schema.records)
    .set({ status: adj.to, data, dueDate, updatedAt: new Date(), version: prev.version + 1, confidential: isConfidential(def, data) })
    .where(eq(schema.records.id, id))
    .returning();
  const stateLabel = def.workflow.states.find((s) => s.key === adj.to)?.label ?? adj.to;
  await writeVersion(db, row, user.id, `${t.label} → ${stateLabel}`);
  await audit(db, user.id, "transition", id, { key, from: prev.status, to: adj.to });
  if (comment && comment.trim()) {
    await db.insert(schema.comments).values({ recordId: id, authorId: user.id, body: `${t.label}: ${comment.trim()}` });
  }
  if (row.ownerId && row.ownerId !== user.id) {
    await notifyUsers(db, [row.ownerId], id, `${row.ref} moved to "${stateLabel}" (${t.label}).`);
  }
  await after("transition", def, toHook(row), toHook(prev), makeCtx(db, user.id, 0), key);
  return stateLabel;
}

/** Append a dated reading to a KRI or ESG metric. */
export async function addReading(user: PermUser, id: number, reading: { date: string; value: number; note?: string }) {
  const db = await getDb();
  const [prev] = await db.select().from(schema.records).where(eq(schema.records.id, id));
  if (!prev) throw new EngineError("Record not found.");
  const def = await getTypeDef(prev.typeKey);
  if (!def || (def.hook !== "kri" && def.hook !== "esg_metric")) throw new EngineError("Readings are only for KRIs and ESG metrics.");
  if (!canView(user, def, prev)) throw new EngineError("Record not found.");
  if (!canEdit(user, def, prev) && !user.roles.includes("risk") && !user.roles.includes("esg")) throw new EngineError("You can't add readings to this record.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reading.date) || !Number.isFinite(reading.value)) throw new EngineError("Enter a date and a numeric value.");
  const readings = Array.isArray((prev.data as Record<string, unknown>).readings) ? [...((prev.data as Record<string, unknown>).readings as object[])] : [];
  readings.push({ date: reading.date, value: reading.value, note: reading.note ?? null, by: user.id });
  await patchData(db, id, { readings }, user.id, `Reading ${reading.value} for ${reading.date}`, 0);
}

export async function addLink(user: PermUser, fromId: number, toRef: string, kind: string) {
  const db = await getDb();
  const [from] = await db.select().from(schema.records).where(eq(schema.records.id, fromId));
  const [to] = await db.select().from(schema.records).where(eq(schema.records.ref, toRef.trim().toUpperCase()));
  if (!from || !to) throw new EngineError(`No record found with reference ${toRef}.`);
  const types = await loadTypes();
  const fd = types.find((t) => t.key === from.typeKey)!;
  const td = types.find((t) => t.key === to.typeKey)!;
  if (!canView(user, fd, from) || !canView(user, td, to)) throw new EngineError(`No record found with reference ${toRef}.`);
  await insertLink(db, fromId, to.id, kind || "related", user.id);
}

export async function removeLink(user: PermUser, linkId: number) {
  const db = await getDb();
  const [l] = await db.select().from(schema.recordLinks).where(eq(schema.recordLinks.id, linkId));
  if (!l) return;
  const [from] = await db.select().from(schema.records).where(eq(schema.records.id, l.fromId));
  const def = from ? await getTypeDef(from.typeKey) : undefined;
  if (!from || !def || !canEdit(user, def, from)) throw new EngineError("You can't remove this link.");
  await db.delete(schema.recordLinks).where(eq(schema.recordLinks.id, linkId));
  await audit(db, user.id, "unlink", l.fromId, { toId: l.toId });
}

export async function addComment(user: PermUser, recordId: number, body: string, channel: "internal" | "reporter" = "internal") {
  const db = await getDb();
  const [r] = await db.select().from(schema.records).where(eq(schema.records.id, recordId));
  const def = r ? await getTypeDef(r.typeKey) : undefined;
  if (!r || !def || !canView(user, def, r)) throw new EngineError("Record not found.");
  if (!body.trim()) throw new EngineError("Write a comment first.");
  await db.insert(schema.comments).values({ recordId, authorId: user.id, body: body.trim().slice(0, 5000), channel });
  await audit(db, user.id, channel === "reporter" ? "message_reporter" : "comment", recordId);
  const mentions = new Set<number>();
  if (r.ownerId && r.ownerId !== user.id) mentions.add(r.ownerId);
  await notifyUsers(db, [...mentions], recordId, `${user.id === r.ownerId ? "" : "New comment on "}${r.ref}: ${body.trim().slice(0, 80)}`);
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function linkedRecords(db: DB, id: number, typeKey?: string) {
  const links = await db
    .select()
    .from(schema.recordLinks)
    .where(or(eq(schema.recordLinks.fromId, id), eq(schema.recordLinks.toId, id)));
  if (links.length === 0) return [];
  const otherIds = links.map((l) => (l.fromId === id ? l.toId : l.fromId));
  const recs = await db.select().from(schema.records).where(inArray(schema.records.id, otherIds));
  return links
    .map((l) => {
      const otherId = l.fromId === id ? l.toId : l.fromId;
      const record = recs.find((r) => r.id === otherId);
      return record ? { linkId: l.id, kind: l.kind, outgoing: l.fromId === id, record } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x && (!typeKey || x.record.typeKey === typeKey));
}

/** SQL for the entity wall. Owning or creating a row does not widen it. Mirrors entityAllowed. */
export function entityScopeSql(user: PermUser): SQL {
  if (isGroupWide(user)) {
    const denied = user.deniedEntities ?? [];
    if (denied.length === 0) return sql`true`;
    return or(sql`${schema.records.entityId} is null`, sql`${schema.records.entityId} not in (${sql.join(denied.map((d) => sql`${d}`), sql`, `)})`)!;
  }
  const ids = user.entityIds ?? [];
  if (ids.length === 0) return sql`false`;
  return inArray(schema.records.entityId, ids);
}

/** SQL condition applying the entity wall and the confidentiality wall (mirrors canView). */
export async function visibilityFilter(user: PermUser): Promise<SQL> {
  const types = await loadTypes();
  const allowed = types.filter((t) => (t.confidential?.roles ?? []).some((r) => user.roles.includes(r))).map((t) => t.key);
  const mine = or(eq(schema.records.ownerId, user.id), eq(schema.records.createdBy, user.id))!;
  const conds: SQL[] = [eq(schema.records.confidential, false), mine];
  if (allowed.length) conds.push(inArray(schema.records.typeKey, allowed));
  return and(entityScopeSql(user), or(...conds)!)!;
}

export interface ListFilters {
  status?: string;
  q?: string;
  mine?: boolean;
  overdue?: boolean;
  open?: boolean;
  field?: string;
  value?: string;
  limit?: number;
  /** Restrict to these entities (the entity switcher). */
  entityIds?: number[] | null;
}

export async function listRecords(user: PermUser, typeKey: string | string[], f: ListFilters = {}) {
  const db = await getDb();
  const types = await loadTypes();
  const keys = Array.isArray(typeKey) ? typeKey : [typeKey];
  const conds: SQL[] = [inArray(schema.records.typeKey, keys), await visibilityFilter(user)];
  if (f.status) conds.push(eq(schema.records.status, f.status));
  if (f.mine) conds.push(eq(schema.records.ownerId, user.id));
  if (f.entityIds && f.entityIds.length) conds.push(inArray(schema.records.entityId, f.entityIds));
  if (f.q) {
    const like = `%${f.q.toLowerCase()}%`;
    conds.push(sql`(lower(${schema.records.title}) like ${like} or lower(${schema.records.ref}) like ${like} or lower(${schema.records.data}::text) like ${like})`);
  }
  if (f.field && f.value) conds.push(sql`${schema.records.data}->>${f.field} = ${f.value}`);
  const finals = types.flatMap((t) => (keys.includes(t.key) ? t.workflow.states.filter((s) => s.final).map((s) => `${t.key}:${s.key}`) : []));
  if (f.open || f.overdue) {
    if (finals.length) conds.push(sql`(${schema.records.typeKey} || ':' || ${schema.records.status}) not in (${sql.join(finals.map((x) => sql`${x}`), sql`, `)})`);
  }
  if (f.overdue) conds.push(sql`${schema.records.dueDate} < ${today()}`);
  return db
    .select()
    .from(schema.records)
    .where(and(...conds))
    .orderBy(desc(schema.records.updatedAt))
    .limit(f.limit ?? 500);
}

export async function getRecordForUser(user: PermUser, id: number) {
  const db = await getDb();
  const [r] = await db.select().from(schema.records).where(eq(schema.records.id, id));
  if (!r) return null;
  const def = await getTypeDef(r.typeKey);
  if (!def || !canView(user, def, r)) return null;
  if (r.confidential) await audit(db, user.id, "view_confidential", id);
  return { record: r, def };
}

export async function recordHistory(id: number) {
  const db = await getDb();
  return db.select().from(schema.recordVersions).where(eq(schema.recordVersions.recordId, id)).orderBy(desc(schema.recordVersions.version));
}

export async function recordComments(id: number) {
  const db = await getDb();
  return db.select().from(schema.comments).where(eq(schema.comments.recordId, id)).orderBy(schema.comments.createdAt);
}

export { canCreate, canEdit, canView };

// ---------------------------------------------------------------------------
// Seeding helpers. They take an explicit db so they can run during bootstrap.
// ---------------------------------------------------------------------------
export async function seedInsert(
  db: DB,
  typeKey: string,
  input: { title: string; ownerId: number | null; orgUnitId?: number | null; entityId?: number | null; data: Record<string, unknown> },
  actorId: number | null,
  status?: string,
): Promise<HookRecord> {
  const def = await getTypeDefFromDb(db, typeKey);
  return insertRecord(db, def, { ...input, orgUnitId: input.orgUnitId ?? null, entityId: input.entityId ?? null }, actorId, 99, status);
}

export async function seedLink(db: DB, fromId: number, toId: number, kind: string, actorId: number | null) {
  await insertLink(db, fromId, toId, kind, actorId);
}

export async function seedReading(db: DB, id: number, readings: { date: string; value: number }[]) {
  await patchData(db, id, { readings }, null, "Readings loaded", 99);
}
