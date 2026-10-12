// Module-specific business logic. The engine is generic; these hooks add the
// insurance rules: scoring, appetite, KRIs, triage, regulatory clocks, and the
// cross-module side effects shown in the PRD integration map.
import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "../db";
import * as schema from "../db/schema";
import type { TypeDef, Role } from "../defs/types";
import {
  addDays,
  addMonths,
  appetiteStatus,
  auditPriority,
  caseClock,
  declarationTriage,
  kriStatus,
  num,
  rating,
  reviewDays,
  score,
  severityFromAmount,
  thirdPartyTier,
  today,
} from "./pure";
import { WALLED_CASE_TYPES } from "../defs/modules";

export interface HookRecord {
  id: number;
  typeKey: string;
  ref: string;
  title: string;
  status: string;
  ownerId: number | null;
  orgUnitId: number | null;
  createdBy: number | null;
  data: Record<string, unknown>;
}

export interface HookCtx {
  db: DB;
  actorId: number | null;
  /** Create a record as the system, linked to `linkTo` when given. */
  createRecord(typeKey: string, input: { title: string; ownerId: number | null; orgUnitId?: number | null; data: Record<string, unknown>; status?: string }, linkTo?: { id: number; kind: string }): Promise<HookRecord>;
  /** Update data fields on another record (re-runs compute, writes a version). */
  patchRecord(id: number, patch: Record<string, unknown>, note: string): Promise<void>;
  linked(id: number, typeKey?: string): Promise<HookRecord[]>;
  createLink(fromId: number, toId: number, kind: string): Promise<void>;
  notifyUsers(userIds: (number | null | undefined)[], recordId: number, message: string): Promise<void>;
  notifyRoles(roles: Role[], recordId: number, message: string): Promise<void>;
}

const RBC_BY_CATEGORY: Record<string, string> = {
  "Insurance risk": "Insurance",
  "Market risk": "Market",
  "Credit risk": "Credit",
  "Liquidity risk": "Market",
  "Operational risk": "Operational",
  "Compliance and conduct": "Operational",
  Strategic: "Not applicable",
  "ESG and climate": "Insurance",
};

/** Compute derived fields before save. Returns the new data and the record's due date. */
export async function compute(
  def: TypeDef,
  data: Record<string, unknown>,
  ctx: { db: DB; createdAt?: Date },
): Promise<{ data: Record<string, unknown>; dueDate: string | null }> {
  const d = { ...data };
  let due: string | null = def.dueField ? ((d[def.dueField] as string) ?? null) : null;

  switch (def.hook) {
    case "risk": {
      d.inherent_score = score(d.inherent_likelihood, d.inherent_impact);
      d.residual_score = score(d.residual_likelihood, d.residual_impact);
      d.target_score = score(d.target_likelihood, d.target_impact);
      const r = rating(d.residual_score as number | null);
      d.rating = r;
      let threshold: number | null = null;
      if (d.category) {
        const [a] = await ctx.db
          .select()
          .from(schema.records)
          .where(and(eq(schema.records.typeKey, "appetite"), eq(schema.records.status, "approved"), sql`${schema.records.data}->>'category' = ${String(d.category)}`))
          .orderBy(desc(schema.records.updatedAt))
          .limit(1);
        threshold = a ? num((a.data as Record<string, unknown>).threshold) : null;
      }
      d.appetite_threshold = threshold;
      d.appetite_status = appetiteStatus(d.residual_score as number | null, threshold);
      if (!d.rbc_type && d.category) d.rbc_type = RBC_BY_CATEGORY[String(d.category)] ?? null;
      const base = (d.last_review as string) || (ctx.createdAt ? ctx.createdAt.toISOString().slice(0, 10) : today());
      d.next_review = addDays(base, reviewDays(r));
      due = d.next_review as string;
      break;
    }
    case "kri":
    case "esg_metric": {
      const readings = Array.isArray(d.readings) ? (d.readings as { date: string; value: number }[]) : [];
      const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date));
      const last = sorted.at(-1);
      d.latest_value = last ? last.value : null;
      d.latest_date = last ? last.date : null;
      if (def.hook === "kri") {
        d.kri_status = kriStatus(last ? last.value : null, num(d.amber_limit), num(d.red_limit), d.direction as string);
      } else {
        const f = num(d.emission_factor);
        d.latest_tco2e = last && f !== null && d.scope && d.scope !== "Not an emissions metric" ? Math.round(((last.value * f) / 1000) * 100) / 100 : null;
      }
      break;
    }
    case "loss": {
      const g = num(d.gross_loss) ?? 0;
      const rec = num(d.recoveries) ?? 0;
      d.net_loss = d.near_miss ? 0 : g - rec;
      break;
    }
    case "action": {
      if (!d.original_due_date && d.due_date) d.original_due_date = d.due_date;
      if (d.extensions === undefined || d.extensions === null) d.extensions = 0;
      due = (d.due_date as string) ?? null;
      break;
    }
    case "declaration": {
      d.triage = declarationTriage(d);
      break;
    }
    case "case": {
      d.clock_due = caseClock(d.case_type, d.reported_date);
      if (!d.severity) d.severity = severityFromAmount(num(d.amount_at_risk));
      due = (d.clock_due as string) ?? null;
      break;
    }
    case "third_party": {
      const t = thirdPartyTier(d);
      d.tier = t.tier;
      const base = (d.last_assessment as string) || today();
      d.next_assessment = d.last_assessment ? addMonths(base, t.reassessMonths) : base;
      due = d.next_assessment as string;
      break;
    }
    case "audit_entity": {
      d.priority_score = auditPriority(d.inherent_risk, d.last_audit, d.regulatory_focus);
      break;
    }
  }
  return { data: d, dueDate: due };
}

