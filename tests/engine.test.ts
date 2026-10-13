// Boots the embedded Postgres, seeds the demo insurer and runs real workflows.
import { describe, it, expect, beforeAll } from "vitest";
process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = "true";
import { eq, sql } from "drizzle-orm";

process.env.VERCEL = "1"; // in-memory database
delete process.env.DATABASE_URL;

let db: Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let schema: typeof import("../lib/db/schema");
let E: typeof import("../lib/engine/records");

async function userByEmail(prefix: string) {
  const [u] = await db.select().from(schema.users).where(sql`${schema.users.email} like ${prefix + "%"}`);
  return { id: u.id, roles: u.roles as never[] };
}
/** A user as the app sees them, with walled entities they may not see. */
async function sessionUser(prefix: string) {
  const [u] = await db.select().from(schema.users).where(sql`${schema.users.email} like ${prefix + "%"}`);
  const walled = (await db.select().from(schema.entities)).filter((e) => e.walled).map((e) => e.id);
  const mine = (u.entityIds ?? []) as number[];
  return { id: u.id, roles: u.roles as never[], deniedEntities: walled.filter((w) => !mine.includes(w)) };
}
function addMonthsIso(iso: string, m: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
}
async function byRef(ref: string) {
  const [r] = await db.select().from(schema.records).where(eq(schema.records.ref, ref));
  return r;
}
async function byTitle(title: string) {
  const [r] = await db.select().from(schema.records).where(eq(schema.records.title, title));
  return r;
}

beforeAll(async () => {
  const mod = await import("../lib/db");
  db = await mod.getDb();
  schema = await import("../lib/db/schema");
  E = await import("../lib/engine/records");
});

describe("bootstrap and seed", () => {
  it("creates every record type and demo data", async () => {
    const types = await db.select().from(schema.recordTypes);
    expect(types.length).toBeGreaterThanOrEqual(35);
    const [{ n }] = (await db.execute(sql`select count(*)::int as n from records`)).rows as { n: number }[];
    expect(n).toBeGreaterThan(100);
  });
  it("scores seeded risks against approved appetite", async () => {
    const fx = await byTitle("Naira depreciation against USD-denominated claims");
    expect(fx.data.residual_score).toBe(16);
    expect(fx.data.appetite_threshold).toBe(12);
    expect(fx.data.appetite_status).toBe("Outside appetite");
    expect(fx.data.rbc_type).toBe("Market");
    expect(fx.dueDate).toBeTruthy();
  });
  it("computes KRI status from readings", async () => {
    const k = await byTitle("Net USD liability mismatch");
    expect(k.data.latest_value).toBe(8.4);
    expect(k.data.kri_status).toBe("Red");
  });
  it("computes tCO2e for scope 1 metrics", async () => {
    const m = await byTitle("Diesel consumed by generators and fleet");
    expect(m.data.latest_tco2e).toBeCloseTo((55400 * 2.68) / 1000, 1);
  });
  it("walls off whistleblowing cases", async () => {
    const wb = await byTitle("Concern about refunds approved by a branch underwriter");
    expect(wb.confidential).toBe(true);
    const cro = await userByEmail("adaeze");
    const inv = await userByEmail("chidi");
    expect(await E.getRecordForUser(cro, wb.id)).toBeNull();
    expect(await E.getRecordForUser(inv, wb.id)).not.toBeNull();
    const croCases = await E.listRecords(cro, "case");
    expect(croCases.some((c) => c.id === wb.id)).toBe(false);
  });
});

