import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireUser, hasRole } from "@/lib/auth/current";
import { getDb, schema } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { today } from "@/lib/engine/pure";
import ActionForm from "@/components/ActionForm";
import { createSnapshot } from "@/app/actions";

export default async function BoardPacks() {
  const user = await requireUser();
  const db = await getDb();
  const snaps = await db.select({ id: schema.snapshots.id, label: schema.snapshots.label, periodEnd: schema.snapshots.periodEnd, createdAt: schema.snapshots.createdAt }).from(schema.snapshots).orderBy(desc(schema.snapshots.createdAt));
  const t = today();
  const lastQuarterEnd = (() => {
    const y = Number(t.slice(0, 4));
    const m = Number(t.slice(5, 7));
    const q = Math.floor((m - 1) / 3);
    return q === 0 ? `${y - 1}-12-31` : `${y}-${["03-31", "06-30", "09-30"][q - 1]}`;
  })();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Board packs</h1>
        <p className="mt-1 max-w-2xl text-ink-2">A board pack freezes the risk register, KRIs, actions and board measures at a point in time, so what the committee read can always be reproduced, even after the live register changes.</p>
      </header>
      {hasRole(user, "risk", "cro") && (
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Freeze a new pack</h2>
          <ActionForm action={createSnapshot} className="mt-3 flex flex-wrap items-end gap-3" resetOnOk={false}>
            <label className="block text-sm"><span className="font-semibold">Name</span><input name="label" defaultValue={`Board Risk Committee pack, period to ${fmtDate(lastQuarterEnd)}`} className="field-input mt-1 w-96" /></label>
            <label className="block text-sm"><span className="font-semibold">Period end</span><input type="date" name="periodEnd" defaultValue={lastQuarterEnd} className="field-input mt-1" /></label>
            <button className="btn btn-primary">Freeze pack</button>
          </ActionForm>
        </section>
      )}
      <ul className="divide-y divide-line-2 rounded-md border border-line bg-surface">
        {snaps.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <Link href={`/board-pack/${s.id}`} className="font-semibold hover:text-accent hover:underline">{s.label}</Link>
            <span className="text-ink-3">Period end {fmtDate(s.periodEnd)}, frozen {fmtDateTime(s.createdAt)}</span>
          </li>
        ))}
        {snaps.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-2">No packs frozen yet.{hasRole(user, "risk", "cro") ? " Freeze the first one above." : ""}</li>}
      </ul>
    </div>
  );
}
