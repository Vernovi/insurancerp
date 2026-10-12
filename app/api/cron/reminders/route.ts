import { NextResponse } from "next/server";
import { and, gte, isNotNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { loadTypes } from "@/lib/engine/registry";
import { addDays, today } from "@/lib/engine/pure";

export const dynamic = "force-dynamic";

/** Daily reminders and escalations (PLT-12). Vercel Cron calls this with CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const db = await getDb();
  const types = await loadTypes();
  const finals = new Set(types.flatMap((t) => t.workflow.states.filter((s) => s.final).map((s) => `${t.key}:${s.key}`)));
  const t = today();
  const soon = addDays(t, 7);
  const rows = await db.select().from(schema.records).where(and(isNotNull(schema.records.dueDate), lte(schema.records.dueDate, soon), gte(schema.records.dueDate, addDays(t, -365))));
  const users = await db.select().from(schema.users);
  const managerOf = new Map(users.map((u) => [u.id, u.managerId]));
  const out: { userId: number; recordId: number; message: string }[] = [];
  for (const r of rows) {
    if (finals.has(`${r.typeKey}:${r.status}`) || !r.ownerId) continue;
    const label = types.find((x) => x.key === r.typeKey)?.label ?? "Record";
    const due = r.dueDate!;
    if (due === soon) out.push({ userId: r.ownerId, recordId: r.id, message: `${label} ${r.ref} is due in 7 days.` });
    else if (due === t) out.push({ userId: r.ownerId, recordId: r.id, message: `${label} ${r.ref} is due today.` });
    else if (due < t) {
      const days = Math.round((Date.parse(t) - Date.parse(due)) / 864e5);
      if (days === 1 || days % 7 === 0) {
        out.push({ userId: r.ownerId, recordId: r.id, message: `${label} ${r.ref} is ${days} ${days === 1 ? "day" : "days"} overdue.` });
        const mgr = managerOf.get(r.ownerId);
        if (mgr && days >= 7) out.push({ userId: mgr, recordId: r.id, message: `Escalation: ${label} ${r.ref} owned by your team is ${days} days overdue.` });
      }
    }
  }
  if (out.length) await db.insert(schema.notifications).values(out);
  await db.insert(schema.auditLog).values({ action: "cron_reminders", detail: { sent: out.length } });
  return NextResponse.json({ sent: out.length });
}
