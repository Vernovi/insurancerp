import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, dbMode } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Unauthenticated liveness check: database reachable, schema and seed in place. Reveals no record data. */
export async function GET() {
  try {
    const db = await getDb();
    const seeded = (await db.execute(sql`SELECT 1 FROM app_settings WHERE key = 'seed_complete'`)).rows.length > 0;
    const [{ n }] = (await db.execute(sql`SELECT count(*)::int AS n FROM record_types`)).rows as { n: number }[];
    return NextResponse.json({ status: "ok", database: dbMode(), seeded, recordTypes: Number(n) });
  } catch {
    return NextResponse.json({ status: "error", database: dbMode() }, { status: 503 });
  }
}
