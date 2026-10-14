"use client";
import { useActionState, useState } from "react";
import type { FieldDef, TypeDef } from "@/lib/defs/types";
import type { ActionState } from "@/app/actions";

type Opt = { id: number; name: string };

const SCORE_LABELS: Record<string, string> = { likelihood: "1 rare · 5 almost certain", impact: "1 minor · 5 severe" };

function visible(f: FieldDef, data: Record<string, unknown>) {
  if (!f.showIf) return true;
  const v = data[f.showIf.field];
  const norm = v === undefined || v === null || v === "" ? (f.showIf.in.includes(false) ? false : v) : v;
  return f.showIf.in.includes(norm as string | boolean);
}

export default function RecordForm({
  def,
  action,
  values,
  users,
  units,
  entities,
  recordId,
  linkTo,
  submitLabel,
  defaultOwner,
  allowUnassigned = false,
}: {
  def: TypeDef;
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  values?: { title: string; ownerId: number | null; orgUnitId: number | null; entityId?: number | null; data: Record<string, unknown> };
  users: Opt[];
  units: Opt[];
  entities: Opt[];
  recordId?: number;
  linkTo?: { id: number; kind: string; label: string };
  submitLabel: string;
  defaultOwner: number;
  /** Group-wide people may file a record with no entity. An allow-list may not. */
  allowUnassigned?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const [data, setData] = useState<Record<string, unknown>>(values?.data ?? {});
  const set = (k: string, v: unknown) => setData((d) => ({ ...d, [k]: v }));

  const editable = def.fields.filter((f) => f.type !== "computed");
  const sections = [...new Set(editable.map((f) => f.section ?? "Details"))];

  const scorePreview = (f: FieldDef) => {
    if (f.type !== "score" || !f.key.endsWith("_impact")) return null;
    const base = f.key.replace(/_impact$/, "");
    const l = Number(data[`${base}_likelihood`]);
    const i = Number(data[f.key]);
    if (!l || !i) return null;
    const s = l * i;
    const band = s >= 15 ? "Critical" : s >= 10 ? "High" : s >= 5 ? "Medium" : "Low";
    return (
      <p className="mt-1 text-sm text-ink-2">
        Score <strong className="text-ink">{s}</strong> ({band})
      </p>
    );
  };

  const input = (f: FieldDef) => {
    const v = data[f.key];
    const common = { id: f.key, name: f.key, className: "field-input mt-1", disabled: f.readOnly };
    switch (f.type) {
      case "textarea":
        return <textarea {...common} rows={f.key === "body" ? 10 : 4} value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />;
      case "number":
      case "currency":
        return <input {...common} type="number" step="any" min={f.min} max={f.max} value={v === null || v === undefined ? "" : String(v)} onChange={(e) => set(f.key, e.target.value)} />;
      case "date":
        return <input {...common} type="date" value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />;
      case "select":
      case "score":
        return (
          <select {...common} value={v === null || v === undefined ? "" : String(v)} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">Choose</option>
            {(f.options ?? []).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        );
      case "user":
        return (
          <select {...common} value={v ? String(v) : ""} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">Nobody</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        );
      case "orgunit":
        return (
          <select {...common} value={v ? String(v) : ""} onChange={(e) => set(f.key, e.target.value)}>
            <option value="">None</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        );
      case "checkbox":
        return (
          <>
            <input type="hidden" name={`${f.key}__present`} value="1" />
            <input id={f.key} name={f.key} type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-accent)]" checked={v === true} onChange={(e) => set(f.key, e.target.checked)} />
          </>
        );
      case "multiselect": {
        const arr = Array.isArray(v) ? (v as string[]) : [];
        return (
          <div className="mt-1 grid gap-1 sm:grid-cols-2">
            <input type="hidden" name={`${f.key}__present`} value="1" />
            {(f.options ?? []).map((o) => (
              <label key={o} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={f.key} value={o} className="h-4 w-4 accent-[var(--color-accent)]" checked={arr.includes(o)} onChange={(e) => set(f.key, e.target.checked ? [...arr, o] : arr.filter((x) => x !== o))} />
                {o}
              </label>
            ))}
          </div>
        );
      }
      default:
        return <input {...common} type="text" value={(v as string) ?? ""} onChange={(e) => set(f.key, e.target.value)} />;
    }
  };

  return (
    <form action={run} className="space-y-6">
      <input type="hidden" name="__type" value={def.key} />
      {recordId && <input type="hidden" name="__id" value={recordId} />}
      {linkTo && (
        <>
          <input type="hidden" name="__linkTo" value={linkTo.id} />
          <input type="hidden" name="__linkKind" value={linkTo.kind} />
          <p className="rounded-md bg-accent-soft px-3 py-2 text-sm">This will be linked to {linkTo.label}.</p>
        </>
      )}
      <fieldset disabled={pending} className="space-y-6">
        <section className="rounded-md border border-line bg-surface p-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr_1fr]">
            <label className="block">
              <span className="text-sm font-semibold">Title</span>
              <input name="__title" required defaultValue={values?.title ?? ""} className="field-input mt-1" />
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Owner</span>
              <select name="__owner" defaultValue={String(values?.ownerId ?? defaultOwner)} className="field-input mt-1">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Entity</span>
              <select name="__entity" defaultValue={values?.entityId ? String(values.entityId) : allowUnassigned ? "" : entities[0] ? String(entities[0].id) : ""} className="field-input mt-1">
                {allowUnassigned && <option value="">Group-wide (no entity)</option>}
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Business unit</span>
              <select name="__orgUnit" defaultValue={values?.orgUnitId ? String(values.orgUnitId) : ""} className="field-input mt-1">
                <option value="">None</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
          </div>
        </section>
        {sections.map((s) => {
          const fs = editable.filter((f) => (f.section ?? "Details") === s && visible(f, data));
          if (fs.length === 0) return null;
          return (
            <section key={s} className="rounded-md border border-line bg-surface p-5">
              <h2 className="text-base font-semibold">{s}</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                {fs.map((f) => (
                  <div key={f.key} className={f.type === "textarea" || f.type === "multiselect" ? "md:col-span-2" : f.type === "checkbox" ? "md:col-span-2 flex items-start gap-2" : ""}>
                    {f.type === "checkbox" ? (
                      <>
                        {input(f)}
                        <label htmlFor={f.key} className="text-sm">{f.label}</label>
                      </>
                    ) : (
                      <>
                        <label htmlFor={f.key} className="text-sm font-semibold">
                          {f.label}
                          {f.required && <span className="text-bad"> *</span>}
                        </label>
                        {input(f)}
                        {f.type === "score" && <p className="mt-1 text-xs text-ink-3">{SCORE_LABELS[f.key.split("_").pop() ?? ""] ?? ""}</p>}
                        {scorePreview(f)}
                      </>
                    )}
                    {f.help && <p className="mt-1 text-xs text-ink-3">{f.help}</p>}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </fieldset>
      {state?.error && <p role="alert" className="rounded-md bg-bad-soft px-3 py-2 text-sm text-bad">{state.error}</p>}
      <div className="flex gap-3">
        <button className="btn btn-primary" disabled={pending}>{pending ? "Saving" : submitLabel}</button>
        <a href={recordId ? `/records/${recordId}` : `/r/${def.key}`} className="btn btn-secondary">Cancel</a>
      </div>
    </form>
  );
}
