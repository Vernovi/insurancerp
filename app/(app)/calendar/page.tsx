import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { listRecords } from "@/lib/engine/records";
import { loadTypes, stateOf } from "@/lib/engine/registry";
import { canCreate } from "@/lib/engine/permissions";
import { userMap } from "@/lib/lookups";
import { entityMap, getScope } from "@/lib/scope";
import { addDays, filingStatus, today } from "@/lib/engine/pure";
import { REGULATORS } from "@/lib/defs/modules";
import { fmtDate } from "@/lib/format";
import { Pill } from "@/components/Pill";

const FILING_TYPES = ["reg_return", "outsourcing_notice", "orsa", "rm_declaration", "fcr"];
const FINAL = new Set(["submitted", "published"]);

export default async function Calendar({ searchParams }: { searchParams: Promise<{ regulator?: string; view?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const scope = await getScope(user);
  const [rows, users, ents, types] = await Promise.all([listRecords(user, FILING_TYPES, { entityIds: scope.ids, limit: 2000 }), userMap(), entityMap(), loadTypes()]);
  const defs = new Map(types.map((t) => [t.key, t]));
  const t = today();
  const regOf = (r: (typeof rows)[number]) => {
    const d = r.data as Record<string, unknown>;
    return String(d.regulator ?? (["orsa", "rm_declaration", "fcr"].includes(r.typeKey) ? "NAICOM" : ""));
  };
  const filtered = rows.filter((r) => !sp.regulator || regOf(r) === sp.regulator);
  const open = filtered.filter((r) => !FINAL.has(r.status) && r.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const filed = filtered.filter((r) => FINAL.has(r.status)).sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
  const overdue = open.filter((r) => r.dueDate! < t);
  const soon = open.filter((r) => r.dueDate! >= t && r.dueDate! <= addDays(t, 30));
  const later = open.filter((r) => r.dueDate! > addDays(t, 30));
  const byMonth = new Map<string, typeof later>();
  for (const r of later) {
    const k = r.dueDate!.slice(0, 7);
    byMonth.set(k, [...(byMonth.get(k) ?? []), r]);
  }
  const retDef = defs.get("reg_return");
  const showFiled = sp.view === "filed";

  const table = (list: typeof rows, empty: string) =>
    list.length === 0 ? (
      <p className="rounded-md border border-dashed border-line bg-surface p-4 text-sm text-ink-2">{empty}</p>
    ) : (
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Due</th>
              <th scope="col">Filing</th>
              <th scope="col">Entity</th>
              <th scope="col">Regulator</th>
              <th scope="col">Owner</th>
              <th scope="col">Stage</th>
              <th scope="col">Filing status</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const d = r.data as Record<string, unknown>;
              const def = defs.get(r.typeKey)!;
              const st = stateOf(def, r.status);
              const fs = filingStatus(r.dueDate, (d.submitted_date as string) || (d.published_date as string) || null, t);
              const daysLate = fs === "Overdue" ? Math.round((Date.parse(t) - Date.parse(r.dueDate!)) / 864e5) : 0;
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap font-semibold">{fmtDate(r.dueDate)}</td>
                  <td className="min-w-[16rem]">
                    <Link href={`/records/${r.id}`} className="font-semibold hover:text-accent hover:underline">{r.title}</Link>
                    <p className="text-xs text-ink-3">{r.ref} &middot; {def.label}{d.legal_basis ? ` · ${d.legal_basis}` : ""}</p>
                  </td>
                  <td className="whitespace-nowrap text-ink-2" title={r.entityId ? ents.get(r.entityId)?.name : "Group-wide"}>{r.entityId ? ents.get(r.entityId)?.code : "Group"}</td>
                  <td className="whitespace-nowrap">{regOf(r)}</td>
                  <td className="whitespace-nowrap text-ink-2">{r.ownerId ? users.get(r.ownerId) : ""}</td>
                  <td className="whitespace-nowrap"><Pill label={st.label} tone={st.tone} /></td>
                  <td className="whitespace-nowrap">
                    {fs && <Pill label={fs === "Overdue" ? `Overdue ${daysLate} ${daysLate === 1 ? "day" : "days"}` : fs} tone={fs === "Overdue" || fs === "Filed late" ? "bad" : fs === "Due soon" ? "warn" : fs === "Filed on time" ? "good" : "neutral"} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">{scope.selected ? scope.selected.name : "Whole group"}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Returns calendar</h1>
          <p className="mt-1 max-w-2xl text-ink-2">Never miss a filing. Every return, ORSA, declaration and outsourcing notice per entity and regulator. Owners are reminded 14, 7 and 1 days before; Enterprise Assurance and the CRO are alerted the day after a due date passes.</p>
        </div>
        <div className="flex gap-2">
          {retDef && canCreate(user, retDef) && <Link href="/r/reg_return/new" className="btn btn-primary">New return</Link>}
        </div>
      </header>
      <form className="flex flex-wrap items-end gap-3 rounded-md border border-line bg-surface p-3 text-sm">
        <label className="block">
          <span className="font-semibold">Regulator</span>
          <select name="regulator" defaultValue={sp.regulator ?? ""} className="field-input mt-1">
            <option value="">All regulators</option>
            {REGULATORS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="font-semibold">Show</span>
          <select name="view" defaultValue={sp.view ?? ""} className="field-input mt-1">
            <option value="">Open filings</option>
            <option value="filed">Filed</option>
          </select>
        </label>
        <button className="btn btn-secondary">Apply</button>
      </form>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[["Overdue", overdue.length, overdue.length ? "text-bad" : ""], ["Due in 30 days", soon.length, soon.length ? "text-warn" : ""], ["Later", later.length, ""], ["Filed", filed.length, ""]].map(([l, n, c]) => (
          <div key={String(l)} className="rounded-md border border-line bg-surface p-3">
            <dt className="text-xs font-semibold text-ink-3">{l}</dt>
            <dd className={`text-2xl font-semibold ${c}`}>{n}</dd>
          </div>
        ))}
      </dl>
      {showFiled ? (
        <section><h2 className="text-base font-semibold">Filed</h2><div className="mt-2">{table(filed, "Nothing filed yet.")}</div></section>
      ) : (
        <>
          <section aria-labelledby="od-h"><h2 id="od-h" className="text-base font-semibold text-bad">Overdue</h2><div className="mt-2">{table(overdue, "Nothing overdue.")}</div></section>
          <section aria-labelledby="soon-h"><h2 id="soon-h" className="text-base font-semibold">Due in the next 30 days</h2><div className="mt-2">{table(soon, "Nothing due in the next 30 days.")}</div></section>
          {[...byMonth.entries()].map(([m, list]) => (
            <section key={m}><h2 className="text-base font-semibold">{fmtDate(`${m}-01`).replace(/^1 /, "")}</h2><div className="mt-2">{table(list, "")}</div></section>
          ))}
        </>
      )}
    </div>
  );
}
