import Link from "next/link";
import type { TypeDef } from "@/lib/defs/types";
import { displayValue, fmtDate } from "@/lib/format";
import { stateOf } from "@/lib/engine/registry";
import { today } from "@/lib/engine/pure";
import { Pill, Val } from "./Pill";

type Row = { id: number; ref: string; title: string; status: string; ownerId: number | null; dueDate: string | null; data: unknown; typeKey: string; entityId?: number | null };

export default function RecordTable({
  def,
  rows,
  users,
  units,
  entities,
  defs,
  showType = false,
  empty,
}: {
  def?: TypeDef;
  rows: Row[];
  users: Map<number, string>;
  units: Map<number, string>;
  entities?: Map<number, { code: string; name: string }>;
  defs?: Map<string, TypeDef>;
  showType?: boolean;
  empty?: React.ReactNode;
}) {
  if (rows.length === 0) return <div className="rounded-md border border-dashed border-line bg-surface p-8 text-center text-sm text-ink-2">{empty ?? "Nothing here yet."}</div>;
  const cols = def ? def.fields.filter((f) => f.list).slice(0, 5) : [];
  const t = today();
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Ref</th>
            <th scope="col">Title</th>
            {showType && <th scope="col">Type</th>}
            {entities && <th scope="col">Entity</th>}
            {cols.map((c) => (
              <th scope="col" key={c.key}>{c.label}</th>
            ))}
            <th scope="col">Owner</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const d = def ?? defs?.get(r.typeKey);
            const st = d ? stateOf(d, r.status) : { label: r.status, tone: "neutral" as const, final: false };
            const overdue = r.dueDate && r.dueDate < t && !(st as { final?: boolean }).final;
            const data = (r.data ?? {}) as Record<string, unknown>;
            return (
              <tr key={r.id}>
                <td className="whitespace-nowrap font-semibold text-ink-2">{r.ref}</td>
                <td className="min-w-[16rem]">
                  <Link href={`/records/${r.id}`} className="font-semibold text-ink hover:text-accent hover:underline">{r.title}</Link>
                  {overdue && <span className="ml-2 text-xs font-semibold text-bad">Overdue since {fmtDate(r.dueDate)}</span>}
                </td>
                {showType && <td className="whitespace-nowrap text-ink-2">{d?.label}</td>}
                {entities && <td className="whitespace-nowrap text-ink-2" title={r.entityId ? entities.get(r.entityId)?.name : "Group-wide"}>{r.entityId ? entities.get(r.entityId)?.code : "Group"}</td>}
                {cols.map((c) => (
                  <td key={c.key} className="whitespace-nowrap">
                    <Val v={displayValue(c, data[c.key], users, units)} />
                  </td>
                ))}
                <td className="whitespace-nowrap text-ink-2">{r.ownerId ? users.get(r.ownerId) : ""}</td>
                <td className="whitespace-nowrap"><Pill label={st.label} tone={st.tone} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
