// Boots the embedded Postgres, seeds the demo insurer and runs real workflows.
import { describe, it, expect, beforeAll } from "vitest";
process.env.VITE_CONFIG_NATIVE_IGNORE_WARNING = "true";
import { eq, sql } from "drizzle-orm";

process.env.VERCEL = "1"; // in-memory database
delete process.env.DATABASE_URL;

let db: Awaited<ReturnType<typeof import("../lib/db").getDb>>;
let schema: typeof import("../lib/db/schema");
let E: typeof import("../lib/engine/records");

/** A user as the app sees them: allow-list, group-wide flag, and the entities they may not see. */
async function sessionUser(prefix: string) {
  const [u] = await db.select().from(schema.users).where(sql`(${schema.users.email} like ${prefix + "@%"} or ${schema.users.name} ilike ${prefix + " %"})`);
  const { deniedEntities } = await import("../lib/engine/permissions");
  const ents = await db.select({ id: schema.entities.id, walled: schema.entities.walled }).from(schema.entities);
  const entityIds = ((u.entityIds ?? []) as number[]).map(Number);
  return { id: u.id, roles: u.roles as never[], entityIds, groupWide: entityIds.length === 0, deniedEntities: deniedEntities(ents, entityIds) };
}
/** Look up a demo user by email local part or first name. */
async function userByEmail(prefix: string) {
  return sessionUser(prefix);
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

  it("limits people to their own entities, on reads, lists and actions (UAT blockers 1 and 2)", async () => {
    const insurerRisk = await byTitle("Under-reserving on motor and liability claims");
    const amRisk = await byTitle("Dollar Fund liquidity squeeze on mass redemptions");
    const hauwa = await sessionUser("hauwa"); // Pensions only
    const tobi = await sessionUser("tobi"); // Microfinance bank only
    const zainab = await sessionUser("zainab"); // Insurer only
    const kemi = await sessionUser("kemi"); // Director, insurer only
    const adaeze = await sessionUser("adaeze"); // Group CRO
    expect(await E.getRecordForUser(hauwa, insurerRisk.id)).toBeNull();
    expect(await E.getRecordForUser(tobi, insurerRisk.id)).toBeNull();
    expect(await E.getRecordForUser(zainab, amRisk.id)).toBeNull();
    expect(await E.getRecordForUser(adaeze, insurerRisk.id)).not.toBeNull();
    await expect(E.transitionRecord(hauwa, insurerRisk.id, "close", "x")).rejects.toThrow(/not found/);
    await expect(E.transitionRecord(tobi, insurerRisk.id, "close", "x")).rejects.toThrow(/not found/);
    const insurer = insurerRisk.entityId;
    for (const u of [zainab, kemi]) {
      const rows = await E.listRecords(u, "risk");
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => r.entityId === insurer)).toBe(true);
    }
    expect((await E.listRecords(hauwa, "risk")).some((r) => r.entityId === insurer && r.ownerId !== hauwa.id && r.createdBy !== hauwa.id)).toBe(false);
  });

  it("lets a register record be withdrawn, with a reason, and keeps it (UAT blocker 4)", async () => {
    const tunde = await sessionUser("tunde");
    const r = await E.createRecord(tunde, "risk", { title: "Raised by mistake", ownerId: tunde.id, orgUnitId: null, entityId: (await byTitle("Under-reserving on motor and liability claims")).entityId, raw: { description: "x", category: "Operational risk" } });
    await expect(E.transitionRecord(tunde, r.id, "withdraw_draft")).rejects.toThrow(/comment|reason/i);
    await E.transitionRecord(tunde, r.id, "withdraw_draft", "Duplicate of RSK-0001");
    const [after] = await db.select().from(schema.records).where(eq(schema.records.id, r.id));
    expect(after.status).toBe("withdrawn");
  });

  it("refuses a loss event whose recoveries exceed the gross loss", async () => {
    const tunde = await sessionUser("tunde");
    const insurer = (await byTitle("Under-reserving on motor and liability claims")).entityId;
    await expect(E.createRecord(tunde, "loss_event", { title: "Bad loss", ownerId: tunde.id, orgUnitId: null, entityId: insurer, raw: { description: "x", event_date: "2026-10-01", gross_loss: "0", recoveries: "400", currency: "NGN" } })).rejects.toThrow(/Recoveries/);
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

  it("keeps readings, campaigns, tokens and four-eyes inside the entity wall", async () => {
    const { createHash } = await import("node:crypto");
    const { apiUser } = await import("../lib/apiauth");
    const { launchAttestationCampaign, launchDeclarationCampaign } = await import("../lib/engine/campaigns");
    const { isLocked, strike, clearLimit, rateLimited, LOCK_AFTER } = await import("../lib/auth/limits");
    const hauwa = await sessionUser("hauwa");
    const kunle = await sessionUser("kunle");
    const zainab = await sessionUser("zainab");
    const tunde = await sessionUser("tunde");
    const adaeze = await sessionUser("adaeze");
    const funmi = await sessionUser("funmi");
    const admin = await sessionUser("admin");
    const insurerRisk = await byTitle("Under-reserving on motor and liability claims");
    const amRisk = await byTitle("Dollar Fund liquidity squeeze on mass redemptions");
    const motor = await byTitle("Motor claims ratio");
    const pensionsKri = await byTitle("RSA reconciliation breaks open over 5 days");

    await expect(E.addReading(hauwa, motor.id, { date: "2026-10-12", value: 70 })).rejects.toThrow(/not found/);
    await expect(E.addReading(kunle, motor.id, { date: "2026-10-12", value: 70 })).rejects.toThrow(/not found/);
    await E.addReading(hauwa, pensionsKri.id, { date: "2026-10-12", value: 3 });
    expect((await byRef(pensionsKri.ref)).data.latest_value).toBe(3);

    const [owned] = await db.select().from(schema.records).where(eq(schema.records.id, amRisk.id));
    await db.update(schema.records).set({ ownerId: zainab.id, createdBy: zainab.id }).where(eq(schema.records.id, amRisk.id));
    expect(await E.getRecordForUser(zainab, amRisk.id)).toBeNull();
    expect((await E.listRecords(zainab, "risk")).some((r) => r.id === amRisk.id)).toBe(false);
    expect(await E.getRecordForUser(kunle, amRisk.id)).not.toBeNull();
    await db.update(schema.records).set({ ownerId: owned.ownerId, createdBy: owned.createdBy }).where(eq(schema.records.id, amRisk.id));

    expect(kunle.groupWide).toBe(false);
    expect((await E.listRecords(kunle, "risk")).every((r) => r.entityId === amRisk.entityId)).toBe(true);
    expect((await E.listRecords(kunle, "risk")).some((r) => r.id === insurerRisk.id)).toBe(false);

    const groupOnly = await E.createRecord(admin, "risk", { title: "Group-wide isolation check", ownerId: admin.id, orgUnitId: null, entityId: null, raw: { description: "x", category: "Operational risk" } });
    expect(groupOnly.entityId).toBeNull();
    expect(await E.getRecordForUser(zainab, groupOnly.id)).toBeNull();
    expect(await E.getRecordForUser(kunle, groupOnly.id)).toBeNull();
    expect(await E.getRecordForUser(admin, groupOnly.id)).not.toBeNull();
    await expect(E.createRecord(zainab, "risk", { title: "Should not file group-wide", ownerId: zainab.id, orgUnitId: null, entityId: null, raw: { description: "x", category: "Operational risk" } })).rejects.toThrow(/access to that entity/);

    const policy = await byTitle("Underwriting Policy");
    const groupPolicy = await byTitle("Group Enterprise Risk Management Policy and Appetite Framework");
    await expect(launchAttestationCampaign(hauwa, policy.id, "all")).rejects.toThrow(/not found/);
    await expect(launchAttestationCampaign(zainab, groupPolicy.id, "all")).rejects.toThrow(/not found/);
    const sent = await launchAttestationCampaign(zainab, policy.id, "all");
    expect(sent).toMatch(/Sent to/);
    const atts = await db.select().from(schema.records).where(eq(schema.records.title, `Attest: ${policy.title}`));
    expect(atts.length).toBeGreaterThan(0);
    expect(atts.every((a) => a.entityId === policy.entityId)).toBe(true);
    expect(atts.some((a) => a.ownerId === funmi.id)).toBe(true);
    expect(atts.some((a) => a.ownerId === hauwa.id)).toBe(false);

    await launchDeclarationCampaign(hauwa, "2099");
    const decls = await db.select().from(schema.records).where(eq(schema.records.title, "Annual declaration 2099"));
    expect(decls.length).toBeGreaterThan(0);
    expect(decls.every((d) => d.entityId === hauwa.entityIds[0])).toBe(true);
    expect(decls.some((d) => d.ownerId === funmi.id)).toBe(false);
    expect(decls.some((d) => d.ownerId === hauwa.id)).toBe(true);

    const token = `grc_${"ab".repeat(24)}`;
    await db.insert(schema.apiTokens).values({ name: "insurer-risk", tokenHash: createHash("sha256").update(token).digest("hex"), createdBy: admin.id, roles: ["risk"], entityIds: [insurerRisk.entityId!], groupWide: false });
    const api = await apiUser(new Request("http://localhost/api/v1/records", { headers: { authorization: `Bearer ${token}` } }));
    expect(api!.roles).toEqual(["risk"]);
    expect(await E.getRecordForUser(api!, insurerRisk.id)).not.toBeNull();
    expect(await E.getRecordForUser(api!, amRisk.id)).toBeNull();
    const pensionsRisk = await byTitle("RSA fund assets not segregated from company accounts");
    expect(await E.getRecordForUser(api!, pensionsRisk.id)).toBeNull();
    const bare = `grc_${"cd".repeat(24)}`;
    await db.insert(schema.apiTokens).values({ name: "unscoped", tokenHash: createHash("sha256").update(bare).digest("hex"), createdBy: admin.id, roles: ["admin"], entityIds: [], groupWide: false });
    const nobody = await apiUser(new Request("http://localhost/api/v1/records", { headers: { authorization: `Bearer ${bare}` } }));
    expect(await E.listRecords(nobody!, "risk")).toEqual([]);
    const wideTok = `grc_${"ef".repeat(24)}`;
    await db.insert(schema.apiTokens).values({ name: "group", tokenHash: createHash("sha256").update(wideTok).digest("hex"), createdBy: admin.id, roles: ["risk"], entityIds: [], groupWide: true });
    const wide = await apiUser(new Request("http://localhost/api/v1/records", { headers: { authorization: `Bearer ${wideTok}` } }));
    expect(await E.getRecordForUser(wide!, insurerRisk.id)).not.toBeNull();
    expect(await E.getRecordForUser(wide!, pensionsRisk.id)).toBeNull();
    expect(await E.getRecordForUser(wide!, groupOnly.id)).not.toBeNull();

    const loss = await E.createRecord(funmi, "loss_event", { title: "Four eyes loss", ownerId: funmi.id, orgUnitId: null, entityId: insurerRisk.entityId, raw: { event_date: "2026-10-01", description: "A payment went to the wrong account", currency: "NGN", gross_loss: "1000" } });
    await E.transitionRecord(tunde, loss.id, "validate");
    await expect(E.transitionRecord(tunde, loss.id, "close")).rejects.toThrow(/already took a four-eyes/);
    await E.transitionRecord(adaeze, loss.id, "close");
    expect((await byRef(loss.ref)).status).toBe("closed");

    const lockKey = "login:test:person@example.com";
    for (let i = 0; i < LOCK_AFTER; i++) await strike(db, lockKey, 1_700_000_000_000);
    expect(await isLocked(db, lockKey, 1_700_000_000_000 + 1000)).toBe(true);
    expect(await isLocked(db, lockKey, 1_700_000_000_000 + 16 * 60_000)).toBe(false);
    await clearLimit(db, lockKey);
    expect(await isLocked(db, lockKey, 1_700_000_000_000)).toBe(false);
    const rl = "portal:203.0.113.5";
    for (let i = 0; i < 3; i++) expect(await rateLimited(db, rl, 3, 60_000, 1_700_000_100_000)).toBe(false);
    expect(await rateLimited(db, rl, 3, 60_000, 1_700_000_100_000)).toBe(true);
    expect(await rateLimited(db, rl, 3, 60_000, 1_700_000_100_000 + 61_000)).toBe(false);
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

describe("demo accounts", () => {
  it("uses role-named emails", async () => {
    const emails = (await db.select().from(schema.users)).map((u) => u.email);
    expect(emails).toContain("group.cro@demofinancial.example");
    expect(emails).toContain("investigator@demofinancial.example");
    expect(emails).not.toContain("adaeze.okafor@demofinancial.example");
  });
  it("renames an older first.last account in place, keeping its id", async () => {
    const S = await import("../lib/db/seed");
    const [u] = await db.select().from(schema.users).where(eq(schema.users.email, "hse.esg@demofinancial.example"));
    await db.update(schema.users).set({ email: "halima.bello@demofinancial.example" }).where(eq(schema.users.id, u.id));
    await S.renameDemoAccounts(db);
    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, u.id));
    expect(after.email).toBe("hse.esg@demofinancial.example");
  });
});
