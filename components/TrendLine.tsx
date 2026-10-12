import { fmtDate, fmtNumber } from "@/lib/format";

export default function TrendLine({ points, amber, red, unit }: { points: { date: string; value: number }[]; amber?: number | null; red?: number | null; unit?: string }) {
  if (points.length === 0) return <p className="text-sm text-ink-2">No readings yet. Add the first one below.</p>;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const vals = [...sorted.map((p) => p.value), ...(amber != null ? [amber] : []), ...(red != null ? [red] : [])];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const pad = (hi - lo || 1) * 0.15;
  const W = 560, H = 160, L = 44, R = 12, T = 12, B = 28;
  const x = (i: number) => L + (sorted.length === 1 ? (W - L - R) / 2 : (i / (sorted.length - 1)) * (W - L - R));
  const y = (v: number) => T + (1 - (v - (lo - pad)) / (hi + pad - (lo - pad))) * (H - T - B);
  const path = sorted.map((p, i) => `${i ? "L" : "M"}${x(i)} ${y(p.value)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label={`Trend of ${sorted.length} readings; latest ${fmtNumber(sorted.at(-1)!.value)} ${unit ?? ""}`}>
      {amber != null && <line x1={L} x2={W - R} y1={y(amber)} y2={y(amber)} stroke="var(--color-warn)" strokeDasharray="4 4" />}
      {red != null && <line x1={L} x2={W - R} y1={y(red)} y2={y(red)} stroke="var(--color-bad)" strokeDasharray="4 4" />}
      {amber != null && <text x={W - R} y={y(amber) - 4} textAnchor="end" fontSize="11" fill="var(--color-warn)">Amber {fmtNumber(amber)}</text>}
      {red != null && <text x={W - R} y={y(red) - 4} textAnchor="end" fontSize="11" fill="var(--color-bad)">Red {fmtNumber(red)}</text>}
      <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      {sorted.map((p, i) => (
        <g key={p.date + i}>
          <circle cx={x(i)} cy={y(p.value)} r="3.5" fill="var(--color-accent)" />
          <text x={x(i)} y={y(p.value) - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink)">{fmtNumber(p.value)}</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-3)">{fmtDate(p.date)}</text>
        </g>
      ))}
    </svg>
  );
}
