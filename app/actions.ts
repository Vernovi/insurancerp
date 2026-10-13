"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import { getCurrentUser, requireUser, hasRole } from "@/lib/auth/current";
import { signSession, signPending, readPending, SESSION_COOKIE, SESSION_MAX_AGE, MFA_COOKIE, MFA_MAX_AGE } from "@/lib/auth/session";
import { mfaMandatory, newSecret, verifyTotp } from "@/lib/auth/totp";
import { ENTITY_COOKIE } from "@/lib/scope";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  addComment,
  addLink,
  addReading,
  audit,
  createRecord,
  EngineError,
  removeLink,
  seedInsert,
  seedLink,
  transitionRecord,
  updateRecord,
} from "@/lib/engine/records";
import { getTypeDef, loadTypes } from "@/lib/engine/registry";
import { ROLES, type Role, type TypeDef } from "@/lib/defs/types";
import { today, addDays } from "@/lib/engine/pure";

export type ActionState = { error?: string; ok?: string } | undefined;

function fail(e: unknown): ActionState {
  if (e instanceof EngineError) return { error: e.message };
  if (e && typeof e === "object" && "digest" in e) throw e; // let redirects through
  console.error(e);
  return { error: "Something went wrong saving this change. Try again, and tell your administrator if it keeps happening." };
}

/** Collect form fields for a type definition, handling multi-selects and checkboxes. */
function rawFromForm(def: TypeDef, fd: FormData): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.type === "multiselect") {
      if (fd.has(`${f.key}__present`)) raw[f.key] = fd.getAll(f.key).map(String);
    } else if (f.type === "checkbox") {
      if (fd.has(`${f.key}__present`)) raw[f.key] = fd.get(f.key) === "on";
    } else if (fd.has(f.key)) {
      raw[f.key] = fd.get(f.key);
    }
  }
  return raw;
}

const intOrNull = (v: FormDataEntryValue | null) => (v && String(v).trim() ? Number(v) : null);

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

const attempts = new Map<string, { n: number; at: number }>();
const LOCK_AFTER = 5;
const LOCK_MS = 15 * 60_000;

function locked(key: string): boolean {
  const a = attempts.get(key);
  return !!a && a.n >= LOCK_AFTER && Date.now() - a.at < LOCK_MS;
}
function strike(key: string) {
  const a = attempts.get(key);
  attempts.set(key, { n: (a && Date.now() - a.at < LOCK_MS ? a.n : 0) + 1, at: Date.now() });
}
const safeNext = (v: unknown) => {
  const n = String(v ?? "/");
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/login") ? n : "/";
};
const cookieOpts = (maxAge: number) => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge });

async function startFullSession(u: { id: number; email: string }, mfa: boolean) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(u.id, u.email, mfa), cookieOpts(SESSION_MAX_AGE));
  jar.delete(MFA_COOKIE);
}

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  const key = `${ip}:${email}`;
  if (locked(key)) return { error: "Too many attempts. Wait 15 minutes and try again." };
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (!u || !u.active || !verifyPassword(password, u.passwordHash)) {
    strike(key);
    await audit(db, u?.id ?? null, "login_failed", null, { email });
    return { error: "That email and password don't match an active account." };
  }
  attempts.delete(key);
  const next = safeNext(fd.get("next"));
  const mandatory = mfaMandatory({ roles: (u.roles ?? []) as string[], mfaRequired: u.mfaRequired });
  if ((u.mfaEnabled && u.totpSecret) || mandatory) {
    const stage = u.mfaEnabled && u.totpSecret ? "verify" : "enrol";
    if (stage === "enrol") await db.update(schema.users).set({ totpSecret: newSecret(), mfaEnabled: false, mfaLastStep: null }).where(eq(schema.users.id, u.id));
    (await cookies()).set(MFA_COOKIE, await signPending(u.id, u.email, stage, next), cookieOpts(MFA_MAX_AGE));
    await audit(db, u.id, "login_password_ok", null, { mfa: stage });
    redirect("/login/mfa");
  }
  await startFullSession(u, false);
  await audit(db, u.id, "login", null);
  redirect(next);
}

