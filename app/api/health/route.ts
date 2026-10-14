import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, dbMode } from "@/lib/db";
import { healthBody } from "@/lib/health";

export const dynamic = "force-dynamic";

/** Unauthenticated liveness check. Detail (including the last reminder run) needs CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authed = !!secret && req.headers.get("authorization") === `Bearer ${secret}`;
  try {
    const db = await getDb();
    if (!authed) {
      await db.execute(sql`SELECT 1`);
      const body = healthBody(true, false);
      return NextResponse.json(body.body, { status: body.status });
    }
    const seeded = (await db.execute(sql`SELECT 1 FROM app_settings WHERE key = 'seed_complete'`)).rows.length > 0;
    const [{ n }] = (await db.execute(sql`SELECT count(*)::int AS n FROM record_types`)).rows as { n: number }[];
    const last = (await db.execute(sql`SELECT max(at) AS at FROM audit_log WHERE action = 'cron_reminders'`)).rows as { at: string | Date | null }[];
    const at = last[0]?.at ? new Date(last[0].at).toISOString() : null;
    const body = healthBody(true, true, { database: dbMode(), seeded, recordTypes: Number(n), lastReminderRun: at });
    return NextResponse.json(body.body, { status: body.status });
  } catch {
    const body = healthBody(false, false);
    return NextResponse.json(body.body, { status: body.status });
  }
}
