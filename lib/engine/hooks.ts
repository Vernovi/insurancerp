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
  capitalCover,
  CASE_CLOCK_BASIS,
  caseClock,
  declarationTriage,
  fcrPublishDue,
  filingStatus,
  kriStatus,
  lossBand,
  lossFigures,
  lossProblems,
  nextDue,
  num,
  orsaDue,
  rating,
  reviewDays,
  score,
  severityFromAmount,
  thirdPartyTier,
  today,
} from "./pure";
import { WALLED_CASE_TYPES } from "../defs/modules";
import { EngineError } from "./errors";

export interface HookRecord {
  id: number;
  typeKey: string;
  ref: string;
  title: string;
  status: string;
  ownerId: number | null;
  orgUnitId: number | null;
  entityId: number | null;
  createdBy: number | null;
  data: Record<string, unknown>;
}

export interface HookCtx {
  db: DB;
  actorId: number | null;
  /** Create a record as the system, linked to `linkTo` when given. */
  createRecord(typeKey: string, input: { title: string; ownerId: number | null; orgUnitId?: number | null; entityId?: number | null; data: Record<string, unknown>; status?: string }, linkTo?: { id: number; kind: string }): Promise<HookRecord>;
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
  "Intra-group contagion": "Operational",
  "Related-party exposure": "Credit",
  "Concentration in own funds": "Market",
  "Shariah non-compliance": "Operational",
};

/** Roll a period label forward: "Q4 2026" -> "Q1 2027", "FY2025" -> "FY2026", "H1 2026" -> "H2 2026", "Sep 2026" -> "Oct 2026". */
export function rollPeriod(period: unknown, recurrence: unknown): string | null {
  const p = String(period ?? "").trim();
  let m = /^Q([1-4]) (\d{4})$/.exec(p);
  if (m) return Number(m[1]) === 4 ? `Q1 ${Number(m[2]) + 1}` : `Q${Number(m[1]) + 1} ${m[2]}`;
  m = /^FY ?(\d{4})$/.exec(p);
  if (m) return `FY${Number(m[1]) + 1}`;
  m = /^H([12]) (\d{4})$/.exec(p);
  if (m) return m[1] === "1" ? `H2 ${m[2]}` : `H1 ${Number(m[2]) + 1}`;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  m = /^([A-Z][a-z]{2}) (\d{4})$/.exec(p);
  if (m && recurrence === "Monthly" && months.includes(m[1])) {
    const i = months.indexOf(m[1]);
    return i === 11 ? `Jan ${Number(m[2]) + 1}` : `${months[i + 1]} ${m[2]}`;
  }
  return null;
}

/** Pick the appetite that applies to a risk: the entity's own approved appetite, else the group appetite. */
export function pickAppetite<T extends { entityId: number | null }>(apps: T[], entityId: number | null, groupLevel: (a: T) => boolean): T | null {
  return apps.find((a) => entityId !== null && a.entityId === entityId) ?? apps.find(groupLevel) ?? null;
}

