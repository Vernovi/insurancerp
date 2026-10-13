import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "./db";
import { RISK_CATEGORIES } from "./defs/modules";
import type { StripRow } from "@/components/AppetiteStrip";
import type { HeatRisk } from "@/components/HeatMap";
import type { PermUser } from "./engine/permissions";
import { inScope, loadEntities, type Scope } from "./scope";

export async function riskViews(user: PermUser, scope: Scope) {
  const db = await getDb();
  const risks = (await db.select().from(schema.records).where(and(eq(schema.records.typeKey, "risk"), inArray(schema.records.status, ["active", "submitted"])))).filter((r) => inScope(r, scope, user));
  const allApps = await db.select().from(schema.records).where(and(eq(schema.records.typeKey, "appetite"), eq(schema.records.status, "approved")));
  // With one entity selected, its own appetite wins over the group's; for the whole group, show group appetite.
  const groupIds = new Set((await loadEntities()).filter((e) => e.kind === "group").map((e) => e.id));
  const groupLevel = (a: (typeof allApps)[number]) => a.entityId === null || groupIds.has(a.entityId);
  const appetites = scope.selected ? [...allApps.filter((a) => a.entityId === scope.selected!.id), ...allApps.filter(groupLevel)] : allApps.filter(groupLevel);
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
      .map((r) => ({ id: r.id, ref: r.ref, title: r.title, residual: d(r).residual_score as number, target: (d(r).target_score as number) ?? null, outside: d(r).appetite_status === "Outside appetite" }))
      .sort((a, b) => a.residual - b.residual),
  })).filter((row) => row.risks.length > 0 || row.threshold !== null);
  const heat = (kind: "residual" | "inherent"): HeatRisk[] =>
    risks
      .filter((r) => d(r)[`${kind}_likelihood`] && d(r)[`${kind}_impact`])
      .map((r) => ({ id: r.id, ref: r.ref, title: r.title, l: Number(d(r)[`${kind}_likelihood`]), i: Number(d(r)[`${kind}_impact`]) }));
  const top = [...risks].filter((r) => r.status === "active").sort((a, b) => Number(d(b).residual_score ?? 0) - Number(d(a).residual_score ?? 0)).slice(0, 10);
  return { strip, heat, top, risks };
}
