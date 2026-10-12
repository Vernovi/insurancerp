import Link from "next/link";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { getDb, schema } from "@/lib/db";
import { loadTypes } from "@/lib/engine/registry";
import { canView } from "@/lib/engine/permissions";
import { checkTransition } from "@/lib/engine/pure";
import { userMap, unitMap } from "@/lib/lookups";
import RecordTable from "@/components/RecordTable";

const APPROVAL_STATES = ["submitted", "pending_approval", "review", "ready_for_validation", "extension_requested", "compliance_review", "manager_review", "requested", "internal_review", "due_diligence", "planned", "prepared", "triaged", "reported", "findings", "in_preparation", "response_agreed"];

export default async function MyWork() {
  const user = await requireUser();
  const db = await getDb();
  const types = await loadTypes();
  const defs = new Map(types.map((t) => [t.key, t]));
  const [users, units] = await Promise.all([userMap(), unitMap()]);
  const finals = types.flatMap((t) => t.workflow.states.filter((s) => s.final).map((s) => s.key));

  const mine = await db.select().from(schema.records).where(and(eq(schema.records.ownerId, user.id), notInArray(schema.records.status, [...new Set(finals)])));
  const byType = (k: string[]) => mine.filter((r) => k.includes(r.typeKey)).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));

  const candidates = await db
    .select()
    .from(schema.records)
    .where(inArray(schema.records.status, APPROVAL_STATES));
  const awaiting = candidates.filter((r) => {
    const d = defs.get(r.typeKey);
    if (!d || !canView(user, d, r)) return false;
    return d.workflow.transitions.some(
      (t) =>
        t.from.includes(r.status) &&
        (t.roles ?? []).length > 0 &&
        (t.roles ?? []).some((role) => user.roles.includes(role)) &&
        checkTransition(d, { status: r.status, ownerId: r.ownerId, createdBy: r.createdBy, data: r.data as Record<string, unknown> }, t, user, "x", true) === null,
    );
  });

  const blocks: { title: string; rows: typeof mine; empty: string; note?: string }[] = [
    { title: "Waiting for your approval or review", rows: awaiting, empty: "Nothing is waiting for you to approve.", note: "Records at a stage your role signs off, raised by someone else." },
    { title: "Policies to attest", rows: byType(["attestation"]), empty: "You are up to date with policy attestations." },
    { title: "Your declarations", rows: byType(["declaration"]), empty: "No declarations outstanding." },
    { title: "Your actions", rows: byType(["action"]), empty: "You have no open actions." },
    { title: "Your risks and controls", rows: byType(["risk", "control", "kri", "model"]), empty: "You don't own any open risks or controls." },
    { title: "Everything else you own", rows: mine.filter((r) => !["attestation", "declaration", "action", "risk", "control", "kri", "model"].includes(r.typeKey)), empty: "Nothing else." },
  ];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My work</h1>
        <p className="mt-1 text-ink-2">Everything you own or need to sign off, soonest due first. <Link href="/notifications" className="text-accent hover:underline">See notifications</Link>.</p>
      </header>
      {blocks.map((b) => (
        <section key={b.title}>
          <h2 className="text-base font-semibold">{b.title} <span className="font-normal text-ink-3">({b.rows.length})</span></h2>
          {b.note && <p className="text-sm text-ink-3">{b.note}</p>}
          <div className="mt-2"><RecordTable rows={b.rows} users={users} units={units} defs={defs} showType empty={b.empty} /></div>
        </section>
      ))}
    </div>
  );
}
