import "server-only";
import { getDb, schema } from "./db";
import { today, claimsAgeing, filingStatus } from "./engine/pure";
import type { PermUser } from "./engine/permissions";
import { inScope, loadEntities, type Scope } from "./scope";

type Row = typeof schema.records.$inferSelect;
export type KpiStatus = "good" | "warn" | "bad" | "info";

export interface Kpi {
  label: string;
  module: string;
  value: string;
  detail: string;
  threshold: string;
  status: KpiStatus;
  href: string;
}

const pct = (a: number, b: number) => (b === 0 ? null : Math.round((a / b) * 100));

/** Board and Risk Committee KPI set (PRD section 15.1). Aggregates only, so confidential counts never expose content. */
export async function boardKpis(user: PermUser, scope: Scope): Promise<Kpi[]> {
  const db = await getDb();
  const all = (await db.select().from(schema.records)).filter((r) => inScope(r, scope, user));
  const t = today();
  const of = (k: string) => all.filter((r) => r.typeKey === k);
  const dget = (r: Row, k: string) => (r.data as Record<string, unknown>)[k];
  const k: Kpi[] = [];

  const risks = of("risk").filter((r) => r.status === "active");
  const outside = risks.filter((r) => dget(r, "appetite_status") === "Outside appetite");
  const outsidePrincipal = outside.filter((r) => dget(r, "principal") === true);
  k.push({
    label: "Risks outside appetite",
    module: "Enterprise risk",
    value: String(outside.length),
    detail: `${outsidePrincipal.length} principal, of ${risks.length} active risks`,
    threshold: "Red if any principal risk",
    status: outsidePrincipal.length ? "bad" : outside.length ? "warn" : "good",
    href: "/r/risk?field=appetite_status&value=Outside%20appetite",
  });
  const kris = of("kri").filter((r) => r.status === "active");
  const red = kris.filter((r) => dget(r, "kri_status") === "Red").length;
  const amber = kris.filter((r) => dget(r, "kri_status") === "Amber").length;
  k.push({ label: "KRIs at red", module: "Enterprise risk", value: String(red), detail: `${amber} amber, of ${kris.length} KRIs`, threshold: "Red if 3 or more", status: red >= 3 ? "bad" : red > 0 ? "warn" : "good", href: "/r/kri?field=kri_status&value=Red" });
  const overdueReviews = risks.filter((r) => r.dueDate && r.dueDate < t).length;
  const orp = pct(overdueReviews, risks.length) ?? 0;
  k.push({ label: "Risk reviews overdue", module: "Enterprise risk", value: `${orp}%`, detail: `${overdueReviews} of ${risks.length}`, threshold: "Red above 10%", status: orp > 10 ? "bad" : orp > 0 ? "warn" : "good", href: "/r/risk?overdue=1" });
  const models = of("model").filter((r) => r.status !== "retired");
  const modelsOverdue = models.filter((r) => r.dueDate && r.dueDate < t);
  const tier1 = modelsOverdue.filter((r) => dget(r, "materiality") === "Tier 1").length;
  k.push({ label: "Models overdue for validation", module: "Enterprise risk", value: String(modelsOverdue.length), detail: `${tier1} tier 1`, threshold: "Red if any tier 1", status: tier1 ? "bad" : modelsOverdue.length ? "warn" : "good", href: "/r/model?overdue=1" });

  const obls = of("obligation").filter((r) => r.status === "active");
  const compliant = obls.filter((r) => dget(r, "compliance_status") === "Compliant").length;
  const cp = pct(compliant, obls.length) ?? 0;
  k.push({ label: "Obligations fully compliant", module: "Compliance", value: `${cp}%`, detail: `${compliant} of ${obls.length} obligations`, threshold: "Red below 85%", status: cp < 85 ? "bad" : cp < 95 ? "warn" : "good", href: "/r/obligation" });
  const returns = [...of("reg_return"), ...of("outsourcing_notice")];
  const lateReturns = returns.filter((r) => r.status !== "submitted" && r.dueDate && r.dueDate < t).length;
  const dueSoon = returns.filter((r) => r.status !== "submitted" && r.dueDate && r.dueDate >= t && r.dueDate <= addDaysIso(t, 14)).length;
  k.push({ label: "Regulatory filings overdue", module: "Compliance", value: String(lateReturns), detail: `${dueSoon} due in the next 14 days`, threshold: "Red if any", status: lateReturns ? "bad" : dueSoon ? "warn" : "good", href: "/calendar" });
  const filedThisYear = returns.filter((r) => r.status === "submitted" && String(dget(r, "submitted_date") ?? "").startsWith(t.slice(0, 4)));
  const onTime = filedThisYear.filter((r) => filingStatus(String(dget(r, "due_date") ?? ""), String(dget(r, "submitted_date") ?? "")) === "Filed on time").length;
  const otp = pct(onTime, filedThisYear.length);
  k.push({ label: "Filings on time this year", module: "Compliance", value: otp === null ? "None filed" : `${otp}%`, detail: `${onTime} of ${filedThisYear.length} returns filed by their due date`, threshold: "Red below 100%", status: otp === null ? "info" : otp < 100 ? "bad" : "good", href: "/calendar?view=filed" });
  const prud = [...of("orsa"), ...of("rm_declaration")].filter((r) => r.status !== "submitted");
  const prudLate = prud.filter((r) => r.dueDate && r.dueDate < t).length;
  const prudSoon = prud.filter((r) => r.dueDate && r.dueDate >= t && r.dueDate <= addDaysIso(t, 90)).length;
  k.push({ label: "ORSA and Risk Management Declarations", module: "ORSA and declarations", value: prudLate ? `${prudLate} overdue` : `${prud.length} open`, detail: `${prudSoon} due in the next 90 days`, threshold: "Red if any overdue", status: prudLate ? "bad" : prudSoon ? "warn" : "good", href: "/m/prudential" });

  const actions = of("action").filter((r) => !["closed", "cancelled"].includes(r.status));
  const overdueActions = actions.filter((r) => r.dueDate && r.dueDate < t);
  const oap = pct(overdueActions.length, actions.length) ?? 0;
  const slip = of("action").reduce((s, r) => {
    const o = dget(r, "original_due_date") as string | undefined;
    const d = dget(r, "due_date") as string | undefined;
    return o && d && d > o ? s + Math.round((Date.parse(d) - Date.parse(o)) / 864e5) : s;
  }, 0);
  k.push({ label: "Actions overdue", module: "Actions", value: `${oap}%`, detail: `${overdueActions.length} of ${actions.length} open; ${slip} days slipped through extensions`, threshold: "Red above 15%", status: oap > 15 ? "bad" : oap > 0 ? "warn" : "good", href: "/r/action?overdue=1" });

  const atts = of("attestation").filter((r) => r.status !== "withdrawn");
  const attested = atts.filter((r) => r.status === "attested").length;
  const ap = pct(attested, atts.length);
  k.push({ label: "Policy attestation completion", module: "Policies", value: ap === null ? "None open" : `${ap}%`, detail: `${attested} of ${atts.length} requests`, threshold: "Red below 95% at campaign close", status: ap === null ? "info" : ap < 80 ? "bad" : ap < 95 ? "warn" : "good", href: "/r/attestation?status=pending" });
  const pols = of("policy").filter((r) => r.status === "published");
  const pastReview = pols.filter((r) => r.dueDate && r.dueDate < t);
  const boardPast = pastReview.filter((r) => ["Board", "Board committee"].includes(String(dget(r, "tier")))).length;
  k.push({ label: "Policies past review date", module: "Policies", value: String(pastReview.length), detail: `${boardPast} Board-tier`, threshold: "Red if any Board-tier", status: boardPast ? "bad" : pastReview.length ? "warn" : "good", href: "/r/policy?overdue=1" });

  const decls = of("declaration");
  const pendingDecl = decls.filter((r) => ["manager_review", "compliance_review"].includes(r.status)).length;
  const drafts = decls.filter((r) => r.status === "draft").length;
  k.push({ label: "Declarations awaiting review", module: "Declarations", value: String(pendingDecl), detail: `${drafts} not yet submitted`, threshold: "Amber if any", status: pendingDecl ? "warn" : "good", href: "/r/declaration?open=1" });

  const capital = of("kri").filter((r) => r.status === "active" && dget(r, "kri_kind") === "Capital vs requirement");
  if (capital.length) {
    const worst = [...capital].sort((a, b) => Number(dget(a, "latest_ratio") ?? 0) - Number(dget(b, "latest_ratio") ?? 0))[0];
    const st = String(dget(worst, "kri_status"));
    k.push({ label: "Capital against minimum requirement", module: "Enterprise risk", value: dget(worst, "latest_ratio") === null || dget(worst, "latest_ratio") === undefined ? "No data" : `${dget(worst, "latest_ratio")}%`, detail: `${worst.title}; lowest of ${capital.length}`, threshold: "Red below 100%, amber inside the buffer", status: st === "Red" ? "bad" : st === "Amber" ? "warn" : st === "Green" ? "good" : "info", href: `/records/${worst.id}` });
  }
  const ageing = claimsAgeing(of("case").map((r) => ({ caseType: String(dget(r, "case_type") ?? ""), reportedDate: (dget(r, "reported_date") as string) ?? null, open: r.status !== "closed" })), t);
  k.push({ label: "Open claims past the 60-day clock", module: "Cases", value: String(ageing.late), detail: `${ageing.open} open claims awaiting settlement or decision (NIIRA 2025 s.210)`, threshold: "Red if any", status: ageing.late ? "bad" : "good", href: "/r/case?field=case_type&value=Claim%20awaiting%20settlement%20or%20decision&overdue=1" });

  const cases = of("case").filter((r) => r.status !== "closed");
  const breached = cases.filter((r) => r.dueDate && r.dueDate < t).length;
  k.push({ label: "Open cases past their clock", module: "Cases", value: String(breached), detail: `${cases.length} open cases`, threshold: "Red if any regulatory clock breached", status: breached ? "bad" : "good", href: "/r/case?overdue=1" });
  const saved = of("case").reduce((s, r) => s + (Number(dget(r, "amount_saved")) || 0), 0);
  const yearStart = `${t.slice(0, 4)}-01-01`;
  const losses = of("loss_event").filter((r) => String(dget(r, "event_date") ?? "") >= yearStart && dget(r, "event_source") !== "External loss (industry or peer)").reduce((s, r) => s + (Number(dget(r, "net_loss_ngn")) || 0), 0);
  k.push({ label: "Net operational losses this year", module: "Cases and ERM", value: naira(losses), detail: `${naira(saved)} saved or recovered by investigations`, threshold: "Trend", status: "info", href: "/r/loss_event" });

  const esg = of("esg_metric").filter((r) => r.status === "active");
  const tco2 = esg.reduce((s, r) => s + (Number(dget(r, "latest_tco2e")) || 0), 0);
  const ltd = of("case").filter((r) => dget(r, "case_type") === "HSE incident").reduce((s, r) => s + (Number(dget(r, "lost_time_days")) || 0), 0);
  k.push({ label: "Scope 1 and 2 emissions, latest quarter", module: "ESG and HSE", value: `${Math.round(tco2)} tCO2e`, detail: `${ltd} lost-time days from HSE incidents`, threshold: "Off-track against target", status: "info", href: "/r/esg_metric" });

  const tps = of("third_party").filter((r) => r.status === "approved");
  const t1overdue = tps.filter((r) => dget(r, "tier") === "Tier 1" && r.dueDate && r.dueDate < t).length;
  const lic = tps.filter((r) => {
    const e = dget(r, "licence_expiry") as string | undefined;
    return e && e <= addDaysIso(t, 30);
  }).length;
  k.push({ label: "Tier 1 third parties overdue reassessment", module: "Third parties", value: String(t1overdue), detail: `${lic} licences expiring within 30 days`, threshold: "Red if any", status: t1overdue ? "bad" : lic ? "warn" : "good", href: "/r/third_party?overdue=1" });

  const year = Number(t.slice(0, 4));
  const plan = of("engagement").filter((r) => Number(dget(r, "plan_year")) === year);
  const done = plan.filter((r) => ["final_report", "closed"].includes(r.status)).length;
  const highFindings = of("finding").filter((r) => r.status !== "closed" && ["High", "Critical"].includes(String(dget(r, "rating")))).length;
  const pp = pct(done, plan.length);
  k.push({ label: `Audit plan ${year} complete`, module: "Internal audit", value: pp === null ? "No plan" : `${pp}%`, detail: `${done} of ${plan.length} engagements; ${highFindings} high or critical findings open`, threshold: "Red below 80% at Q3", status: pp === null ? "info" : pp < 80 ? "warn" : "good", href: "/r/engagement" });

  const svcs = of("business_service").filter((r) => r.status === "active");
  const outTol = svcs.filter((r) => dget(r, "tolerance_status") === "Outside tolerance").length;
  const untested = svcs.filter((r) => !dget(r, "tolerance_status") || dget(r, "tolerance_status") === "Not tested").length;
  k.push({ label: "Important services outside tolerance", module: "Continuity", value: String(outTol), detail: `${untested} of ${svcs.length} not yet tested`, threshold: "Red if any", status: outTol ? "bad" : untested ? "warn" : "good", href: "/r/business_service" });

  const sc = process.env.SECURECOMPLY_API_URL;
  k.push({ label: "Cyber and privacy posture", module: "SecureComply", value: sc ? "Connected" : "Not connected", detail: sc ? "Pulled from SecureComply" : "Set SECURECOMPLY_API_URL to pull ISO 27001, cyber risk and privacy status", threshold: "As set in SecureComply", status: "info", href: "/admin" });

  return k;
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function naira(n: number) {
  if (Math.abs(n) >= 1e6) return `₦${(n / 1e6).toFixed(1)}m`;
  return `₦${Math.round(n).toLocaleString("en-NG")}`;
}

export interface EntityRow {
  id: number;
  code: string;
  name: string;
  regulators: string[];
  walled: boolean;
  risks: number;
  outside: number;
  redKris: number;
  overdueFilings: number;
  casesPastClock: number;
  capital: string | null;
  capitalStatus: string | null;
}

/** Group roll-up: one row per entity the person can see. */
export async function entityRollup(user: PermUser, scope: Scope): Promise<EntityRow[]> {
  const db = await getDb();
  const all = (await db.select().from(schema.records)).filter((r) => inScope(r, { ...scope, selected: null, ids: null }, user));
  const t = today();
  const dget = (r: Row, k: string) => (r.data as Record<string, unknown>)[k];
  const ents = (await loadEntities()).filter((e) => scope.visible.some((v) => v.id === e.id));
  return ents.map((e) => {
    const mine = all.filter((r) => r.entityId === e.id);
    const of = (k: string) => mine.filter((r) => r.typeKey === k);
    const risks = of("risk").filter((r) => r.status === "active");
    const cap = of("kri").find((r) => r.status === "active" && dget(r, "kri_kind") === "Capital vs requirement");
    return {
      id: e.id,
      code: e.code,
      name: e.name,
      regulators: (e.regulators ?? []) as string[],
      walled: e.walled,
      risks: risks.length,
      outside: risks.filter((r) => dget(r, "appetite_status") === "Outside appetite").length,
      redKris: of("kri").filter((r) => r.status === "active" && dget(r, "kri_status") === "Red").length,
      overdueFilings: [...of("reg_return"), ...of("outsourcing_notice"), ...of("orsa"), ...of("rm_declaration")].filter((r) => r.status !== "submitted" && r.dueDate && r.dueDate < t).length,
      casesPastClock: of("case").filter((r) => r.status !== "closed" && r.dueDate && r.dueDate < t).length,
      capital: cap && dget(cap, "latest_ratio") !== null && dget(cap, "latest_ratio") !== undefined ? `${dget(cap, "latest_ratio")}%` : null,
      capitalStatus: cap ? String(dget(cap, "kri_status")) : null,
    };
  });
}
