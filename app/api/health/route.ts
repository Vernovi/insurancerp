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
    const last = (await db.execute(sql`SELECT max(at) AS at FROM audit_log WHERE action = 'cron_reminders'`)).rows as { at: string | Date | null }[];
    const at = last[0]?.at ? new Date(last[0].at).toISOString() : null;
    return NextResponse.json({ status: "ok", database: dbMode(), seeded, recordTypes: Number(n), lastReminderRun: at });
  } catch {
    return NextResponse.json({ status: "error", database: dbMode() }, { status: 503 });
  }
}