/** Second step of sign-in: verify (or, for a first sign-in where MFA is required, enrol) an authenticator code. */
export async function verifyMfaLogin(_: ActionState, fd: FormData): Promise<ActionState> {
  const pending = await readPending((await cookies()).get(MFA_COOKIE)?.value);
  if (!pending) return { error: "Your sign-in has expired. Start again from the sign-in page." };
  const key = `mfa:${pending.uid}`;
  if (locked(key)) return { error: "Too many wrong codes. Wait 15 minutes and sign in again." };
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, pending.uid));
  if (!u || !u.active || u.email !== pending.em || !u.totpSecret) return { error: "Your sign-in has expired. Start again from the sign-in page." };
  if (pending.stage === "verify" && !u.mfaEnabled) return { error: "Your sign-in has expired. Start again from the sign-in page." };
  const step = verifyTotp(u.totpSecret, String(fd.get("code") ?? ""), Date.now(), u.mfaLastStep ?? null);
  if (step === null) {
    strike(key);
    await audit(db, u.id, "mfa_failed", null);
    return { error: "That code didn't work. Check your authenticator app shows the code for this account and try the newest one." };
  }
  attempts.delete(key);
  await db.update(schema.users).set({ mfaLastStep: step, mfaEnabled: true }).where(eq(schema.users.id, u.id));
  if (pending.stage === "enrol") await audit(db, u.id, "mfa_enrolled", null);
  await startFullSession(u, true);
  await audit(db, u.id, "login", null, { mfa: true });
  redirect(pending.next);
}

/** Start authenticator set-up from the person's own page. */
export async function startMfaSetup(): Promise<void> {
  const u = await requireUser();
  const db = await getDb();
  await db.update(schema.users).set({ totpSecret: newSecret(), mfaEnabled: false, mfaLastStep: null }).where(eq(schema.users.id, u.id));
  await audit(db, u.id, "mfa_setup_started", null);
  revalidatePath("/account");
}

export async function confirmMfaSetup(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  if (!u?.totpSecret) return { error: "Start set-up first." };
  const step = verifyTotp(u.totpSecret, String(fd.get("code") ?? ""), Date.now(), u.mfaLastStep ?? null);
  if (step === null) return { error: "That code didn't work. Enter the 6-digit code your app shows now." };
  await db.update(schema.users).set({ mfaEnabled: true, mfaLastStep: step }).where(eq(schema.users.id, u.id));
  await startFullSession(u, true);
  await audit(db, u.id, "mfa_enrolled", null);
  revalidatePath("/account");
  return { ok: "Two-step sign-in is on. You'll be asked for a code each time you sign in." };
}

export async function disableOwnMfa(): Promise<void> {
  const user = await requireUser();
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  if (!u || mfaMandatory({ roles: (u.roles ?? []) as string[], mfaRequired: u.mfaRequired })) return;
  await db.update(schema.users).set({ mfaEnabled: false, totpSecret: null, mfaLastStep: null }).where(eq(schema.users.id, u.id));
  await audit(db, u.id, "mfa_disabled", null);
  revalidatePath("/account");
}

/** Choose the entity the dashboards and registers are filtered to ("" for the whole group). */
export async function setEntityScope(fd: FormData) {
  await requireUser();
  const id = String(fd.get("entity") ?? "");
  const jar = await cookies();
  if (id) jar.set(ENTITY_COOKIE, id, { ...cookieOpts(60 * 60 * 24 * 30), httpOnly: false });
  else jar.delete(ENTITY_COOKIE);
  revalidatePath("/", "layout");
  redirect(safeNext(fd.get("next")));
}

