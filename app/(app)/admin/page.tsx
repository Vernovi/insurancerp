import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { getDb, schema, dbMode } from "@/lib/db";
import { loadTypes } from "@/lib/engine/registry";
import { loadOrgUnits } from "@/lib/lookups";
import { ROLES, ROLE_LABELS, MODULES, LINES_OF_DEFENCE } from "@/lib/defs/types";
import { loadEntities } from "@/lib/scope";
import { HOSTING_NOTE } from "@/components/HostingNote";
import { fmtDateTime } from "@/lib/format";
import ActionForm from "@/components/ActionForm";
import { createUserAction, updateUserAction, createApiTokenAction, revokeApiTokenAction, saveEntityAction } from "@/app/actions";

export default async function Admin() {
  const user = await requireUser();
  if (!user.roles.includes("admin")) return <p className="rounded-md bg-warn-soft p-4 text-warn">Only administrators can open settings.</p>;
  const db = await getDb();
  const [units, types, tokens, ents, people] = await Promise.all([loadOrgUnits(), loadTypes(), db.select().from(schema.apiTokens).orderBy(desc(schema.apiTokens.createdAt)), loadEntities(), db.select().from(schema.users).orderBy(schema.users.name)]);
  const users = people;
  const unitName = new Map(units.map((u) => [u.id, u.name]));
  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings and users</h1>
        <p className="mt-1 text-ink-2">Database: {dbMode() === "postgres" ? "Postgres (persistent)" : "embedded demo database (resets on restart)"}. {HOSTING_NOTE}</p>
      </header>

      <section aria-labelledby="users-h" className="space-y-3">
        <h2 id="users-h" className="text-lg font-semibold">People and roles</h2>
        <div className="overflow-x-auto rounded-md border border-line bg-surface">
          <table className="data-table">
            <thead><tr><th>Person</th><th>Business unit</th><th>Roles, entities and sign-in</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="min-w-48">
                    <p className="font-semibold">{u.name}</p>
                    <p className="text-xs text-ink-3">{u.email}</p>
                    <p className="text-xs text-ink-3">{u.title}</p>
                    <p className="mt-1 text-xs">{u.mfaEnabled ? <span className="font-semibold text-good">Two-step sign-in on</span> : <span className="text-ink-3">Two-step sign-in off</span>}</p>
                  </td>
                  <td className="text-ink-2">{u.orgUnitId ? unitName.get(u.orgUnitId) : ""}</td>
                  <td>
                    <ActionForm action={updateUserAction} resetOnOk={false} className="space-y-2">
                      <input type="hidden" name="id" value={u.id} />
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {ROLES.map((r) => (
                          <label key={r} className="flex items-center gap-1 text-xs" title={ROLE_LABELS[r]}>
                            <input type="checkbox" name="roles" value={r} defaultChecked={(u.roles as string[]).includes(r)} /> {r}
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line-2 pt-1">
                        <span className="text-xs font-semibold text-ink-3">Entities</span>
                        {ents.map((e) => (
                          <label key={e.id} className="flex items-center gap-1 text-xs" title={e.name}>
                            <input type="checkbox" name="entities" value={e.id} defaultChecked={((u.entityIds ?? []) as number[]).includes(e.id)} /> {e.code}{e.walled ? "*" : ""}
                          </label>
                        ))}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <select name="lod" defaultValue={u.lineOfDefence ?? ""} className="field-input w-40 py-1 text-xs" aria-label={`Line of defence for ${u.name}`}>
                          <option value="">Line of defence</option>
                          {LINES_OF_DEFENCE.map((l) => <option key={l}>{l}</option>)}
                        </select>
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="mfaRequired" defaultChecked={u.mfaRequired || (u.roles as string[]).includes("admin")} disabled={(u.roles as string[]).includes("admin")} /> Require two-step sign-in{(u.roles as string[]).includes("admin") ? " (always for admins)" : ""}</label>
                        {u.mfaEnabled && <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="resetMfa" /> Reset two-step sign-in</label>}
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={u.active} /> Active</label>
                        <input name="password" type="password" placeholder="New password (optional)" autoComplete="new-password" className="field-input w-52 py-1 text-xs" aria-label={`New password for ${u.name}`} />
                        <button className="btn btn-secondary py-1 text-xs">Save</button>
                      </div>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="rounded-md border border-line bg-surface p-5">
          <h3 className="font-semibold">Add a person</h3>
          <ActionForm action={createUserAction} className="mt-3 grid gap-3 md:grid-cols-3">
            <label className="block text-sm"><span className="font-semibold">Name</span><input name="name" required className="field-input mt-1" /></label>
            <label className="block text-sm"><span className="font-semibold">Email</span><input name="email" type="email" required className="field-input mt-1" /></label>
            <label className="block text-sm"><span className="font-semibold">Job title</span><input name="title" className="field-input mt-1" /></label>
            <label className="block text-sm"><span className="font-semibold">Business unit</span>
              <select name="orgUnit" className="field-input mt-1"><option value="">None</option>{units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </label>
            <label className="block text-sm"><span className="font-semibold">Line manager</span>
              <select name="manager" className="field-input mt-1"><option value="">None</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            </label>
            <label className="block text-sm"><span className="font-semibold">Temporary password (12+ characters)</span><input name="password" type="password" autoComplete="new-password" required minLength={12} className="field-input mt-1" /></label>
            <label className="block text-sm"><span className="font-semibold">Line of defence</span>
              <select name="lod" className="field-input mt-1"><option value="">Not set</option>{LINES_OF_DEFENCE.map((l) => <option key={l}>{l}</option>)}</select>
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2 md:pt-6"><input type="checkbox" name="mfaRequired" /> Require two-step sign-in</label>
            <fieldset className="md:col-span-3">
              <legend className="text-sm font-semibold">Entities (access to walled entities&apos; records)</legend>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {ents.map((e) => <label key={e.id} className="flex items-center gap-1 text-sm"><input type="checkbox" name="entities" value={e.id} /> {e.name}{e.walled ? " (walled)" : ""}</label>)}
              </div>
            </fieldset>
            <fieldset className="md:col-span-3">
              <legend className="text-sm font-semibold">Roles</legend>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {ROLES.map((r) => <label key={r} className="flex items-center gap-1 text-sm"><input type="checkbox" name="roles" value={r} defaultChecked={r === "staff"} /> {ROLE_LABELS[r]}</label>)}
              </div>
            </fieldset>
            <div><button className="btn btn-primary">Add person</button></div>
          </ActionForm>
        </div>
      </section>

      <section aria-labelledby="ent-h" className="space-y-3">
        <h2 id="ent-h" className="text-lg font-semibold">Group entities</h2>
        <p className="max-w-2xl text-sm text-ink-2">Each legal entity carries its licence, regulators and applicable frameworks; its own appetite is set in Risk appetite. A walled entity&apos;s records are visible only to people given that entity above (plus each record&apos;s owner and creator). * marks walled entities.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {ents.map((e) => (
            <ActionForm key={e.id} action={saveEntityAction} resetOnOk={false} className="space-y-2 rounded-md border border-line bg-surface p-4 text-sm">
              <input type="hidden" name="id" value={e.id} />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{e.code} &middot; {e.kind === "group" ? "Holding company" : e.business}</p>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="walled" defaultChecked={e.walled} /> Walled</label>
              </div>
              <label className="block"><span className="text-xs font-semibold text-ink-3">Name</span><input name="name" defaultValue={e.name} className="field-input mt-0.5" /></label>
              <label className="block"><span className="text-xs font-semibold text-ink-3">Licence</span><input name="licence" defaultValue={e.licence ?? ""} className="field-input mt-0.5" /></label>
              <label className="block"><span className="text-xs font-semibold text-ink-3">Regulators (comma separated)</span><input name="regulators" defaultValue={((e.regulators ?? []) as string[]).join(", ")} className="field-input mt-0.5" /></label>
              <label className="block"><span className="text-xs font-semibold text-ink-3">Applicable frameworks (comma separated)</span><input name="frameworks" defaultValue={((e.frameworks ?? []) as string[]).join(", ")} className="field-input mt-0.5" /></label>
              <button className="btn btn-secondary py-1 text-xs">Save entity</button>
            </ActionForm>
          ))}
        </div>
      </section>

      <section aria-labelledby="config-h" className="space-y-3">
        <h2 id="config-h" className="text-lg font-semibold">Registers, fields and workflows</h2>
        <p className="max-w-2xl text-sm text-ink-2">Every register is configuration, not code. Change fields, picklists, approval steps and who can do them; forms and workflows update immediately.</p>
        {MODULES.map((m) => (
          <div key={m.key}>
            <h3 className="mt-3 text-sm font-semibold text-ink-2">{m.label}</h3>
            <ul className="mt-1 flex flex-wrap gap-2">
              {types.filter((t) => t.module === m.key).map((t) => (
                <li key={t.key}>
                  <Link href={`/admin/types/${t.key}`} className="btn btn-secondary">
                    {t.plural}
                    {(t as { customised?: boolean }).customised && <span className="text-xs font-normal text-accent">customised</span>}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="api-h" className="space-y-3">
        <h2 id="api-h" className="text-lg font-semibold">API access</h2>
        <p className="max-w-2xl text-sm text-ink-2">
          Tokens let other systems read and create records through <code>/api/v1/records</code>. Send the token as <code>Authorization: Bearer &lt;token&gt;</code>. Tokens act with administrator rights, so give each system its own and revoke unused ones.
        </p>
        <ul className="divide-y divide-line-2 rounded-md border border-line bg-surface text-sm">
          {tokens.map((t) => (
            <li key={t.id} className="flex items-center justify-between px-4 py-2">
              <span>{t.name} <span className="text-ink-3">created {fmtDateTime(t.createdAt)}</span> {t.revoked && <span className="font-semibold text-bad">revoked</span>}</span>
              {!t.revoked && (
                <form action={revokeApiTokenAction}><input type="hidden" name="id" value={t.id} /><button className="btn btn-danger py-1 text-xs">Revoke</button></form>
              )}
            </li>
          ))}
          {tokens.length === 0 && <li className="px-4 py-3 text-ink-2">No tokens yet.</li>}
        </ul>
        <ActionForm action={createApiTokenAction} className="flex items-end gap-2" resetOnOk={false}>
          <label className="block text-sm"><span className="font-semibold">Token name</span><input name="name" placeholder="e.g. Power BI, SecureComply" className="field-input mt-1 w-72" /></label>
          <button className="btn btn-primary">Create token</button>
        </ActionForm>
      </section>

      <section aria-labelledby="int-h" className="space-y-2">
        <h2 id="int-h" className="text-lg font-semibold">Integrations</h2>
        <ul className="list-disc pl-5 text-sm text-ink-2 space-y-1">
          <li>SecureComply (ISO 27001, cyber risk, privacy): {process.env.SECURECOMPLY_API_URL ? "configured" : "not configured. Set SECURECOMPLY_API_URL and SECURECOMPLY_API_KEY to enable the PLT-47 feed."}</li>
          <li>Email and Teams notifications: in-app only until an email provider is configured.</li>
          <li>HR feed, claims and core insurance systems: use the REST API with a token above.</li>
        </ul>
      </section>
    </div>
  );
}
