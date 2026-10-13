import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { loadTypes } from "@/lib/engine/registry";
import { deniedEntities } from "@/lib/engine/permissions";
import { addDays, reminderPlan, today } from "@/lib/engine/pure";

export const dynamic = "force-dynamic";

const FILINGS = new Set(["reg_return", "outsourcing_notice", "orsa", "rm_declaration", "fcr"]);

/** Daily reminders and escalations (PLT-12). Vercel Cron calls this with CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const db = await getDb();
  const types = await loadTypes();
  const finals = new Set(types.flatMap((t) => t.workflow.states.filter((s) => s.final).map((s) => `${t.key}:${s.key}`)));
  const t = today();
  const rows = await db.select().from(schema.records).where(and(isNotNull(schema.records.dueDate), lte(schema.records.dueDate, addDays(t, 90)), gte(schema.records.dueDate, addDays(t, -365))));
  const users = await db.select().from(schema.users).where(eq(schema.users.active, true));
  const entities = await db.select({ id: schema.entities.id, walled: schema.entities.walled }).from(schema.entities);
  const managerOf = new Map(users.map((u) => [u.id, u.managerId]));
  // Escalation goes to Compliance (Enterprise Assurance) and the CRO who can see the entity.
  const escalationFor = (entityId: number | null) =>
    users
      .filter((u) => (u.roles as string[]).some((r) => r === "compliance" || r === "cro"))
      .filter((u) => entityId === null || !deniedEntities(entities, (u.entityIds ?? []) as number[]).includes(entityId))
      .map((u) => u.id);
  const out: { userId: number; recordId: number; message: string }[] = [];
  for (const r of rows) {
    if (finals.has(`${r.typeKey}:${r.status}`) || !r.ownerId) continue;
    const label = types.find((x) => x.key === r.typeKey)?.label ?? "Record";
    const d = r.data as Record<string, unknown>;
    const plan = reminderPlan({ label, ref: r.ref, due: r.dueDate!, isReturn: FILINGS.has(r.typeKey), leadDays: typeof d.reminder_days === "number" ? d.reminder_days : null }, t);
    for (const p of plan) {
      if (p.to === "owner") out.push({ userId: r.ownerId, recordId: r.id, message: p.message });
      if (p.to === "manager") {
        const mgr = managerOf.get(r.ownerId);
        if (mgr) out.push({ userId: mgr, recordId: r.id, message: p.message });
      }
      if (p.to === "escalation") for (const id of escalationFor(r.entityId)) if (id !== r.ownerId) out.push({ userId: id, recordId: r.id, message: p.message });
    }
  }
  if (out.length) await db.insert(schema.notifications).values(out);
  await db.insert(schema.auditLog).values({ action: "cron_reminders", detail: { sent: out.length } });
  return NextResponse.json({ sent: out.length });
}
