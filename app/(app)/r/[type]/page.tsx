import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { getTypeDef } from "@/lib/engine/registry";
import { canCreate } from "@/lib/engine/permissions";
import { listRecords } from "@/lib/engine/records";
import { userMap, unitMap } from "@/lib/lookups";
import { MODULES } from "@/lib/defs/types";
import RecordTable from "@/components/RecordTable";
import { entityMap, getScope } from "@/lib/scope";

type SP = { status?: string; q?: string; mine?: string; overdue?: string; open?: string; field?: string; value?: string };

export default async function ListPage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<SP> }) {
  const user = await requireUser();
  const { type } = await params;
  const sp = await searchParams;
  const def = await getTypeDef(type);
  if (!def) notFound();
  const scope = await getScope(user);
  const rows = await listRecords(user, type, { status: sp.status, q: sp.q, mine: sp.mine === "1", overdue: sp.overdue === "1", open: sp.open === "1", field: sp.field, value: sp.value, entityIds: scope.ids });
  const [users, units, ents] = await Promise.all([userMap(), unitMap(), entityMap()]);
  const mod = MODULES.find((m) => m.key === def.module)!;
  const qs = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const filtered = Object.values(sp).some(Boolean);
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/m/${mod.key}`} className="text-sm text-ink-3 hover:text-accent">{mod.label}</Link>
          <h1 className="text-2xl font-semibold tracking-tight">{def.plural}</h1>
          {def.description && <p className="mt-1 max-w-2xl text-ink-2">{def.description}</p>}
        </div>
        <div className="flex gap-2">
          <a href={`/api/export/${def.key}?${qs}`} className="btn btn-secondary">Export CSV</a>
          {canCreate(user, def) && <Link href={`/r/${def.key}/new`} className="btn btn-primary">New {def.label.toLowerCase()}</Link>}
        </div>
      </header>
      <form className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-3 text-sm">
        <label className="block">
          <span className="font-semibold">Search</span>
          <input name="q" defaultValue={sp.q} className="field-input mt-1 w-56" />
        </label>
        <label className="block">
          <span className="font-semibold">Status</span>
          <select name="status" defaultValue={sp.status ?? ""} className="field-input mt-1">
            <option value="">Any</option>
            {def.workflow.states.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" name="open" value="1" defaultChecked={sp.open === "1"} /> Open only</label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} /> Overdue</label>
        <label className="flex items-center gap-2 pb-2"><input type="checkbox" name="mine" value="1" defaultChecked={sp.mine === "1"} /> Mine</label>
        {sp.field && <input type="hidden" name="field" value={sp.field} />}
        {sp.value && <input type="hidden" name="value" value={sp.value} />}
        <button className="btn btn-secondary">Apply</button>
        {filtered && <Link href={`/r/${def.key}`} className="pb-2 text-accent hover:underline">Clear filters</Link>}
      </form>
      {sp.field && sp.value && <p className="text-sm text-ink-2">Showing records where {def.fields.find((f) => f.key === sp.field)?.label ?? sp.field} is &ldquo;{sp.value}&rdquo;.</p>}
      <p className="text-sm text-ink-3">{rows.length} {rows.length === 1 ? "record" : "records"}{scope.selected ? ` in ${scope.selected.name}` : " across the group"}</p>
      <RecordTable
        def={def}
        rows={rows}
        users={users}
        units={units}
        entities={ents}
        empty={filtered ? "No records match these filters." : canCreate(user, def) ? <>No {def.plural.toLowerCase()} yet. <Link className="text-accent underline" href={`/r/${def.key}/new`}>Create the first one</Link>.</> : "No records yet."}
      />
    </div>
  );
}