export async function logout() {
  const u = await getCurrentUser();
  if (u) await audit(await getDb(), u.id, "logout", null);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(MFA_COOKIE);
  redirect("/login");
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export async function createRecordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const typeKey = String(fd.get("__type"));
  const def = await getTypeDef(typeKey);
  if (!def) return { error: "Unknown record type." };
  let id: number;
  try {
    const linkId = intOrNull(fd.get("__linkTo"));
    const rec = await createRecord(user, typeKey, {
      title: String(fd.get("__title") ?? ""),
      ownerId: intOrNull(fd.get("__owner")) ?? user.id,
      orgUnitId: intOrNull(fd.get("__orgUnit")),
      entityId: intOrNull(fd.get("__entity")),
      raw: rawFromForm(def, fd),
      linkTo: linkId ? { id: linkId, kind: String(fd.get("__linkKind") || "related") } : undefined,
    });
    id = rec.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/records/${id}`);
}

export async function updateRecordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = Number(fd.get("__id"));
  const typeKey = String(fd.get("__type"));
  const def = await getTypeDef(typeKey);
  if (!def) return { error: "Unknown record type." };
  try {
    await updateRecord(user, id, {
      title: String(fd.get("__title") ?? ""),
      ownerId: intOrNull(fd.get("__owner")),
      orgUnitId: intOrNull(fd.get("__orgUnit")),
      entityId: fd.has("__entity") ? intOrNull(fd.get("__entity")) : undefined,
      raw: rawFromForm(def, fd),
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/records/${id}`);
  redirect(`/records/${id}`);
}

export async function transitionAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  try {
    const label = await transitionRecord(user, id, String(fd.get("key")), String(fd.get("comment") ?? ""));
    revalidatePath(`/records/${id}`);
    return { ok: `Moved to ${label}.` };
  } catch (e) {
    return fail(e);
  }
}

export async function commentAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  const channel = fd.get("channel") === "reporter" ? "reporter" : "internal";
  try {
    await addComment(user, id, String(fd.get("body") ?? ""), channel);
    revalidatePath(`/records/${id}`);
    return { ok: channel === "reporter" ? "Message sent to the reporter." : "Comment added." };
  } catch (e) {
    return fail(e);
  }
}

export async function linkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  try {
    await addLink(user, id, String(fd.get("ref") ?? ""), String(fd.get("kind") ?? "related"));
    revalidatePath(`/records/${id}`);
    return { ok: "Linked." };
  } catch (e) {
    return fail(e);
  }
}

export async function unlinkAction(fd: FormData) {
  const user = await requireUser();
  await removeLink(user, Number(fd.get("linkId")));
  revalidatePath(`/records/${fd.get("id")}`);
}

export async function readingAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  try {
    await addReading(user, id, { date: String(fd.get("date")), value: Number(fd.get("value")), note: String(fd.get("note") ?? "") || undefined });
    revalidatePath(`/records/${id}`);
    return { ok: "Reading added." };
  } catch (e) {
    return fail(e);
  }
}

export async function markAllRead() {
  const user = await requireUser();
  const db = await getDb();
  await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.userId, user.id));
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// Campaigns (PLT-14): policy attestation and annual declarations
// ---------------------------------------------------------------------------

export async function launchAttestation(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!hasRole(user, "compliance")) return { error: "Only Compliance can launch attestation campaigns." };
  const policyId = Number(fd.get("id"));
  const db = await getDb();
  const [policy] = await db.select().from(schema.records).where(eq(schema.records.id, policyId));
  if (!policy || policy.typeKey !== "policy" || policy.status !== "published") return { error: "Only published policies can be sent for attestation." };
  const scope = String(fd.get("scope") ?? "all");
  const users = await db.select().from(schema.users).where(eq(schema.users.active, true));
  const existing = await db.execute(sql`
    select r.owner_id from records r join record_links l on (l.to_id = r.id and l.from_id = ${policyId})
    where r.type_key = 'attestation' and r.status = 'pending'`);
  const already = new Set((existing.rows as { owner_id: number }[]).map((r) => r.owner_id));
  const targets = users.filter((u) => !already.has(u.id) && (scope === "all" || (u.roles as string[]).includes(scope)) && !(u.roles as string[]).every((r) => r === "admin"));
  const version = String((policy.data as Record<string, unknown>).version ?? "");
  for (const u of targets) {
    const a = await seedInsert(db, "attestation", { title: `Attest: ${policy.title}`, ownerId: u.id, data: { policy_version: version, acknowledged: false } }, user.id, "pending");
    await seedLink(db, policyId, a.id, "attestation", user.id);
  }
  if (targets.length) {
    await db.insert(schema.notifications).values(targets.map((u) => ({ userId: u.id, recordId: policyId, message: `Please read and attest to ${policy.title} (v${version}).` })));
  }
  await audit(db, user.id, "campaign_attestation", policyId, { count: targets.length });
  revalidatePath(`/records/${policyId}`);
  return { ok: `Sent to ${targets.length} people.` };
}

