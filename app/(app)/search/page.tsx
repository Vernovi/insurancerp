import { requireUser } from "@/lib/auth/current";
import { listRecords } from "@/lib/engine/records";
import { loadTypes } from "@/lib/engine/registry";
import { userMap, unitMap } from "@/lib/lookups";
import RecordTable from "@/components/RecordTable";

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q } = await searchParams;
  const types = await loadTypes();
  const rows = q && q.trim().length >= 2 ? await listRecords(user, types.map((t) => t.key), { q: q.trim(), limit: 200 }) : [];
  const [users, units] = await Promise.all([userMap(), unitMap()]);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{q ? `Results for “${q}”` : "Search"}</h1>
      {(!q || q.trim().length < 2) && <p className="text-ink-2">Type at least two characters in the search box above.</p>}
      {q && q.trim().length >= 2 && <RecordTable rows={rows} users={users} units={units} defs={new Map(types.map((t) => [t.key, t]))} showType empty="No records match. Try a reference such as RSK-0004 or a word from the title." />}
    </div>
  );
}
