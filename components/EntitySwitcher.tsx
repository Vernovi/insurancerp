"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { setEntityScope } from "@/app/actions";

export default function EntitySwitcher({ entities, selected }: { entities: { id: number; code: string; name: string; walled: boolean }[]; selected: number | null }) {
  const path = usePathname();
  const sp = useSearchParams();
  const ref = useRef<HTMLFormElement>(null);
  const qs = sp.toString();
  return (
    <form ref={ref} action={setEntityScope} className="flex min-w-0 items-center gap-2">
      <input type="hidden" name="next" value={qs ? `${path}?${qs}` : path} />
      <label htmlFor="entity-scope" className="text-sm text-ink-2 whitespace-nowrap">Entity</label>
      <select id="entity-scope" name="entity" defaultValue={selected ? String(selected) : ""} onChange={() => ref.current?.requestSubmit()} className="field-input min-w-0 max-w-[16rem] py-1.5">
        <option value="">Whole group</option>
        {entities.map((e) => (
          <option key={e.id} value={e.id}>{e.name}{e.walled ? " (walled)" : ""}</option>
        ))}
      </select>
      <noscript><button className="btn btn-secondary">Apply</button></noscript>
    </form>
  );
}
