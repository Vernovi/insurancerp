import { TONE_CLASS, toneFor, type Tone } from "@/lib/format";

export function Pill({ label, tone }: { label: string; tone?: Tone | null }) {
  if (!label) return null;
  return <span className={`inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold ${TONE_CLASS[tone ?? "neutral"]}`}>{label}</span>;
}

/** Renders a value, coloured when it is a known status word. */
export function Val({ v }: { v: string }) {
  const t = toneFor(v);
  return t ? <Pill label={v} tone={t} /> : <>{v}</>;
}
