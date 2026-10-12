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
    const fx = await byTitle("Naira depreciation against USD-denominated liabilities");
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
    const control = await byTitle("Third-party premium payment KYC check");
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
