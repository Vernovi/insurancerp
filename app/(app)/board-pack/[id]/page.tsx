import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { getDb, schema } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtNaira } from "@/lib/format";
import { RISK_CATEGORIES } from "@/lib/defs/modules";
import type { Kpi } from "@/lib/dashboard";
import HeatMap from "@/components/HeatMap";
import AppetiteStrip, { type StripRow } from "@/components/AppetiteStrip";
import { Pill, Val } from "@/components/Pill";
import PrintButton from "@/components/PrintButton";

type SnapRec = { id: number; typeKey: string; ref: string; title: string; status: string; ownerId: number | null; entityId?: number | null; data: Record<string, unknown>; dueDate: string | null };

export default async function Pack({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const db = await getDb();
  const [s] = await db.select().from(schema.snapshots).where(eq(schema.snapshots.id, Number(id)));
  if (!s) notFound();
  const raw = s.payload as { records: SnapRec[]; users: { id: number; name: string }[]; kpis: Kpi[]; takenAt: string; entity?: { id: number; name: string } | null };
  // The entity wall applies to frozen packs too: a viewer never sees records of a walled entity they are not in.
  if (raw.entity && user.deniedEntities.includes(raw.entity.id)) notFound();
  const p = { ...raw, records: raw.records.filter((r) => !r.entityId || !user.deniedEntities.includes(r.entityId)) };
  const names = new Map(p.users.map((u) => [u.id, u.name]));
  const risks = p.records.filter((r) => r.typeKey === "risk" && r.status === "active");
  const appetite = p.records.filter((r) => r.typeKey === "appetite" && r.status === "approved");
  const kris = p.records.filter((r) => r.typeKey === "kri" && r.status === "active");
  const actions = p.records.filter((r) => r.typeKey === "action" && !["closed", "cancelled"].includes(r.status));
  const overdueActions = actions.filter((a) => a.dueDate && a.dueDate < s.periodEnd);
  const strip: StripRow[] = RISK_CATEGORIES.map((c) => ({
    category: c,
    threshold: (() => {
      const a = appetite.find((x) => x.data.category === c);
      return a ? Number(a.data.threshold) : null;
    })(),
    risks: risks.filter((r) => r.data.category === c && typeof r.data.residual_score === "number").map((r) => ({ id: r.id, ref: r.ref, title: r.title, residual: r.data.residual_score as number, target: (r.data.target_score as number) ?? null, outside: r.data.appetite_status === "Outside appetite" })),
  })).filter((r) => r.risks.length);
  const top = [...risks].sort((a, b) => Number(b.data.residual_score) - Number(a.data.residual_score)).slice(0, 10);
  const outside = risks.filter((r) => r.data.appetite_status === "Outside appetite");

  return (
    <article className="mx-auto max-w-5xl space-y-8 print:max-w-none">
      <header className="flex items-start justify-between gap-4 border-b border-line pb-4">
        <div>
          <p className="text-sm text-ink-3">Frozen {fmtDateTime(p.takenAt)}. Live register changes after this time are not reflected.</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{s.label}</h1>
          <p className="text-ink-2">Period ending {fmtDate(s.periodEnd)}</p>
        </div>
        <PrintButton />
      </header>

      <section>
        <h2 className="text-lg font-semibold">Risk on a page</h2>
        <p className="mt-1 text-sm text-ink-2">
          {risks.length} active risks; {outside.length} outside appetite; {kris.filter((k) => k.data.kri_status === "Red").length} KRIs at red; {overdueActions.length} of {actions.length} open actions overdue at period end.
        </p>
        <div className="mt-4 rounded-md border border-line bg-surface p-5"><AppetiteStrip rows={strip} /></div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 print:break-inside-avoid">
        <div className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Residual heat map</h2>
          <div className="mt-3"><HeatMap risks={risks.map((r) => ({ id: r.id, ref: r.ref, title: r.title, l: Number(r.data.residual_likelihood), i: Number(r.data.residual_impact) }))} caption="Residual heat map at period end" /></div>
        </div>
        <div className="rounded-md border border-line bg-surface p-5">
          <h2 className="text-base font-semibold">Risks outside appetite</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {outside.map((r) => (
              <li key={r.id}>
                <p className="font-semibold">{r.ref} {r.title}</p>
                <p className="text-ink-2">Residual {String(r.data.residual_score)} vs appetite {String(r.data.appetite_threshold)}; owner {r.ownerId ? names.get(r.ownerId) : "unassigned"}; treatment {String(r.data.treatment ?? "not set")}.</p>
              </li>
            ))}
            {outside.length === 0 && <li className="text-ink-2">None.</li>}
          </ul>
        </div>
      </section>

      <section className="print:break-before-page">
        <h2 className="text-lg font-semibold">Board measures</h2>
        <table className="data-table mt-3 rounded-md border border-line bg-surface">
          <thead><tr><th>Measure</th><th>Value</th><th>Detail</th><th>Status</th></tr></thead>
          <tbody>
            {p.kpis.map((k) => (
              <tr key={k.label}>
                <td className="font-semibold">{k.label}</td>
                <td className="whitespace-nowrap font-semibold">{k.value}</td>
                <td className="text-ink-2">{k.detail}</td>
                <td><Pill label={{ good: "On track", warn: "Watch", bad: "Act now", info: "For information" }[k.status]} tone={k.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Top 10 risks</h2>
        <table className="data-table mt-3 rounded-md border border-line bg-surface">
          <thead><tr><th>Ref</th><th>Risk</th><th>Category</th><th>Inherent</th><th>Residual</th><th>Target</th><th>Appetite</th><th>Owner</th></tr></thead>
          <tbody>
            {top.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{r.ref}</td>
                <td>{r.title}</td>
                <td>{String(r.data.category)}</td>
                <td>{String(r.data.inherent_score ?? "")}</td>
                <td className="font-semibold">{String(r.data.residual_score ?? "")}</td>
                <td>{String(r.data.target_score ?? "")}</td>
                <td><Val v={String(r.data.appetite_status ?? "")} /></td>
                <td>{r.ownerId ? names.get(r.ownerId) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Key risk indicators</h2>
        <table className="data-table mt-3 rounded-md border border-line bg-surface">
          <thead><tr><th>Indicator</th><th>Latest</th><th>Amber</th><th>Red</th><th>Status</th></tr></thead>
          <tbody>
            {kris.map((k) => (
              <tr key={k.id}>
                <td>{k.title}</td>
                <td className="font-semibold">{String(k.data.latest_value ?? "")} {String(k.data.unit ?? "")}</td>
                <td>{String(k.data.amber_limit)}</td>
                <td>{String(k.data.red_limit)}</td>
                <td><Val v={String(k.data.kri_status ?? "")} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Overdue actions at period end</h2>
        <table className="data-table mt-3 rounded-md border border-line bg-surface">
          <thead><tr><th>Ref</th><th>Action</th><th>Owner</th><th>Due</th><th>Priority</th></tr></thead>
          <tbody>
            {overdueActions.map((a) => (
              <tr key={a.id}>
                <td>{a.ref}</td>
                <td>{a.title}</td>
                <td>{a.ownerId ? names.get(a.ownerId) : ""}</td>
                <td className="text-bad">{fmtDate(a.dueDate)}</td>
                <td><Val v={String(a.data.priority ?? "")} /></td>
              </tr>
            ))}
            {overdueActions.length === 0 && <tr><td colSpan={5} className="text-ink-2">None.</td></tr>}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-ink-3">Losses are shown in naira; e.g. {fmtNaira(1_500_000)} = NGN 1.5 million.</p>
    </article>
  );
}