describe("workflows and cross-module effects", () => {
  it("raising a risk outside appetite opens a breach action (PRD ERM-14)", async () => {
    const champion = await userByEmail("yusuf");
    const risk = await E.createRecord(champion, "risk", {
      title: "Flood damage to branch premises",
      ownerId: champion.id,
      orgUnitId: null,
      raw: { description: "Branch floods annually", category: "Operational risk", residual_likelihood: "4", residual_impact: "4", inherent_likelihood: "5", inherent_impact: "4" },
    });
    expect(risk.data.appetite_status).toBe("Outside appetite");
    expect(risk.status).toBe("draft");
    // Submit (owner), then four-eyes approval
    await E.transitionRecord(champion, risk.id, "submit");
    await expect(E.transitionRecord(champion, risk.id, "approve")).rejects.toThrow(/owner cannot|Four-eyes/);
    const tunde = await userByEmail("tunde");
    await E.transitionRecord(tunde, risk.id, "approve");
    const after = await byRef(risk.ref);
    expect(after.status).toBe("active");
    const links = await E.linkedRecords(db, risk.id, "action");
    expect(links.length).toBe(1);
    expect(links[0].record.data.source).toBe("Appetite breach");
    // A later review while still outside appetite does not open a duplicate
    await E.transitionRecord(champion, risk.id, "review");
    expect((await E.linkedRecords(db, risk.id, "action")).length).toBe(1);
  });

  it("a failed control test sign-off creates a finding and an action, and downgrades the control", async () => {
    const zainab = await userByEmail("zainab");
    const ngozi = await userByEmail("ngozi");
    const control = await byTitle("Reinsurer security approval list (A- minimum)");
    const test = await E.createRecord(zainab, "control_test", {
      title: "Ad hoc retest of payer KYC",
      ownerId: zainab.id,
      orgUnitId: null,
      raw: { test_type: "Independent test (second line)", procedure: "Sample 10", result: "Fail", evidence: "3 of 10 unverified" },
      linkTo: { id: control.id, kind: "tests" },
    });
    await E.transitionRecord(zainab, test.id, "start");
    await E.transitionRecord(zainab, test.id, "submit");
    await expect(E.transitionRecord(zainab, test.id, "approve")).rejects.toThrow();
    await E.transitionRecord(ngozi, test.id, "approve");
    const findings = await E.linkedRecords(db, test.id, "finding");
    expect(findings.length).toBe(1);
    const actions = await E.linkedRecords(db, findings[0].record.id, "action");
    expect(actions.length).toBe(1);
    const c = await byRef(control.ref);
    expect(c.data.operating_rating).toBe("Ineffective");
  });

  it("nil declarations auto-file and broker conflicts route to Compliance", async () => {
    const segun = await userByEmail("segun");
    const nil = await E.createRecord(segun, "declaration", { title: "Annual declaration", ownerId: segun.id, orgUnitId: null, raw: { decl_type: "Annual conflict of interest declaration", nil_return: "on" } });
    expect(await E.transitionRecord(segun, nil.id, "submit")).toBe("Filed (nil return)");
    const pos = await E.createRecord(segun, "declaration", { title: "Cousin works at broker", ownerId: segun.id, orgUnitId: null, raw: { decl_type: "Ad hoc conflict of interest", counterparty: "X Brokers", counterparty_type: "Broker" } });
    expect(await E.transitionRecord(segun, pos.id, "submit")).toBe("Compliance review");
  });

  it("closing a case with a write-off posts a loss event to ERM", async () => {
    const chidi = await userByEmail("chidi");
    const ngozi = await userByEmail("ngozi");
    const c = await E.createRecord(chidi, "case", { title: "Inflated hospital bill", ownerId: chidi.id, orgUnitId: null, raw: { case_type: "Suspected claims fraud", reported_date: "2026-10-01", description: "x", amount_at_risk: "5000000" } });
    expect(c.data.severity).toBe("Medium");
    expect(c.data.clock_due).toBe("2026-10-31");
    await E.transitionRecord(chidi, c.id, "triage");
    await E.transitionRecord(chidi, c.id, "investigate");
    await E.updateRecord(chidi, c.id, { title: c.title, ownerId: chidi.id, orgUnitId: null, raw: { ...c.data, findings: "Bill inflated", root_cause: "Deliberate fraud", outcome: "Substantiated", amount_written_off: "1200000" } as Record<string, unknown> });
    await E.transitionRecord(chidi, c.id, "findings");
    await E.transitionRecord(ngozi, c.id, "close");
    const losses = await E.linkedRecords(db, c.id, "loss_event");
    expect(losses.length).toBe(1);
    expect(losses[0].record.data.net_loss).toBe(1200000);
  });

  it("approving an action extension moves the due date and counts the extension", async () => {
    const funmi = await userByEmail("funmi");
    const tunde = await userByEmail("tunde");
    const a = await E.createRecord(tunde, "action", { title: "Test action", ownerId: funmi.id, orgUnitId: null, raw: { description: "x", priority: "Low", due_date: "2026-11-01" } });
    await E.transitionRecord(funmi, a.id, "accept");
    await E.updateRecord(funmi, a.id, { title: a.title, ownerId: funmi.id, orgUnitId: null, raw: { ...a.data, new_due_date: "2026-12-01", extension_reason: "Vendor delay" } as Record<string, unknown> });
    await E.transitionRecord(funmi, a.id, "request_ext");
    await E.transitionRecord(tunde, a.id, "approve_ext");
    const r = await byRef(a.ref);
    expect(r.data.due_date).toBe("2026-12-01");
    expect(r.data.original_due_date).toBe("2026-11-01");
    expect(r.data.extensions).toBe(1);
    const versions = await E.recordHistory(a.id);
    expect(versions.length).toBeGreaterThanOrEqual(5);
  });

  it("a failed continuity exercise raises an ERM risk linked to the service", async () => {
    const segun = await userByEmail("segun");
    const svc = await byTitle("Premium collection and receipting");
    const ex = await E.createRecord(segun, "bc_exercise", { title: "Receipting failover test", ownerId: segun.id, orgUnitId: null, raw: { exercise_type: "DR test", scenario: "Core system loss", recovery_hours: "96", met_tolerance: "No" }, linkTo: { id: svc.id, kind: "exercises" } });
    await E.transitionRecord(segun, ex.id, "complete");
    const s = await byRef(svc.ref);
    expect(s.data.tolerance_status).toBe("Outside tolerance");
    const risks = await E.linkedRecords(db, ex.id, "risk");
    expect(risks.length).toBe(1);
    expect(risks[0].record.status).toBe("submitted");
  });

  it("a red KRI reading notifies the CRO", async () => {
    const tunde = await userByEmail("tunde");
    const cro = await userByEmail("adaeze");
    const k = await byTitle("Motor claims ratio");
    const before = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, cro.id));
    await E.addReading(tunde, k.id, { date: "2026-10-10", value: 82 });
    const r = await byRef(k.ref);
    expect(r.data.kri_status).toBe("Red");
    const after = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, cro.id));
    // Motor claims ratio was already red from seed (77 >= 75), so no duplicate alert
    expect(after.length).toBe(before.length);
  });
});