export async function launchDeclarationCampaign(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!hasRole(user, "compliance")) return { error: "Only Compliance can launch declaration campaigns." };
  const year = String(fd.get("year") ?? today().slice(0, 4));
  const db = await getDb();
  const users = await db.select().from(schema.users).where(eq(schema.users.active, true));
  const title = `Annual declaration ${year}`;
  const existing = await db.select({ ownerId: schema.records.ownerId }).from(schema.records).where(and(eq(schema.records.typeKey, "declaration"), eq(schema.records.title, title)));
  const has = new Set(existing.map((e) => e.ownerId));
  const targets = users.filter((u) => !has.has(u.id) && !(u.roles as string[]).every((r) => r === "admin"));
  for (const u of targets) {
    await seedInsert(db, "declaration", { title, ownerId: u.id, orgUnitId: u.orgUnitId, data: { decl_type: "Annual conflict of interest declaration" } }, user.id, "draft");
  }
  if (targets.length) {
    await db.insert(schema.notifications).values(targets.map((u) => ({ userId: u.id, recordId: null, message: `Complete your ${title} by ${addDays(today(), 21)}.` })));
  }
  await audit(db, user.id, "campaign_declaration", null, { year, count: targets.length });
  revalidatePath("/r/declaration");
  return { ok: `Created ${targets.length} declarations for ${year}.` };
}

// ---------------------------------------------------------------------------
// Board pack snapshots (PLT-32, ERM-41)
// ---------------------------------------------------------------------------

export async function createSnapshot(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!hasRole(user, "risk", "cro")) return { error: "Only the risk team can freeze a board pack." };
  const db = await getDb();
  const periodEnd = String(fd.get("periodEnd") || today());
  const label = String(fd.get("label") || `Board pack ${periodEnd}`);
  const rows = await db.select().from(schema.records).where(inArray(schema.records.typeKey, ["risk", "kri", "action", "appetite", "objective", "loss_event", "emerging_risk"]));
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  const { boardKpis } = await import("@/lib/dashboard");
  const { getScope, inScope } = await import("@/lib/scope");
  const scope = await getScope(user);
  const kpis = await boardKpis(user, scope);
  const [s] = await db
    .insert(schema.snapshots)
    .values({
      label,
      periodEnd,
      createdBy: user.id,
      payload: {
        records: rows.filter((r) => !r.confidential && inScope(r, scope, user)).map((r) => ({ id: r.id, typeKey: r.typeKey, ref: r.ref, title: r.title, status: r.status, ownerId: r.ownerId, entityId: r.entityId, data: r.data, dueDate: r.dueDate })),
        entity: scope.selected ? { id: scope.selected.id, name: scope.selected.name } : null,
        users,
        kpis,
        takenAt: new Date().toISOString(),
      },
    })
    .returning();
  await audit(db, user.id, "snapshot", null, { id: s.id, label });
  redirect(`/board-pack/${s.id}`);
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const u = await requireUser();
  if (!u.roles.includes("admin")) throw new EngineError("Only administrators can do this.");
  return u;
}

export async function createUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const email = String(fd.get("email") ?? "").trim().toLowerCase();
    const name = String(fd.get("name") ?? "").trim();
    const password = String(fd.get("password") ?? "");
    const roles = fd.getAll("roles").map(String).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
    if (!email.includes("@") || !name) return { error: "Enter a name and a valid email." };
    if (password.length < 12) return { error: "Passwords must be at least 12 characters." };
    const db = await getDb();
    const entityIds = fd.getAll("entities").map(Number).filter(Number.isFinite);
    await db.insert(schema.users).values({ email, name, title: String(fd.get("title") ?? "") || null, passwordHash: hashPassword(password), roles: roles.length ? roles : ["staff"], orgUnitId: intOrNull(fd.get("orgUnit")), managerId: intOrNull(fd.get("manager")), entityIds, lineOfDefence: String(fd.get("lod") ?? "") || null, mfaRequired: fd.get("mfaRequired") === "on" });
    await audit(db, admin.id, "user_create", null, { email, roles });
    revalidatePath("/admin");
    return { ok: `Created ${name}.` };
  } catch (e) {
    if (String(e).includes("unique") || String((e as { cause?: unknown })?.cause).includes("unique")) return { error: "A user with that email already exists." };
    return fail(e);
  }
}