/** Adjust data and possibly the target status when a transition fires (before save). */
export function onTransition(
  def: TypeDef,
  key: string,
  to: string,
  data: Record<string, unknown>,
): { data: Record<string, unknown>; to: string } {
  const d = { ...data };
  let target = to;
  if (def.hook === "risk" && key === "review") d.last_review = today();
  if (def.hook === "attestation" && key === "attest") {
    d.attested_on = today();
    d.acknowledged = true;
  }
  if (def.hook === "action" && key === "approve_ext") {
    d.due_date = d.new_due_date;
    d.extensions = (num(d.extensions) ?? 0) + 1;
    d.new_due_date = null;
  }
  if (def.hook === "action" && key === "reject_ext") d.new_due_date = null;
  if (def.hook === "declaration" && key === "submit") {
    const t = declarationTriage(d);
    if (t === "Nil return") {
      target = "filed";
      d.review_outcome = "No conflict";
    } else if (t === "Compliance review") target = "compliance_review";
  }
  if (def.hook === "control_test" && key === "approve" && !d.test_date) d.test_date = today();
  return { data: d, to: target };
}

/** Side effects after a record is created, updated or transitioned. */
export async function after(
  event: "create" | "update" | "transition",
  def: TypeDef,
  rec: HookRecord,
  prev: HookRecord | null,
  ctx: HookCtx,
  transitionKey?: string,
): Promise<void> {
  const d = rec.data;
  switch (def.hook) {
    case "risk": {
      const openBreach = (await ctx.linked(rec.id, "action")).some(
        (a) => a.data.source === "Appetite breach" && !["closed", "cancelled"].includes(a.status),
      );
      if (d.appetite_status === "Outside appetite" && rec.status === "active" && !openBreach) {
        const action = await ctx.createRecord(
          "action",
          {
            title: `Appetite breach: ${rec.title}`,
            ownerId: rec.ownerId,
            orgUnitId: rec.orgUnitId,
            data: {
              source: "Appetite breach",
              description: `Residual score ${d.residual_score} exceeds the appetite threshold of ${d.appetite_threshold} for ${d.category}. Justify, treat, or request formal risk acceptance.`,
              priority: "High",
              due_date: addDays(today(), 14),
            },
          },
          { id: rec.id, kind: "treats" },
        );
        await ctx.notifyRoles(["cro"], rec.id, `${rec.ref} is outside appetite (residual ${d.residual_score} vs ${d.appetite_threshold}). ${action.ref} opened.`);
      }
      break;
    }
    case "appetite": {
      if (event === "transition" && rec.status === "approved") {
        const risks = await ctx.db
          .select({ id: schema.records.id })
          .from(schema.records)
          .where(and(eq(schema.records.typeKey, "risk"), sql`${schema.records.data}->>'category' = ${String(d.category)}`));
        for (const r of risks) await ctx.patchRecord(r.id, {}, `Re-evaluated against approved appetite ${rec.ref}`);
      }
      break;
    }
    case "kri": {
      if (d.kri_status === "Red" && prev?.data.kri_status !== "Red") {
        await ctx.notifyUsers([rec.ownerId], rec.id, `${rec.ref} ${rec.title} breached its red threshold (${d.latest_value}).`);
        await ctx.notifyRoles(["cro"], rec.id, `KRI ${rec.ref} is red: ${rec.title} at ${d.latest_value}.`);
      }
      break;
    }
    case "action": {
      if (event === "create" && rec.ownerId && rec.ownerId !== ctx.actorId) {
        await ctx.notifyUsers([rec.ownerId], rec.id, `You have been assigned ${rec.ref}: ${rec.title}. Due ${d.due_date}.`);
      }
      if (event === "transition" && transitionKey === "request_ext") {
        await ctx.notifyRoles(["risk", "cro"], rec.id, `Extension requested on ${rec.ref} to ${d.new_due_date}.`);
      }
      if (event === "transition" && transitionKey === "ready") {
        await ctx.notifyUsers([d.validator as number], rec.id, `${rec.ref} is ready for your validation.`);
      }
      if (event === "transition" && transitionKey === "validate") {
        const risks = await ctx.linked(rec.id, "risk");
        for (const r of risks) await ctx.notifyUsers([r.ownerId], r.id, `${rec.ref} has closed. Review the residual score of ${r.ref}.`);
      }
      break;
    }
    case "control_test": {
      if (event === "transition" && transitionKey === "approve") {
        const controls = await ctx.linked(rec.id, "control");
        const opRating = d.result === "Pass" ? "Effective" : d.result === "Pass with exceptions" ? "Partially effective" : "Ineffective";
        for (const c of controls) await ctx.patchRecord(c.id, { operating_rating: opRating, last_test: d.test_date ?? today() }, `Updated by test ${rec.ref}`);
        if (d.result === "Fail") {
          const finding = await ctx.createRecord(
            "finding",
            {
              title: `Control failure: ${rec.title}`,
              ownerId: controls[0]?.ownerId ?? rec.ownerId,
              data: { source: "Compliance test", rating: "High", condition: String(d.evidence ?? "Control test failed."), criteria: String(d.procedure ?? "") },
              status: "open",
            },
            { id: rec.id, kind: "raised-by" },
          );
          for (const c of controls) await ctx.createLink(finding.id, c.id, "concerns");
          await ctx.createRecord(
            "action",
            {
              title: `Remediate: ${rec.title}`,
              ownerId: controls[0]?.ownerId ?? rec.ownerId,
              data: { source: "Control test", description: "Fix the control failure and evidence the fix.", priority: "High", due_date: addDays(today(), 30) },
            },
            { id: finding.id, kind: "remediates" },
          );
        }
      }
      break;
    }
    case "declaration": {
      if (event === "transition" && rec.status === "compliance_review") {
        await ctx.notifyRoles(["compliance"], rec.id, `${rec.ref} needs Compliance review (${d.decl_type}).`);
      }
      if (event === "transition" && rec.status === "completed" && d.review_outcome === "Conflict managed with conditions" && d.conditions) {
        await ctx.createRecord(
          "action",
          {
            title: `Apply declaration conditions: ${rec.ref}`,
            ownerId: rec.ownerId,
            data: { source: "Other", description: String(d.conditions), priority: "Medium", due_date: addDays(today(), 14) },
          },
          { id: rec.id, kind: "remediates" },
        );
      }
      break;
    }
    case "case": {
      if (event === "create") {
        const ct = String(d.case_type);
        const roles: Role[] = WALLED_CASE_TYPES.includes(ct) ? ["investigator", "mlro"] : ct === "HSE incident" ? ["hse"] : ["compliance", "risk"];
        await ctx.notifyRoles(roles, rec.id, `New ${ct.toLowerCase()} ${rec.ref}${d.clock_due ? `; clock due ${d.clock_due}` : ""}.`);
      }
      if (event === "transition" && rec.status === "closed") {
        const loss = num(d.amount_written_off);
        if (loss && loss > 0) {
          await ctx.createRecord(
            "loss_event",
            {
              title: `Loss from ${rec.ref}: ${rec.title}`,
              ownerId: rec.ownerId,
              data: {
                event_date: d.reported_date ?? today(),
                description: String(d.findings ?? d.description ?? ""),
                event_type: ["Suspected claims fraud"].includes(String(d.case_type)) ? "External fraud" : d.case_type === "Internal fraud or misconduct" ? "Internal fraud" : "Execution, delivery and process management",
                gross_loss: loss,
                recoveries: 0,
                root_cause: d.root_cause ?? null,
              },
              status: "reported",
            },
            { id: rec.id, kind: "caused-by" },
          );
        }
      }
      break;
    }
    case "tp_assessment": {
      if (event === "transition" && rec.status === "completed") {
        for (const tp of await ctx.linked(rec.id, "third_party")) {
          await ctx.patchRecord(tp.id, { last_assessment: d.assessment_date ?? today() }, `Assessment ${rec.ref} completed: ${d.overall}`);
        }
      }
      break;
    }
    case "bc_exercise": {
      if (event === "transition" && rec.status === "completed") {
        const services = await ctx.linked(rec.id, "business_service");
        const within = d.met_tolerance === "Yes";
        for (const s of services) {
          await ctx.patchRecord(s.id, { last_exercise: d.exercise_date ?? today(), tolerance_status: within ? "Within tolerance" : "Outside tolerance" }, `Exercise ${rec.ref}`);
        }
        if (!within) {
          const svc = services[0];
          const risk = await ctx.createRecord(
            "risk",
            {
              title: `${svc ? svc.title : rec.title} cannot recover within impact tolerance`,
              ownerId: svc?.ownerId ?? rec.ownerId,
              data: {
                description: `Exercise ${rec.ref} (${d.scenario}) took ${d.recovery_hours} hours to recover${svc ? `, beyond the ${svc.data.tolerance_hours}-hour tolerance` : ""}.`,
                category: "Operational risk",
                subcategory: "Business continuity",
                inherent_likelihood: 3,
                inherent_impact: 5,
                residual_likelihood: 3,
                residual_impact: 4,
                cause: String(d.lessons ?? ""),
              },
              status: "submitted",
            },
            { id: rec.id, kind: "raised-by" },
          );
          if (svc) await ctx.createLink(risk.id, svc.id, "threatens");
          await ctx.notifyRoles(["cro", "risk"], risk.id, `${svc?.title ?? "A service"} failed its impact tolerance in ${rec.ref}; ${risk.ref} raised.`);
        }
      }
      break;
    }
  }
}
