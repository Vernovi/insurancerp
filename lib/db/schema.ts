import { pgTable, serial, text, integer, boolean, jsonb, timestamp, date, index } from "drizzle-orm/pg-core";

export const orgUnits = pgTable("org_units", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("division"),
  parentId: integer("parent_id"),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  title: text("title"),
  passwordHash: text("password_hash").notNull(),
  roles: jsonb("roles").$type<string[]>().notNull().default([]),
  orgUnitId: integer("org_unit_id"),
  managerId: integer("manager_id"),
  active: boolean("active").notNull().default(true),
  /** The entities this person may see (an allow-list). Empty means every non-walled entity, and records with no entity. */
  entityIds: jsonb("entity_ids").$type<number[]>().notNull().default([]),
  lineOfDefence: text("line_of_defence"),
  totpSecret: text("totp_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaRequired: boolean("mfa_required").notNull().default(false),
  /** Bumped on sign-out, password change, deactivation and MFA reset: every older session stops working. */
  sessionGen: integer("session_gen").notNull().default(0),
  mfaLastStep: integer("mfa_last_step"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const entities = pgTable("entities", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("subsidiary"),
  parentId: integer("parent_id"),
  business: text("business"),
  licence: text("licence"),
  regulators: jsonb("regulators").$type<string[]>().notNull().default([]),
  frameworks: jsonb("frameworks").$type<string[]>().notNull().default([]),
  /** Walled entities' records are hidden from people without access to the entity. */
  walled: boolean("walled").notNull().default(false),
  insurer: boolean("insurer").notNull().default(false),
  sort: integer("sort").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export const recordTypes = pgTable("record_types", {
  key: text("key").primaryKey(),
  module: text("module").notNull(),
  def: jsonb("def").notNull(),
  sort: integer("sort").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const records = pgTable(
  "records",
  {
    id: serial("id").primaryKey(),
    typeKey: text("type_key").notNull(),
    ref: text("ref").notNull().unique(),
    title: text("title").notNull(),
    status: text("status").notNull(),
    ownerId: integer("owner_id"),
    orgUnitId: integer("org_unit_id"),
    entityId: integer("entity_id"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    dueDate: date("due_date"),
    confidential: boolean("confidential").notNull().default(false),
    createdBy: integer("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    version: integer("version").notNull().default(1),
  },
  (t) => [index("records_type_idx").on(t.typeKey), index("records_owner_idx").on(t.ownerId)],
);

export const recordLinks = pgTable("record_links", {
  id: serial("id").primaryKey(),
  fromId: integer("from_id").notNull(),
  toId: integer("to_id").notNull(),
  kind: text("kind").notNull().default("related"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recordVersions = pgTable("record_versions", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull(),
  version: integer("version").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull(),
  ownerId: integer("owner_id"),
  data: jsonb("data").notNull(),
  changedBy: integer("changed_by"),
  changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  note: text("note"),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  recordId: integer("record_id").notNull(),
  authorId: integer("author_id"),
  channel: text("channel").notNull().default("internal"),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actorId: integer("actor_id"),
  action: text("action").notNull(),
  recordId: integer("record_id"),
  detail: jsonb("detail"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  recordId: integer("record_id"),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const snapshots = pgTable("snapshots", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  periodEnd: date("period_end").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  payload: jsonb("payload").notNull(),
});

export const counters = pgTable("counters", {
  typeKey: text("type_key").primaryKey(),
  n: integer("n").notNull().default(0),
});

export const apiTokens = pgTable("api_tokens", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  revoked: boolean("revoked").notNull().default(false),
  /** Roles the token acts as. Empty grants nothing. Never implied to be administrator. */
  roles: jsonb("roles").$type<string[]>().notNull().default([]),
  /** Allow-list. Ignored when groupWide is set. Empty and not group-wide grants no entities. */
  entityIds: jsonb("entity_ids").$type<number[]>().notNull().default([]),
  /** Every non-walled entity, and records with no entity. Walled entities stay hidden. */
  groupWide: boolean("group_wide").notNull().default(false),
});

/** Shared counters for sign-in lockout and request rate limits. One row per key, so it holds across serverless instances. */
export const authLimits = pgTable("auth_limits", {
  key: text("key").primaryKey(),
  n: integer("n").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const BOOTSTRAP_SQL = `
CREATE TABLE IF NOT EXISTS app_settings (key text PRIMARY KEY, value text NOT NULL);
INSERT INTO app_settings (key, value) VALUES ('session_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')) ON CONFLICT (key) DO NOTHING;
CREATE TABLE IF NOT EXISTS org_units (id serial PRIMARY KEY, name text NOT NULL, kind text NOT NULL DEFAULT 'division', parent_id integer);
CREATE TABLE IF NOT EXISTS users (id serial PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, title text, password_hash text NOT NULL, roles jsonb NOT NULL DEFAULT '[]', org_unit_id integer, manager_id integer, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS record_types (key text PRIMARY KEY, module text NOT NULL, def jsonb NOT NULL, sort integer NOT NULL DEFAULT 0, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS records (id serial PRIMARY KEY, type_key text NOT NULL, ref text NOT NULL UNIQUE, title text NOT NULL, status text NOT NULL, owner_id integer, org_unit_id integer, data jsonb NOT NULL DEFAULT '{}', due_date date, confidential boolean NOT NULL DEFAULT false, created_by integer, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), version integer NOT NULL DEFAULT 1);
CREATE INDEX IF NOT EXISTS records_type_idx ON records (type_key);
CREATE INDEX IF NOT EXISTS records_owner_idx ON records (owner_id);
CREATE TABLE IF NOT EXISTS record_links (id serial PRIMARY KEY, from_id integer NOT NULL, to_id integer NOT NULL, kind text NOT NULL DEFAULT 'related', created_by integer, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS record_links_from_idx ON record_links (from_id);
CREATE INDEX IF NOT EXISTS record_links_to_idx ON record_links (to_id);
CREATE TABLE IF NOT EXISTS record_versions (id serial PRIMARY KEY, record_id integer NOT NULL, version integer NOT NULL, title text NOT NULL, status text NOT NULL, owner_id integer, data jsonb NOT NULL, changed_by integer, changed_at timestamptz NOT NULL DEFAULT now(), note text);
CREATE INDEX IF NOT EXISTS record_versions_record_idx ON record_versions (record_id);
CREATE TABLE IF NOT EXISTS comments (id serial PRIMARY KEY, record_id integer NOT NULL, author_id integer, channel text NOT NULL DEFAULT 'internal', body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS audit_log (id serial PRIMARY KEY, actor_id integer, action text NOT NULL, record_id integer, detail jsonb, at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS notifications (id serial PRIMARY KEY, user_id integer NOT NULL, record_id integer, message text NOT NULL, read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS snapshots (id serial PRIMARY KEY, label text NOT NULL, period_end date NOT NULL, created_by integer, created_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS counters (type_key text PRIMARY KEY, n integer NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS entities (id serial PRIMARY KEY, code text NOT NULL UNIQUE, name text NOT NULL, kind text NOT NULL DEFAULT 'subsidiary', parent_id integer, business text, licence text, regulators jsonb NOT NULL DEFAULT '[]', frameworks jsonb NOT NULL DEFAULT '[]', walled boolean NOT NULL DEFAULT false, insurer boolean NOT NULL DEFAULT false, sort integer NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true);
ALTER TABLE records ADD COLUMN IF NOT EXISTS entity_id integer;
CREATE INDEX IF NOT EXISTS records_entity_idx ON records (entity_id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS entity_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS line_of_defence text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_required boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_last_step integer;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_gen integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS api_tokens (id serial PRIMARY KEY, name text NOT NULL, token_hash text NOT NULL, created_by integer, created_at timestamptz NOT NULL DEFAULT now(), revoked boolean NOT NULL DEFAULT false);
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS roles jsonb NOT NULL DEFAULT '[]';
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS entity_ids jsonb NOT NULL DEFAULT '[]';
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS group_wide boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS auth_limits (key text PRIMARY KEY, n integer NOT NULL, at timestamptz NOT NULL);
`;