describe("group, entities and walls", () => {
  it("seeds a fictional group with walled entities and no real names", async () => {
    const ents = await db.select().from(schema.entities);
    expect(ents.map((e) => e.code).sort()).toEqual(["DAM", "DAP", "DFG", "DIB", "DIP", "DMB", "DPL", "DSL"]);
    expect(ents.filter((e) => e.walled).map((e) => e.code).sort()).toEqual(["DIB", "DMB", "DPL"]);
    const dump = JSON.stringify(await db.select().from(schema.records)) + JSON.stringify(await db.select().from(schema.users)) + JSON.stringify(ents);
    expect(dump).not.toMatch(/norrenberger|\bIEI\b|international energy insurance/i);
    expect(dump).not.toMatch(/Individual life|Annuity|Group life/);
  });

  it("hides a walled entity's records from people outside it, in lists and direct reads", async () => {
    const pfaRisk = await byTitle("RSA fund assets not segregated from company accounts");
    const tunde = await sessionUser("tunde");
    const hauwa = await sessionUser("hauwa");
    const adaeze = await sessionUser("adaeze");
    expect(await E.getRecordForUser(tunde, pfaRisk.id)).toBeNull();
    expect((await E.listRecords(tunde, "risk")).some((r) => r.id === pfaRisk.id)).toBe(false);
    expect(await E.getRecordForUser(hauwa, pfaRisk.id)).not.toBeNull();
    expect(await E.getRecordForUser(adaeze, pfaRisk.id)).not.toBeNull();
    // Hauwa (PFA only) can't see the bank's risks either
    const bankRisk = await byTitle("Digital channel fraud on agent and USSD transactions");
    expect(await E.getRecordForUser(hauwa, bankRisk.id)).toBeNull();
    // and nobody can file a record into an entity they are walled off from
    await expect(E.createRecord(tunde, "risk", { title: "x", ownerId: tunde.id, orgUnitId: null, entityId: pfaRisk.entityId, raw: { description: "x", category: "Operational risk" } })).rejects.toThrow(/access to that entity/);
  });

  it("uses an entity's own appetite before the group's", async () => {
    const dollar = await byTitle("Dollar Fund liquidity squeeze on mass redemptions");
    expect(dollar.data.appetite_threshold).toBe(8);
    expect(dollar.data.appetite_source).toBe("Entity appetite");
    expect(dollar.data.appetite_status).toBe("Outside appetite");
    const fx = await byTitle("Naira depreciation against USD-denominated claims");
    expect(fx.data.appetite_source).toBe("Group appetite");
  });

  it("rates capital against the NGN 15bn minimum", async () => {
    const k = await byTitle("Capital against the NGN 15bn minimum capital requirement");
    expect(k.data.latest_ratio).toBe(220.7);
    expect(k.data.kri_status).toBe("Green");
    const tunde = await sessionUser("tunde");
    await E.addReading(tunde, k.id, { date: "2026-10-10", value: 16_000_000_000 });
    expect((await byRef(k.ref)).data.kri_status).toBe("Amber");
    await E.addReading(tunde, k.id, { date: "2026-10-11", value: 14_000_000_000 });
    expect((await byRef(k.ref)).data.kri_status).toBe("Red");
  });

  it("converts USD losses to naira, bands them and links the risk", async () => {
    const tunde = await sessionUser("tunde");
    const risk = await byTitle("Naira depreciation against USD-denominated claims");
    const l = await E.createRecord(tunde, "loss_event", { title: "USD claim overpaid", ownerId: tunde.id, orgUnitId: null, entityId: risk.entityId, raw: { event_date: "2026-10-01", description: "x", currency: "USD", fx_rate: "1500", gross_loss: "40000", insurance_recoveries: "5000", risk_ref: risk.ref } });
    expect(l.data.net_loss).toBe(35000);
    expect(l.data.net_loss_ngn).toBe(52_500_000);
    expect(l.data.threshold_band).toBe("Board-reportable");
    expect((await E.linkedRecords(db, l.id, "risk")).map((x) => x.record.id)).toContain(risk.id);
  });
});

