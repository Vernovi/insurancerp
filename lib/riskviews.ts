import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "./db";
import { RISK_CATEGORIES } from "./defs/modules";
import type { StripRow } from "@/components/AppetiteStrip";
import type { HeatRisk } from "@/components/HeatMap";

export async function riskViews() {
  const db = await getDb();
  const risks = await db.select().from(schema.records).where(and(eq(schema.records.typeKey, "risk"), inArray(schema.records.status, ["active", "submitted"])));
  const appetites = await db.select().from(schema.records).where(and(eq(schema.records.typeKey, "appetite"), eq(schema.records.status, "approved")));
  const d = (r: (typeof risks)[number]) => r.data as Record<string, unknown>;
  const thresholdFor = (c: string) => {
    const a = appetites.find((x) => (x.data as Record<string, unknown>).category === c);
    return a ? Number((a.data as Record<string, unknown>).threshold) : null;
  };
  const strip: StripRow[] = RISK_CATEGORIES.map((category) => ({
    category,
    threshold: thresholdFor(category),
    risks: risks
      .filter((r) => d(r).category === category && typeof d(r).residual_score === "number")
      .map((r) => ({ id: r.id, ref: r.ref, title: r.title, residual: d(r).residual_score as number, target: (d(r).target_score as number) ?? null }))
      .sort((a, b) => a.residual - b.residual),
  })).filter((row) => row.risks.length > 0 || row.threshold !== null);
  const heat = (kind: "residual" | "inherent"): HeatRisk[] =>
    risks
      .filter((r) => d(r)[`${kind}_likelihood`] && d(r)[`${kind}_impact`])
      .map((r) => ({ id: r.id, ref: r.ref, title: r.title, l: Number(d(r)[`${kind}_likelihood`]), i: Number(d(r)[`${kind}_impact`]) }));
  const top = [...risks].filter((r) => r.status === "active").sort((a, b) => Number(d(b).residual_score ?? 0) - Number(d(a).residual_score ?? 0)).slice(0, 10);
  return { strip, heat, top, risks };
}
