import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { boardKpis } from "@/lib/dashboard";
import { riskViews } from "@/lib/riskviews";
import { userMap } from "@/lib/lookups";
import { fmtDate } from "@/lib/format";
import { today } from "@/lib/engine/pure";
import AppetiteStrip from "@/components/AppetiteStrip";
import HeatMap from "@/components/HeatMap";
import { Pill, Val } from "@/components/Pill";

const STATUS_LABEL = { good: "On track", warn: "Watch", bad: "Act now", info: "For information" } as const;
const STATUS_TONE = { good: "good", warn: "warn", bad: "bad", info: "info" } as const;

export default async function Overview() {
  await requireUser();
  const [kpis, views, users] = await Promise.all([boardKpis(), riskViews(), userMap()]);
  const bad = kpis.filter((k) => k.status === "bad");
  const outside = views.strip.reduce((n, r) => n + (r.threshold === null ? 0 : r.risks.filter((x) => x.residual > r.threshold!).length), 0);
  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-ink-3">Position at {fmtDate(today())}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {outside === 0 ? "Every active risk is within appetite." : `${outside} ${outside === 1 ? "risk is" : "risks are"} outside appetite, and ${bad.length} board ${bad.length === 1 ? "measure needs" : "measures need"} action.`}
        </h1>
      </header>

      <section aria-labelledby="appetite-h" className="rounded-md border border-line bg-surface p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="appetite-h" className="text-base font-semibold">Residual risk against appetite</h2>
          <Link href="/m/erm" className="text-sm text-accent hover:underline">Open the risk register</Link>
        </div>
        <div className="mt-4"><AppetiteStrip rows={views.strip} /></div>
      </section>

      <section aria-labelledby="kpi-h">
        <div className="flex items-baseline justify-between">
          <h2 id="kpi-h" className="text-base font-semibold">Board and Risk Committee measures</h2>
          <Link href="/board-pack" className="text-sm text-accent hover:underline">Freeze a board pack</Link>
        </div>
        <div className="mt-3 overflow-x-auto rounded-md border border-line bg-surface">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Measure</th>
                <th scope="col">Now</th>
                <th scope="col">Detail</th>
                <th scope="col">Red when</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k.label}>
                  <td>
                    <Link href={k.href} className="font-semibold hover:text-accent hover:underline">{k.label}</Link>
                    <p className="text-xs text-ink-3">{k.module}</p>
                  </td>
                  <td className="whitespace-nowrap text-base font-semibold">{k.value}</td>
                  <td className="text-ink-2">{k.detail}</td>
                  <td className="text-ink-3">{k.threshold}</td>
                  <td><Pill label={STATUS_LABEL[k.status]} tone={STATUS_TONE[k.status]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-md border border-line bg-surface p-5" aria-labelledby="heat-h">
          <h2 id="heat-h" className="text-base font-semibold">Residual heat map</h2>
          <div className="mt-3"><HeatMap risks={views.heat("residual")} caption="Residual risk heat map" /></div>
        </section>
        <section className="rounded-md border border-line bg-surface p-5" aria-labelledby="top-h">
          <h2 id="top-h" className="text-base font-semibold">Top 10 risks by residual score</h2>
          <ol className="mt-3 divide-y divide-line-2">
            {views.top.map((r) => {
              const d = r.data as Record<string, unknown>;
              return (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <div>
                    <Link href={`/records/${r.id}`} className="font-semibold hover:text-accent hover:underline">{r.title}</Link>
                    <p className="text-xs text-ink-3">{r.ref}, {String(d.category)}, owner {r.ownerId ? users.get(r.ownerId) : "unassigned"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-semibold">{String(d.residual_score)}</span>
                    <Val v={String(d.appetite_status ?? "")} />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </div>
  );
}
