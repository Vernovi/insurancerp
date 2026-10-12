import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { getTypeDef } from "@/lib/engine/registry";
import ActionForm from "@/components/ActionForm";
import { saveTypeDefAction, resetTypeDefAction } from "@/app/actions";
import { ROLES } from "@/lib/defs/types";

export default async function EditType({ params }: { params: Promise<{ key: string }> }) {
  const user = await requireUser();
  if (!user.roles.includes("admin")) return <p className="rounded-md bg-warn-soft p-4 text-warn">Only administrators can change configuration.</p>;
  const { key } = await params;
  const def = await getTypeDef(key);
  if (!def) notFound();
  return (
    <div className="space-y-5">
      <header>
        <Link href="/admin" className="text-sm text-ink-3 hover:text-accent">Settings</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Configure {def.plural.toLowerCase()}</h1>
        <p className="mt-1 max-w-3xl text-sm text-ink-2">
          Edit fields, options and workflow below. Field types: text, textarea, number, currency, date, select, multiselect, user, orgunit, checkbox, score, computed.
          Roles: {ROLES.join(", ")}. Changes are checked before saving and logged in the audit trail. Computed fields are set by the platform&apos;s rules and can&apos;t be typed into.
        </p>
      </header>
      <section className="grid gap-4 lg:grid-cols-3 text-sm">
        <div className="rounded-md border border-line bg-surface p-4">
          <h2 className="font-semibold">Fields</h2>
          <ul className="mt-2 space-y-0.5 text-ink-2">{def.fields.map((f) => <li key={f.key}>{f.label} <span className="text-ink-3">({f.type}{f.required ? ", required" : ""})</span></li>)}</ul>
        </div>
        <div className="rounded-md border border-line bg-surface p-4 lg:col-span-2">
          <h2 className="font-semibold">Workflow</h2>
          <p className="mt-1 text-ink-2">Stages: {def.workflow.states.map((s) => s.label).join(", ")}</p>
          <ul className="mt-2 space-y-0.5 text-ink-2">
            {def.workflow.transitions.map((t) => (
              <li key={t.key}>
                <strong className="text-ink">{t.label}</strong>: {t.from.join("/")} to {t.to}
                {t.roles?.length ? `, by ${t.roles.join(", ")}` : ", by owner or editor"}
                {t.fourEyes ? ", four-eyes" : ""}
                {t.ownerAllowed === false ? ", not the owner" : ""}
                {t.requires?.length ? `, needs ${t.requires.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <ActionForm action={saveTypeDefAction} resetOnOk={false} className="space-y-3">
        <input type="hidden" name="key" value={def.key} />
        <label className="block">
          <span className="text-sm font-semibold">Configuration</span>
          <textarea name="json" rows={28} spellCheck={false} defaultValue={JSON.stringify(def, null, 2)} className="field-input mt-1 font-mono text-xs leading-5" />
        </label>
        <button className="btn btn-primary">Save configuration</button>
      </ActionForm>
      <form action={resetTypeDefAction}>
        <input type="hidden" name="key" value={def.key} />
        <button className="btn btn-danger">Reset to the standard configuration</button>
      </form>
    </div>
  );
}
