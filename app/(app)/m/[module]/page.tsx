import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, eq, lt, sql } from "drizzle-orm";
import { requireUser, hasRole } from "@/lib/auth/current";
import { MODULES, type ModuleKey } from "@/lib/defs/types";
import { typesForModule } from "@/lib/engine/registry";
import { canCreate } from "@/lib/engine/permissions";
import { getDb, schema } from "@/lib/db";
import { today } from "@/lib/engine/pure";
import { riskViews } from "@/lib/riskviews";
import { listRecords } from "@/lib/engine/records";
import { userMap, unitMap } from "@/lib/lookups";
import HeatMap from "@/components/HeatMap";
import AppetiteStrip from "@/components/AppetiteStrip";
import RecordTable from "@/components/RecordTable";
import ActionForm from "@/components/ActionForm";
import { launchDeclarationCampaign } from "@/app/actions";

export default async function ModulePage({ params, searchParams }: { params: Promise<{ module: string }>; searchParams: Promise<{ view?: string }> }) {
  const user = await requireUser();
  const { module } = await params;
  const { view } = await searchParams;
  const mod = MODULES.find((m) => m.key === module);
  if (!mod) notFound();
  const types = await typesForModule(module as ModuleKey);
  const db = await getDb();
  const t = today();
  const counts = await Promise.all(
    types.map(async (def) => {
      const finals = def.workflow.states.filter((s) => s.final).map((s) => s.key);
      const notFinal = finals.length ? sql`${schema.records.status} not in (${sql.join(finals.map((f) => sql`${f}`), sql`, `)})` : sql`true`;
      const [{ open }] = await db.select({ open: count() }).from(schema.records).where(and(eq(schema.records.typeKey, def.key), notFinal));
      const [{ overdue }] = await db.select({ overdue: count() }).from(schema.records).where(and(eq(schema.records.typeKey, def.key), notFinal, lt(schema.records.dueDate, t)));
      return { def, open: Number(open), overdue: Number(overdue) };
    }),
  );
  const [users, units] = await Promise.all([userMap(), unitMap()]);

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm text-ink-3">{mod.group}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{mod.label}</h1>
        <p className="mt-1 text-ink-2">{mod.summary}</p>
      </header>

      <section className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Register</th>
              <th scope="col">Open</th>
              <th scope="col">Overdue</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {counts.filter((c) => !c.def.hidden).map(({ def, open, overdue }) => (
              <tr key={def.key}>
                <td>
                  <Link href={`/r/${def.key}`} className="font-semibold hover:text-accent hover:underline">{def.plural}</Link>
                  {def.description && <p className="text-xs text-ink-3 max-w-xl">{def.description}</p>}
                </td>
                <td className="font-semibold">{open}</td>
                <td className={overdue ? "font-semibold text-bad" : "text-ink-3"}>{overdue}</td>
                <td className="text-right">
                  {canCreate(user, def) && (
                    <Link href={`/r/${def.key}/new`} className="btn btn-secondary">New {def.label.toLowerCase()}</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {module === "erm" && <ErmPanel view={view} />}
      {module === "declarations" && hasRole(user, "compliance") && (
        <section className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Annual declaration campaign</h2>
          <p className="mt-1 text-sm text-ink-2">Creates a draft annual declaration for every active member of staff who doesn&apos;t have one, and notifies them.</p>
          <ActionForm action={launchDeclarationCampaign} className="mt-3 flex items-end gap-3" resetOnOk={false}>
            <label className="block">
              <span className="text-sm font-semibold">Year</span>
              <input name="year" defaultValue={t.slice(0, 4)} className="field-input mt-1 w-28" />
            </label>
            <button className="btn btn-primary">Launch campaign</button>
          </ActionForm>
        </section>
      )}
      {module !== "erm" && (
        <section>
          <h2 className="text-base font-semibold">Recently updated</h2>
          <div className="mt-3">
            <RecordTable
              rows={await listRecords(user, types.filter((x) => !x.hidden).map((x) => x.key), { limit: 15 })}
              users={users}
              units={units}
              defs={new Map(types.map((x) => [x.key, x]))}
              showType
            />
          </div>
        </section>
      )}
    </div>
  );
}

async function ErmPanel({ view }: { view?: string }) {
  const v = await riskViews();
  const kind = view === "inherent" ? "inherent" : "residual";
  return (
    <>
      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="text-base font-semibold">Residual risk against appetite</h2>
        <div className="mt-4"><AppetiteStrip rows={v.strip} /></div>
      </section>
      <section className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">{kind === "residual" ? "Residual" : "Inherent"} heat map</h2>
          <nav className="flex gap-1 text-sm" aria-label="Heat map view">
            <Link href="?view=residual" aria-current={kind === "residual" ? "page" : undefined} className={`rounded px-2 py-1 ${kind === "residual" ? "bg-accent-soft font-semibold text-accent" : "text-ink-2"}`}>Residual</Link>
            <Link href="?view=inherent" aria-current={kind === "inherent" ? "page" : undefined} className={`rounded px-2 py-1 ${kind === "inherent" ? "bg-accent-soft font-semibold text-accent" : "text-ink-2"}`}>Inherent</Link>
          </nav>
        </div>
        <div className="mt-3 max-w-3xl"><HeatMap risks={v.heat(kind)} caption={`${kind} heat map`} /></div>
      </section>
    </>
  );
}
