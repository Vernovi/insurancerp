import "server-only";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type DB = NodePgDatabase<typeof schema>;

type Holder = { promise?: Promise<DB>; mode?: "postgres" | "embedded" };
const g = globalThis as unknown as { __grcDb?: Holder };
const holder: Holder = (g.__grcDb ??= {});

/** True when running against the embedded demo database (no DATABASE_URL). */
export function dbMode(): "postgres" | "embedded" {
  return process.env.DATABASE_URL ? "postgres" : "embedded";
}

async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  const { seedIfEmpty, syncRecordTypes } = await import("./seed");
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
    const db = drizzlePg(pool, { schema });
    // Serialise first-run bootstrap across concurrent serverless instances.
    const client = await pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(73191)");
      await client.query(schema.BOOTSTRAP_SQL);
      const clientDb = drizzlePg(client, { schema }) as unknown as DB;
      await syncRecordTypes(clientDb);
      await seedIfEmpty(clientDb);
    } finally {
      await client.query("SELECT pg_advisory_unlock(73191)").catch(() => {});
      client.release();
    }
    holder.mode = "postgres";
    return db;
  }
  // Embedded Postgres (PGlite). Persisted to ./.pglite locally; in-memory on Vercel.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzleLite } = await import("drizzle-orm/pglite");
  const dataDir = process.env.VERCEL ? undefined : process.env.PGLITE_DIR ?? "./.pglite";
  const client = dataDir ? new PGlite(dataDir) : new PGlite();
  await client.exec(schema.BOOTSTRAP_SQL);
  const db = drizzleLite(client, { schema }) as unknown as DB;
  await syncRecordTypes(db);
  await seedIfEmpty(db);
  holder.mode = "embedded";
  return db;
}

export function getDb(): Promise<DB> {
  if (!holder.promise) {
    holder.promise = connect().catch((e) => {
      holder.promise = undefined;
      throw e;
    });
  }
  return holder.promise;
}

export { schema };
