import Link from "next/link";
import { labelize } from "@/lib/domain";

const TONES: Record<string, string> = {
  LOW: "good",
  WITHIN: "good",
  GREEN: "good",
  COMPLIANT: "good",
  APPROVED: "good",
  ATTESTED: "good",
  COMPLETED: "good",
  EFFECTIVE: "good",
  MEETS: "good",
  EXCEEDS: "good",
  ON_TRACK: "good",
  ACHIEVED: "good",
  MEDIUM: "warn",
  APPROACHING: "warn",
  AMBER: "warn",
  PARTIAL: "warn",
  PARTIALLY_EFFECTIVE: "warn",
  IN_REVIEW: "warn",
  IN_PROGRESS: "warn",
  SUBMITTED: "warn",
  MITIGATING: "warn",
  AT_RISK: "warn",
  HIGH: "bad",
  SEVERE: "bad",
  ABOVE: "bad",
  RED: "bad",
  NON_COMPLIANT: "bad",
  OVERDUE: "bad",
  INEFFECTIVE: "bad",
  RETURNED: "bad",
  BELOW: "bad",
  CRITICAL: "bad",
};

export function Pill({ value, children }: { value?: string; children?: React.ReactNode }) {
  const key = value ?? "";
  const tone = TONES[key] ?? "neutral";
  return <span className={`pill ${tone}`}>{children ?? labelize(key)}</span>;
}

export function PageHead({
  kicker,
  title,
  lede,
  children,
}: {
  kicker?: string;
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1>{title}</h1>
        {lede ? <p>{lede}</p> : null}
      </div>
      <div className="row">{children}</div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted">{children}</p>;
}

export function Filters({
  items,
}: {
  items: Array<{ href: string; label: string; on?: boolean }>;
}) {
  return (
    <div className="filters">
      {items.map((item) => (
        <Link key={item.href + item.label} href={item.href} className={item.on ? "on" : ""}>
          {item.label}
        </Link>
      ))}
    </div>
  );
}