export async function updateUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = Number(fd.get("id"));
    const roles = fd.getAll("roles").map(String).filter((r) => (ROLES as readonly string[]).includes(r));
    const active = fd.get("active") === "on";
    if (id === admin.id && (!roles.includes("admin") || !active)) return { error: "You can't remove your own administrator access." };
    const db = await getDb();
    const entityIds = fd.getAll("entities").map(Number).filter(Number.isFinite);
    const mfaRequired = fd.get("mfaRequired") === "on";
    const resetMfa = fd.get("resetMfa") === "on";
    if (resetMfa && id === admin.id) return { error: "Ask another administrator to reset your own two-step sign-in." };
    await db.update(schema.users).set({ roles, active, entityIds, lineOfDefence: String(fd.get("lod") ?? "") || null, mfaRequired }).where(eq(schema.users.id, id));
    if (resetMfa) await db.update(schema.users).set({ totpSecret: null, mfaEnabled: false, mfaLastStep: null }).where(eq(schema.users.id, id));
    const pw = String(fd.get("password") ?? "");
    if (pw) {
      if (pw.length < 12) return { error: "Passwords must be at least 12 characters." };
      await db.update(schema.users).set({ passwordHash: hashPassword(pw) }).where(eq(schema.users.id, id));
    }
    await audit(db, admin.id, "user_update", null, { id, roles, active, entityIds, mfaRequired, mfaReset: resetMfa, passwordReset: !!pw });
    revalidatePath("/admin");
    return { ok: "Saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function saveTypeDefAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const key = String(fd.get("key"));
    let def: TypeDef & { customised?: boolean };
    try {
      def = JSON.parse(String(fd.get("json") ?? ""));
    } catch {
      return { error: "That isn't valid JSON. Check for a missing comma or quote." };
    }
    const err = validateTypeDef(def, key);
    if (err) return { error: err };
    def.customised = true;
    const db = await getDb();
    await db.update(schema.recordTypes).set({ def, updatedAt: new Date() }).where(eq(schema.recordTypes.key, key));
    await audit(db, admin.id, "config_update", null, { type: key });
    revalidatePath("/", "layout");
    return { ok: "Configuration saved. Forms and workflows now use it." };
  } catch (e) {
    return fail(e);
  }
}

export async function resetTypeDefAction(fd: FormData) {
  const admin = await requireAdmin();
  const key = String(fd.get("key"));
  const { DEFAULT_TYPES } = await import("@/lib/defs/modules");
  const def = DEFAULT_TYPES.find((t) => t.key === key);
  if (!def) return;
  const db = await getDb();
  await db.update(schema.recordTypes).set({ def, updatedAt: new Date() }).where(eq(schema.recordTypes.key, key));
  await audit(db, admin.id, "config_reset", null, { type: key });
  revalidatePath("/", "layout");
}

function validateTypeDef(def: TypeDef, key: string): string | null {
  if (!def || typeof def !== "object") return "Configuration must be an object.";
  if (def.key !== key) return `The "key" must stay "${key}".`;
  if (!def.label || !def.plural || !def.prefix) return "label, plural and prefix are required.";
  if (!Array.isArray(def.fields)) return "fields must be a list.";
  const keys = new Set<string>();
  for (const f of def.fields) {
    if (!f.key || !/^[a-z][a-z0-9_]*$/.test(f.key)) return `Field key "${f.key}" must be lower_snake_case.`;
    if (keys.has(f.key)) return `Field key "${f.key}" is used twice.`;
    keys.add(f.key);
    if (["select", "multiselect", "score"].includes(f.type) && !Array.isArray(f.options)) return `Field "${f.key}" needs options.`;
  }
  const states = new Set((def.workflow?.states ?? []).map((s) => s.key));
  if (!states.has(def.workflow?.initial)) return "workflow.initial must be one of the states.";
  for (const t of def.workflow.transitions ?? []) {
    if (!states.has(t.to)) return `Transition "${t.key}" goes to unknown state "${t.to}".`;
    for (const f of t.from) if (!states.has(f)) return `Transition "${t.key}" starts from unknown state "${f}".`;
    for (const r of t.requires ?? []) if (!keys.has(r)) return `Transition "${t.key}" requires unknown field "${r}".`;
  }
  return null;
}

