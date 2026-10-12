import Link from "next/link";

export interface StripRow {
  category: string;
  threshold: number | null;
  risks: { id: number; ref: string; title: string; residual: number; target: number | null }[];
}

const pos = (s: number) => `${((s - 1) / 24) * 100}%`;

/** One line per risk category: the appetite threshold as a wall, each risk as a mark at its residual score. */
export default function AppetiteStrip({ rows }: { rows: StripRow[] }) {
  return (
    <div className="space-y-1">
      <div className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] gap-3 text-xs text-ink-3">
        <span className="hidden sm:block" />
        <div className="relative h-4">
          {[1, 5, 10, 15, 20, 25].map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t) }}>{t}</span>
          ))}
        </div>
      </div>
      {rows.map((row) => {
        const th = row.threshold;
        const outside = th !== null ? row.risks.filter((r) => r.residual > th).length : 0;
        const seen = new Map<number, number>();
        return (
          <div key={row.category} className="grid grid-cols-1 sm:grid-cols-[11rem_1fr] items-center gap-x-3 gap-y-1 pb-2 sm:pb-0">
            <div className="text-sm leading-tight">
              <p className="font-semibold">{row.category}</p>
              <p className="text-xs text-ink-3">
                {th === null ? "No approved appetite" : `Appetite ${th}`}
                {outside > 0 && <span className="font-semibold text-bad">, {outside} outside</span>}
              </p>
            </div>
            <div className="relative h-11 rounded bg-canvas">
              {th !== null && (
                <>
                  <div className="absolute inset-y-0 left-0 rounded-l bg-good-soft" style={{ width: pos(Math.max(1, th - 2)) }} />
                  <div className="absolute inset-y-0 bg-warn-soft" style={{ left: pos(Math.max(1, th - 2)), width: `calc(${pos(th)} - ${pos(Math.max(1, th - 2))})` }} />
                  <div className="absolute inset-y-0 right-0 rounded-r bg-bad-soft" style={{ left: pos(th) }} />
                  <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: pos(th) }} aria-hidden />
                </>
              )}
              {row.risks.map((r) => {
                const n = seen.get(r.residual) ?? 0;
                seen.set(r.residual, n + 1);
                const out = th !== null && r.residual > th;
                return (
                  <Link
                    key={r.id}
                    href={`/records/${r.id}`}
                    title={`${r.ref} ${r.title}: residual ${r.residual}${r.target ? `, target ${r.target}` : ""}`}
                    className={`absolute -translate-x-1/2 rounded px-1 text-[11px] font-semibold leading-4 ring-1 ring-white hover:z-10 hover:scale-110 ${out ? "bg-bad text-white" : "bg-ink text-white"}`}
                    style={{ left: pos(r.residual), top: `${4 + (n % 2) * 18}px` }}
                  >
                    {r.ref.replace("RSK-", "")}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-xs text-ink-3">Each mark is a risk at its residual score. The black rule is the approved appetite for that category; marks past it are outside appetite.</p>
    </div>
  );
}
