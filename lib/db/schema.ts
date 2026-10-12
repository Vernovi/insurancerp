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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
});

export const BOOTSTRAP_SQL = `
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
CREATE TABLE IF NOT EXISTS api_tokens (id serial PRIMARY KEY, name text NOT NULL, token_hash text NOT NULL, created_by integer, created_at timestamptz NOT NULL DEFAULT now(), revoked boolean NOT NULL DEFAULT false);
`;