/** Compute derived fields before save. Returns the new data and the record's due date. */
export async function compute(
  def: TypeDef,
  data: Record<string, unknown>,
  ctx: { db: DB; createdAt?: Date; entityId?: number | null },
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
        const apps = await ctx.db
          .select()
          .from(schema.records)
          .where(and(eq(schema.records.typeKey, "appetite"), eq(schema.records.status, "approved"), sql`${schema.records.data}->>'category' = ${String(d.category)}`))
          .orderBy(desc(schema.records.updatedAt));
        const groupIds = new Set((await ctx.db.select({ id: schema.entities.id }).from(schema.entities).where(eq(schema.entities.kind, "group"))).map((x) => x.id));
        const a = pickAppetite(apps, ctx.entityId ?? null, (x) => x.entityId === null || groupIds.has(x.entityId));
        threshold = a ? num((a.data as Record<string, unknown>).threshold) : null;
        d.appetite_source = a ? (a.entityId !== null && a.entityId === (ctx.entityId ?? null) && !groupIds.has(a.entityId) ? "Entity appetite" : "Group appetite") : null;
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
      if (def.hook === "kri" && d.kri_kind === "Capital vs requirement") {
        const c = capitalCover(last ? last.value : null, num(d.requirement), num(d.buffer_pct) ?? 20);
        d.latest_ratio = c.ratio;
        d.kri_status = c.status;
      } else if (def.hook === "kri") {
        d.kri_status = kriStatus(last ? last.value : null, num(d.amber_limit), num(d.red_limit), d.direction as string);
      } else {
        const f = num(d.emission_factor);
        d.latest_tco2e = last && f !== null && d.scope && d.scope !== "Not an emissions metric" ? Math.round(((last.value * f) / 1000) * 100) / 100 : null;
      }
      break;
    }
    case "loss": {
      if (!d.currency) d.currency = "NGN";
      if (d.event_source === "Near miss") d.near_miss = true;
      const problem = lossProblems(d, today());
      if (problem) throw new EngineError(problem);
      const f = lossFigures(d);
      d.net_loss = f.net;
      d.net_loss_ngn = f.netNgn;
      d.gross_loss_ngn = f.grossNgn;
      d.threshold_band = lossBand(f.netNgn, d.near_miss === true);
      break;
    }
    case "recurring_filing": {
      if (!d.due_date && d.arrangement_date && String(d.notice_type ?? "").startsWith("Initial")) d.due_date = addDays(String(d.arrangement_date), 30);
      d.filing_status = filingStatus((d.due_date as string) ?? null, (d.submitted_date as string) || null);
      due = (d.due_date as string) ?? null;
      break;
    }
    case "orsa": {
      d.due_date = orsaDue(d.year_end);
      d.filing_status = filingStatus((d.due_date as string) ?? null, (d.submitted_date as string) || null);
      due = (d.due_date as string) ?? null;
      break;
    }
    case "fcr": {
      d.publish_due = fcrPublishDue(d.report_date);
      due = (d.publish_due as string) ?? null;
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
      d.clock_basis = CASE_CLOCK_BASIS[String(d.case_type)] ?? null;
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
  actorId: number | null = null,
): { data: Record<string, unknown>; to: string } {
  const d = { ...data };
  let target = to;
  const t = def.workflow.transitions.find((x) => x.key === key);
  if (t?.stamp) {
    d[t.stamp.by] = actorId;
    d[t.stamp.on] = today();
  }
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
            entityId: rec.entityId,
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
              entityId: rec.entityId,
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
              entityId: rec.entityId,
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
    case "recurring_filing": {
      if (event === "transition" && rec.status === "submitted") {
        const dueDate = String(d.due_date ?? "");
        if (d.submitted_date && dueDate && String(d.submitted_date) > dueDate) {
          await ctx.notifyRoles(["compliance", "cro"], rec.id, `${rec.ref} ${rec.title} was filed after its due date (${dueDate}). Record the reason.`);
        }
        const isInitial = String(d.notice_type ?? "").startsWith("Initial");
        const rec2 = isInitial ? "Semi-annual" : d.recurrence;
        const nd = dueDate ? nextDue(dueDate, rec2) : null;
        if (nd) {
          const period = rollPeriod(d.period, d.recurrence);
          const title = period && d.period ? rec.title.replace(String(d.period), period) : rec.title.replace(/^Initial notification/i, "Six-monthly report");
          const next = await ctx.createRecord(
            def.key,
            {
              title,
              ownerId: rec.ownerId,
              orgUnitId: rec.orgUnitId,
              entityId: rec.entityId,
              data: {
                ...d,
                period: period ?? d.period ?? null,
                notice_type: isInitial ? "Six-monthly report" : d.notice_type,
                recurrence: isInitial ? "Semi-annual" : d.recurrence,
                due_date: nd,
                submitted_date: null,
                reference: null,
                filing_status: null,
              },
              status: "scheduled",
            },
            { id: rec.id, kind: "next-period" },
          );
          await ctx.notifyUsers([rec.ownerId], next.id, `${next.ref} scheduled: ${next.title}, due ${nd}.`);
        }
      }
      break;
    }
    case "orsa": {
      if (event === "transition" && transitionKey === "compile") {
        const all = await ctx.db.select().from(schema.records).where(sql`${schema.records.typeKey} in ('risk','kri','appetite','loss_event')`);
        const scoped = all.filter((r) => rec.entityId === null || r.entityId === rec.entityId || (r.typeKey === "appetite" && r.entityId === null));
        const risks = scoped.filter((r) => r.typeKey === "risk" && r.status === "active");
        const dd = (r: (typeof all)[number]) => r.data as Record<string, unknown>;
        const byCat = new Map<string, { n: number; out: number; top: number }>();
        for (const r of risks) {
          const c = String(dd(r).category ?? "Uncategorised");
          const e = byCat.get(c) ?? { n: 0, out: 0, top: 0 };
          e.n++;
          if (dd(r).appetite_status === "Outside appetite") e.out++;
          e.top = Math.max(e.top, Number(dd(r).residual_score ?? 0));
          byCat.set(c, e);
        }
        const kris = scoped.filter((r) => r.typeKey === "kri" && r.status === "active");
        const red = kris.filter((k) => dd(k).kri_status === "Red");
        const losses = scoped.filter((r) => r.typeKey === "loss_event").reduce((n, r) => n + (Number(dd(r).net_loss_ngn) || 0), 0);
        const lines = [
          `${risks.length} active risks; ${risks.filter((r) => dd(r).appetite_status === "Outside appetite").length} outside appetite.`,
          ...[...byCat.entries()].map(([c, e]) => `${c}: ${e.n} risks, highest residual ${e.top}${e.out ? `, ${e.out} outside appetite` : ""}.`),
          `${kris.length} KRIs monitored; ${red.length} red${red.length ? `: ${red.map((k) => k.title).join("; ")}` : ""}.`,
          `Net operational losses recorded: NGN ${Math.round(losses / 1e6).toLocaleString("en-GB")}m.`,
        ];
        const capital = kris.filter((k) => dd(k).kri_kind === "Capital vs requirement");
        const capLines = capital.length
          ? capital.map((k) => `${k.title}: latest NGN ${(Number(dd(k).latest_value) / 1e9).toFixed(1)}bn against a requirement of NGN ${(Number(dd(k).requirement) / 1e9).toFixed(1)}bn, cover ${dd(k).latest_ratio}% (${dd(k).kri_status}), as at ${dd(k).latest_date}.`)
          : ["No capital KRI recorded for this entity. Add a 'Capital vs requirement' KRI."];
        await ctx.patchRecord(rec.id, { register_summary: lines.join("\n"), capital_summary: capLines.join("\n"), compiled_on: today() }, "Compiled from the register");
      }
      if (event === "transition" && rec.status === "board_review") {
        await ctx.notifyRoles(["board"], rec.id, `${rec.ref} ${rec.title} is with the board for approval. Submission due ${d.due_date}.`);
      }
      break;
    }
    case "rm_declaration": {
      if (event === "transition" && rec.status === "first_signed") {
        await ctx.notifyRoles(["board"], rec.id, `${rec.ref} has one director's signature and needs a second, different director.`);
      }
      break;
    }
    case "loss": {
      for (const [field, type, kind] of [["risk_ref", "risk", "materialised"], ["case_ref", "case", "caused-by"]] as const) {
        const ref = String(d[field] ?? "").trim().toUpperCase();
        if (!ref || ref === String(prev?.data[field] ?? "").trim().toUpperCase()) continue;
        const [target] = await ctx.db.select({ id: schema.records.id, typeKey: schema.records.typeKey }).from(schema.records).where(eq(schema.records.ref, ref));
        if (target && target.typeKey === type) await ctx.createLink(target.id, rec.id, kind);
      }
      if (d.threshold_band === "Board-reportable" && prev?.data.threshold_band !== "Board-reportable") {
        await ctx.notifyRoles(["cro"], rec.id, `${rec.ref} is a board-reportable loss (net NGN ${Math.round(Number(d.net_loss_ngn) / 1e6)}m).`);
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
              entityId: rec.entityId,
              data: {
                event_date: d.reported_date ?? today(),
                description: String(d.findings ?? d.description ?? ""),
                event_type: ["Suspected claims fraud"].includes(String(d.case_type)) ? "External fraud" : d.case_type === "Internal fraud or misconduct" ? "Internal fraud" : "Execution, delivery and process management",
                gross_loss: loss,
                recoveries: 0,
                currency: "NGN",
                event_source: "Internal loss",
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
              entityId: svc?.entityId ?? rec.entityId,
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
