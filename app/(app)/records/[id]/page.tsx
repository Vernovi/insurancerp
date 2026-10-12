import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, hasRole } from "@/lib/auth/current";
import { getRecordForUser, linkedRecords, recordComments, recordHistory, canEdit, canView } from "@/lib/engine/records";
import { loadTypes, stateOf } from "@/lib/engine/registry";
import { canCreate } from "@/lib/engine/permissions";
import { checkTransition, fieldVisible, today } from "@/lib/engine/pure";
import { getDb } from "@/lib/db";
import { userMap, unitMap } from "@/lib/lookups";
import { displayValue, fmtDate, fmtDateTime, fmtNumber } from "@/lib/format";
import { LINKED_CREATE } from "@/lib/suggestions";
import { Pill, Val } from "@/components/Pill";
import TransitionBar, { type TransitionOption } from "@/components/TransitionBar";
import ActionForm from "@/components/ActionForm";
import TrendLine from "@/components/TrendLine";
import { commentAction, linkAction, readingAction, unlinkAction, launchAttestation } from "@/app/actions";

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const found = await getRecordForUser(user, Number(id));
  if (!found) notFound();
  const { record: r, def } = found;
  const data = (r.data ?? {}) as Record<string, unknown>;
  const db = await getDb();
  const [types, users, units, links, comments, history] = await Promise.all([loadTypes(), userMap(), unitMap(), linkedRecords(db, r.id), recordComments(r.id), recordHistory(r.id)]);
  const typeMap = new Map(types.map((t) => [t.key, t]));
  const editable = canEdit(user, def, r);
  const st = stateOf(def, r.status);
  const overdue = r.dueDate && r.dueDate < today() && !("final" in st && st.final);

  const options: TransitionOption[] = def.workflow.transitions
    .filter((t) => t.from.includes(r.status))
    .map((t, i) => ({
      key: t.key,
      label: t.label,
      commentRequired: !!t.commentRequired,
      primary: i === 0,
      blocked: checkTransition(def, { status: r.status, ownerId: r.ownerId, createdBy: r.createdBy, data }, t, user, t.commentRequired ? "x" : undefined, editable),
    }));

  const sections = [...new Set(def.fields.map((f) => f.section ?? "Details"))];
  const visibleLinks = links.filter((l) => {
    const d = typeMap.get(l.record.typeKey);
    return d && canView(user, d, l.record);
  });
  const hiddenLinks = links.length - visibleLinks.length;
  const reporterChannel = def.key === "case" && data.channel === "Anonymous portal";
  const internal = comments.filter((c) => c.channel === "internal");
  const reporter = comments.filter((c) => c.channel === "reporter");

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-ink-3">
          <Link href={`/r/${def.key}`} className="hover:text-accent">{def.plural}</Link> <span aria-hidden>/</span> {r.ref}
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="max-w-3xl text-2xl font-semibold tracking-tight">{r.title}</h1>
          <div className="flex gap-2">
            {editable && <Link href={`/records/${r.id}/edit`} className="btn btn-secondary">Edit</Link>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2">
          <Pill label={st.label} tone={st.tone} />
          <span>Owner: <strong className="text-ink">{r.ownerId ? users.get(r.ownerId) : "Unassigned"}</strong></span>
          {r.orgUnitId && <span>{units.get(r.orgUnitId)}</span>}
          {r.dueDate && <span className={overdue ? "font-semibold text-bad" : ""}>{overdue ? "Overdue since" : "Due"} {fmtDate(r.dueDate)}</span>}
          {r.confidential && <Pill label="Confidential: views are logged" tone="warn" />}
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6 min-w-0">
          <TransitionBar id={r.id} options={options} />

          {def.hook === "risk" && <RiskScale data={data} />}
          {(def.hook === "kri" || def.hook === "esg_metric") && (
            <section className="rounded-md border border-line bg-surface p-5">
              <h2 className="text-base font-semibold">Readings</h2>
              <div className="mt-3">
                <TrendLine
                  points={(Array.isArray(data.readings) ? (data.readings as { date: string; value: number }[]) : [])}
                  amber={def.hook === "kri" ? (data.amber_limit as number) : null}
                  red={def.hook === "kri" ? (data.red_limit as number) : null}
                  unit={String(data.unit ?? "")}
                />
              </div>
              {(editable || hasRole(user, "risk", "esg")) && (
                <ActionForm action={readingAction} className="mt-4 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="block text-sm"><span className="font-semibold">Date</span><input type="date" name="date" defaultValue={today()} required className="field-input mt-1" /></label>
                  <label className="block text-sm"><span className="font-semibold">Value{data.unit ? ` (${data.unit})` : ""}</span><input type="number" step="any" name="value" required className="field-input mt-1 w-36" /></label>
                  <label className="block text-sm flex-1 min-w-48"><span className="font-semibold">Note</span><input name="note" className="field-input mt-1" /></label>
                  <button className="btn btn-primary">Add reading</button>
                </ActionForm>
              )}
            </section>
          )}
          {def.key === "policy" && <PolicyPanel recordId={r.id} data={data} status={r.status} canLaunch={hasRole(user, "compliance")} links={visibleLinks} />}

          {sections.map((s) => {
            const fs = def.fields.filter((f) => (f.section ?? "Details") === s && fieldVisible(f, data) && !(def.key === "policy" && ["dos", "donts"].includes(f.key)));
            const shown = fs.filter((f) => displayValue(f, data[f.key], users, units) !== "");
            if (shown.length === 0) return null;
            return (
              <section key={s} className="rounded-md border border-line bg-surface p-5">
                <h2 className="text-base font-semibold">{s}</h2>
                <dl className="mt-3 grid gap-x-6 gap-y-3 md:grid-cols-2">
                  {shown.map((f) => {
                    const v = displayValue(f, data[f.key], users, units);
                    const long = f.type === "textarea";
                    return (
                      <div key={f.key} className={long ? "md:col-span-2" : ""}>
                        <dt className="text-xs font-semibold text-ink-3">{f.label}</dt>
                        <dd className={`mt-0.5 text-sm ${long ? "whitespace-pre-line leading-relaxed" : ""}`}>
                          <Val v={v} />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })}

          {reporterChannel && (
            <section className="rounded-md border border-line bg-surface p-5">
              <h2 className="text-base font-semibold">Messages with the anonymous reporter</h2>
              <p className="mt-1 text-sm text-ink-2">The reporter sees these through their case key. Nothing here identifies them.</p>
              <ul className="mt-3 space-y-3">
                {reporter.map((c) => (
                  <li key={c.id} className={`rounded-md p-3 text-sm ${c.authorId ? "bg-accent-soft ml-8" : "bg-canvas mr-8"}`}>
                    <p className="text-xs text-ink-3">{c.authorId ? `Investigator (${users.get(c.authorId)})` : "Reporter"}, {fmtDateTime(c.createdAt)}</p>
                    <p className="mt-1 whitespace-pre-line">{c.body}</p>
                  </li>
                ))}
                {reporter.length === 0 && <li className="text-sm text-ink-2">No messages yet.</li>}
              </ul>
              <ActionForm action={commentAction} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="channel" value="reporter" />
                <textarea name="body" rows={2} required className="field-input" aria-label="Message to reporter" />
                <button className="btn btn-primary">Send to reporter</button>
              </ActionForm>
            </section>
          )}

          <section className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Comments</h2>
            <ul className="mt-3 space-y-3">
              {internal.map((c) => (
                <li key={c.id} className="text-sm">
                  <p className="text-xs text-ink-3">{c.authorId ? users.get(c.authorId) : "System"}, {fmtDateTime(c.createdAt)}</p>
                  <p className="mt-0.5 whitespace-pre-line">{c.body}</p>
                </li>
              ))}
              {internal.length === 0 && <li className="text-sm text-ink-2">No comments yet.</li>}
            </ul>
            <ActionForm action={commentAction} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={r.id} />
              <textarea name="body" rows={2} required className="field-input" aria-label="New comment" />
              <button className="btn btn-secondary">Add comment</button>
            </ActionForm>
          </section>

          <section className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">History</h2>
            <ol className="mt-3 space-y-2 text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="w-10 shrink-0 text-ink-3">v{h.version}</span>
                  <span className="flex-1">{h.note ?? "Saved"}</span>
                  <span className="shrink-0 text-ink-3">{h.changedBy ? users.get(h.changedBy) : "System"}, {fmtDateTime(h.changedAt)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-md border border-line bg-surface p-5">
            <h2 className="text-base font-semibold">Linked records</h2>
            {visibleLinks.length === 0 && hiddenLinks === 0 && <p className="mt-2 text-sm text-ink-2">Nothing linked yet.</p>}
            <ul className="mt-2 divide-y divide-line-2">
              {visibleLinks.map((l) => {
                const ld = typeMap.get(l.record.typeKey)!;
                const lst = stateOf(ld, l.record.status);
                return (
                  <li key={l.linkId} className="py-2 text-sm">
                    <p className="text-xs text-ink-3">{ld.label}, {l.kind}</p>
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/records/${l.record.id}`} className="font-semibold hover:text-accent hover:underline">{l.record.ref} {l.record.title}</Link>
                      {editable && (
                        <form action={unlinkAction}>
                          <input type="hidden" name="linkId" value={l.linkId} />
                          <input type="hidden" name="id" value={r.id} />
                          <button className="text-xs text-ink-3 hover:text-bad" aria-label={`Remove link to ${l.record.ref}`}>Remove</button>
                        </form>
                      )}
                    </div>
                    <Pill label={lst.label} tone={lst.tone} />
                  </li>
                );
              })}
              {hiddenLinks > 0 && <li className="py-2 text-sm text-ink-3">{hiddenLinks} restricted {hiddenLinks === 1 ? "record" : "records"} you can&apos;t see.</li>}
            </ul>
            <ActionForm action={linkAction} className="mt-3 space-y-2">
              <input type="hidden" name="id" value={r.id} />
              <div className="flex gap-2">
                <input name="ref" required placeholder="Reference, e.g. RSK-0004" className="field-input" aria-label="Reference to link" />
                <input name="kind" placeholder="Relationship" className="field-input w-32" aria-label="Relationship" defaultValue="related" />
              </div>
              <button className="btn btn-secondary">Link record</button>
            </ActionForm>
            {(LINKED_CREATE[def.key] ?? []).filter(([t]) => typeMap.get(t) && canCreate(user, typeMap.get(t)!)).length > 0 && (
              <div className="mt-4 border-t border-line-2 pt-3">
                <p className="text-xs font-semibold text-ink-3">Create linked</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(LINKED_CREATE[def.key] ?? [])
                    .filter(([t]) => typeMap.get(t) && canCreate(user, typeMap.get(t)!))
                    .map(([t, kind]) => (
                      <Link key={t} href={`/r/${t}/new?link=${r.id}&kind=${kind}`} className="btn btn-secondary">{typeMap.get(t)!.label}</Link>
                    ))}
                </div>
              </div>
            )}
          </section>
          <section className="rounded-md border border-line bg-surface p-5 text-sm">
            <h2 className="text-base font-semibold">Record details</h2>
            <dl className="mt-2 space-y-1.5">
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Type</dt><dd>{def.label}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Raised by</dt><dd>{r.createdBy ? users.get(r.createdBy) : "System or portal"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Created</dt><dd>{fmtDateTime(r.createdAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Last updated</dt><dd>{fmtDateTime(r.updatedAt)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-ink-3">Version</dt><dd>{r.version}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function RiskScale({ data }: { data: Record<string, unknown> }) {
  const pts: [string, unknown][] = [["Inherent", data.inherent_score], ["Residual", data.residual_score], ["Target", data.target_score]];
  const th = typeof data.appetite_threshold === "number" ? data.appetite_threshold : null;
  const pos = (s: number) => `${((s - 1) / 24) * 100}%`;
  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">Score against appetite</h2>
        <Val v={String(data.appetite_status ?? "")} />
      </div>
      <div className="mt-6 relative h-10 rounded bg-canvas" aria-hidden>
        {th !== null && (
          <>
            <div className="absolute inset-y-0 left-0 rounded-l bg-good-soft" style={{ width: pos(Math.max(1, th - 2)) }} />
            <div className="absolute inset-y-0 bg-warn-soft" style={{ left: pos(Math.max(1, th - 2)), width: `calc(${pos(th)} - ${pos(Math.max(1, th - 2))})` }} />
            <div className="absolute inset-y-0 right-0 rounded-r bg-bad-soft" style={{ left: pos(th) }} />
            <div className="absolute -inset-y-2 w-0.5 bg-ink" style={{ left: pos(th) }} />
            <span className="absolute -top-5 -translate-x-1/2 text-xs font-semibold" style={{ left: pos(th) }}>Appetite {th}</span>
          </>
        )}
        {pts.map(([label, v], i) =>
          typeof v === "number" ? (
            <span key={label} className={`absolute -translate-x-1/2 rounded px-1.5 text-xs font-semibold leading-5 text-white ${label === "Residual" ? "bg-ink" : "bg-ink-3"}`} style={{ left: pos(v), top: `${i * 0 + 10}px` }}>
              {v}
            </span>
          ) : null,
        )}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
        {pts.map(([label, v]) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-ink-3">{label}</dt>
            <dd className="font-semibold">{typeof v === "number" ? `${fmtNumber(v)} of 25` : "Not scored"}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-3">Residual is tested against the approved appetite for {String(data.category ?? "its category")}. Target shows where the agreed actions should take it.</p>
    </section>
  );
}

function PolicyPanel({ recordId, data, status, canLaunch, links }: { recordId: number; data: Record<string, unknown>; status: string; canLaunch: boolean; links: { record: { typeKey: string; status: string } }[] }) {
  const atts = links.filter((l) => l.record.typeKey === "attestation");
  const done = atts.filter((l) => l.record.status === "attested").length;
  const lines = (v: unknown) => String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  return (
    <section className="rounded-md border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">What this means for you</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2 text-sm">
        <div>
          <p className="font-semibold text-good">Do</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">{lines(data.dos).map((l) => <li key={l}>{l}</li>)}</ul>
        </div>
        <div>
          <p className="font-semibold text-bad">Don&apos;t</p>
          <ul className="mt-1 list-disc pl-5 space-y-1">{lines(data.donts).length ? lines(data.donts).map((l) => <li key={l}>{l}</li>) : <li className="list-none -ml-5 text-ink-3">None listed</li>}</ul>
        </div>
      </div>
      <div className="mt-4 border-t border-line-2 pt-3 text-sm">
        <p>
          Attestation: <strong>{done} of {atts.length}</strong> people have attested{atts.length ? ` (${Math.round((done / atts.length) * 100)}%)` : ""}.
        </p>
        {canLaunch && status === "published" && (
          <ActionForm action={launchAttestation} className="mt-2 flex flex-wrap items-end gap-2" resetOnOk={false}>
            <input type="hidden" name="id" value={recordId} />
            <label className="block">
              <span className="font-semibold">Send to</span>
              <select name="scope" className="field-input mt-1">
                <option value="all">All active staff</option>
                <option value="staff">Staff role only</option>
                <option value="board">Board members</option>
              </select>
            </label>
            <button className="btn btn-primary">Request attestation</button>
          </ActionForm>
        )}
      </div>
    </section>
  );
}