export async function createApiTokenAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const name = String(fd.get("name") ?? "").trim() || "API token";
    const token = `grc_${randomBytes(24).toString("hex")}`;
    const db = await getDb();
    await db.insert(schema.apiTokens).values({ name, tokenHash: createHash("sha256").update(token).digest("hex"), createdBy: admin.id });
    await audit(db, admin.id, "api_token_create", null, { name });
    revalidatePath("/admin");
    return { ok: `Copy this token now; it won't be shown again: ${token}` };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeApiTokenAction(fd: FormData) {
  const admin = await requireAdmin();
  const db = await getDb();
  await db.update(schema.apiTokens).set({ revoked: true }).where(eq(schema.apiTokens.id, Number(fd.get("id"))));
  await audit(db, admin.id, "api_token_revoke", null, { id: Number(fd.get("id")) });
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Anonymous whistleblowing portal (PLT-24, CAS-02)
// ---------------------------------------------------------------------------

const keyHash = (k: string) => createHash("sha256").update(k.trim().toUpperCase()).digest("hex");

export async function portalSubmit(_: ActionState, fd: FormData): Promise<ActionState> {
  const description = String(fd.get("description") ?? "").trim();
  const subject = String(fd.get("subject") ?? "").trim() || "Concern raised through the anonymous portal";
  if (description.length < 20) return { error: "Describe your concern in a little more detail (at least 20 characters)." };
  if (String(fd.get("website") ?? "")) return { ok: "Thank you." }; // honeypot
  const db = await getDb();
  const caseKey = randomBytes(6).toString("hex").toUpperCase().match(/.{4}/g)!.join("-");
  const investigators = await db.select().from(schema.users).where(sql`${schema.users.roles} @> '["investigator"]'::jsonb`);
  const owner = investigators[0]?.id ?? null;
  const rec = await seedInsert(
    db,
    "case",
    {
      title: subject.slice(0, 200),
      ownerId: owner,
      data: { case_type: "Whistleblowing report", channel: "Anonymous portal", reported_date: today(), description, reporter_key_hash: keyHash(caseKey), category_hint: String(fd.get("category") ?? "") },
    },
    null,
    "reported",
  );
  if (owner) await db.insert(schema.notifications).values({ userId: owner, recordId: rec.id, message: `New anonymous report ${rec.ref}. Acknowledge within 7 days.` });
  await audit(db, null, "portal_report", rec.id);
  return { ok: caseKey };
}

export async function portalMessage(_: ActionState, fd: FormData): Promise<ActionState> {
  const key = String(fd.get("key") ?? "");
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { error: "Write a message first." };
  const db = await getDb();
  const [rec] = await db.select().from(schema.records).where(and(eq(schema.records.typeKey, "case"), sql`${schema.records.data}->>'reporter_key_hash' = ${keyHash(key)}`));
  if (!rec) return { error: "That case key wasn't recognised." };
  await db.insert(schema.comments).values({ recordId: rec.id, authorId: null, channel: "reporter", body: body.slice(0, 5000) });
  if (rec.ownerId) await db.insert(schema.notifications).values({ userId: rec.ownerId, recordId: rec.id, message: `The reporter replied on ${rec.ref}.` });
  revalidatePath("/portal/status");
  return { ok: "Message sent." };
}

export async function typesForCreate() {
  const u = await requireUser();
  return (await loadTypes()).filter((t) => !t.createRoles || t.createRoles.some((r) => hasRole(u, r)));
}

export async function saveEntityAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const admin = await requireAdmin();
    const id = Number(fd.get("id"));
    const list = (k: string) => String(fd.get(k) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
    const db = await getDb();
    await db
      .update(schema.entities)
      .set({ name: String(fd.get("name") ?? "").trim() || undefined, licence: String(fd.get("licence") ?? "") || null, regulators: list("regulators"), frameworks: list("frameworks"), walled: fd.get("walled") === "on" })
      .where(eq(schema.entities.id, id));
    await audit(db, admin.id, "entity_update", null, { id, walled: fd.get("walled") === "on" });
    revalidatePath("/", "layout");
    return { ok: "Entity saved." };
  } catch (e) {
    return fail(e);
  }
}