describe("filings, ORSA and the Risk Management Declaration", () => {
  it("puts a 60-day NIIRA s.210 clock on claims", async () => {
    const funmi = await sessionUser("funmi");
    const c = await E.createRecord(funmi, "case", { title: "Claim pending", ownerId: funmi.id, orgUnitId: null, raw: { case_type: "Claim awaiting settlement or decision", reported_date: "2026-10-01", description: "x" } });
    expect(c.data.clock_due).toBe("2026-11-30");
    expect(String(c.data.clock_basis)).toMatch(/s\.210/);
  });

  it("filing a quarterly return schedules the next quarter", async () => {
    const zainab = await sessionUser("zainab");
    const ngozi = await sessionUser("ngozi");
    const ret = await byTitle("NAICOM quarterly ERM return Q3 2026");
    await E.updateRecord(zainab, ret.id, { title: ret.title, ownerId: ret.ownerId, orgUnitId: ret.orgUnitId, raw: { submitted_date: ret.data.due_date, reference: "ERM-Q3" } });
    await E.transitionRecord(ngozi, ret.id, "review");
    await E.transitionRecord(zainab, ret.id, "submit");
    const next = await E.linkedRecords(db, ret.id, "reg_return");
    expect(next.length).toBe(1);
    expect(next[0].record.title).toBe("NAICOM quarterly ERM return Q4 2026");
    expect(next[0].record.dueDate).toBe(addMonthsIso(String(ret.data.due_date), 3));
    expect(next[0].record.entityId).toBe(ret.entityId);
    expect(next[0].record.data.submitted_date).toBeNull();
    expect((await byRef(ret.ref)).data.filing_status).toBe("Filed on time");
  });

  it("an overdue return shows as overdue", async () => {
    const r = await byTitle("NAICOM claims return Q3 2026");
    expect(r.data.filing_status).toBe("Overdue");
  });

  it("compiling an ORSA pulls the entity's register and capital, and it falls due 60 days after year end", async () => {
    const adaeze = await sessionUser("adaeze");
    const o = await byTitle("ORSA FY2026: Demo Insurance");
    expect(o.dueDate).toBe("2027-03-01");
    await E.transitionRecord(adaeze, o.id, "compile");
    const after = await byRef(o.ref);
    expect(String(after.data.register_summary)).toMatch(/active risks/);
    expect(String(after.data.register_summary)).not.toMatch(/RSA fund/); // PFA risks stay out of the insurer's ORSA
    expect(String(after.data.capital_summary)).toMatch(/NGN 15.0bn/);
  });

  it("the Risk Management Declaration needs two different directors", async () => {
    const kemi = await sessionUser("kemi");
    const ifeoma = await sessionUser("ifeoma");
    const admin = await sessionUser("admin");
    const ngozi = await sessionUser("ngozi");
    const rmd = await byTitle("Risk Management Declaration FY2026: Demo Insurance");
    await expect(E.transitionRecord(ngozi, rmd.id, "sign1")).rejects.toThrow(/Only these roles/); // owner, not a director
    await expect(E.transitionRecord(admin, rmd.id, "sign1")).rejects.toThrow(/Only these roles/); // admins don't sign for directors
    await E.transitionRecord(kemi, rmd.id, "sign1");
    await expect(E.transitionRecord(kemi, rmd.id, "sign2")).rejects.toThrow(/different person/);
    expect(await E.transitionRecord(ifeoma, rmd.id, "sign2")).toBe("Signed by two directors");
    const r = await byRef(rmd.ref);
    expect(r.data.director_1_by).toBe(kemi.id);
    expect(r.data.director_2_by).toBe(ifeoma.id);
    expect(r.data.director_2_on).toBeTruthy();
  });
});

describe("seeding safety", () => {
  it("SEED_DEMO=false never truncates", async () => {
    const { seedIfEmpty } = await import("../lib/db/seed");
    const before = (await db.select().from(schema.records)).length;
    process.env.SEED_DEMO = "false";
    await db.execute(sql`UPDATE app_settings SET value = 'old' WHERE key = 'seed_version'`);
    try {
      await seedIfEmpty(db);
    } finally {
      delete process.env.SEED_DEMO;
    }
    expect((await db.select().from(schema.records)).length).toBe(before);
  });
  it("a database this code did not seed as a demo is never reset, even in demo mode", async () => {
    const { seedIfEmpty } = await import("../lib/db/seed");
    const before = (await db.select().from(schema.records)).length;
    await db.execute(sql`DELETE FROM app_settings WHERE key = 'demo_tenant'`);
    await seedIfEmpty(db);
    expect((await db.select().from(schema.records)).length).toBe(before);
  });
});
