// Record-type sync and demo data for a fictional Nigerian multi-entity financial group
// ("Demo Financial Group") with a non-life insurer at its core.
// Every person, organisation and figure below is invented. FICTIONAL DEMO DATA.
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { DB } from "./index";
import * as schema from "./schema";
import { DEFAULT_TYPES } from "../defs/modules";
import type { TypeDef } from "../defs/types";
import { hashPassword, verifyPassword } from "../auth/password";
import { seedInsert, seedLink, seedReading } from "../engine/records";
import { addDays, today, NON_LIFE_MCR_NGN } from "../engine/pure";

/** Insert new record types and refresh any the administrator has not customised. */
export async function syncRecordTypes(db: DB) {
  const rows = await db.select().from(schema.recordTypes);
  for (const [i, def] of DEFAULT_TYPES.entries()) {
    const row = rows.find((r) => r.key === def.key);
    if (!row) {
      await db.insert(schema.recordTypes).values({ key: def.key, module: def.module, def, sort: i });
    } else if (!(row.def as TypeDef & { customised?: boolean }).customised) {
      await db.update(schema.recordTypes).set({ def, module: def.module, sort: i, updatedAt: new Date() }).where(eq(schema.recordTypes.key, def.key));
    }
  }
}

/** Bump to reseed demo tenants once on the next boot (never applies when SEED_DEMO=false). */
export const SEED_VERSION = "2026-10-13-group-v1";
export const DEMO_DOMAIN = "demofinancial.example";
export const DEMO_EMAIL_RENAMES: Record<string, string> = {"kemi.adebayo": "erm.committee.chair", "ifeoma.nnaji": "independent.director", "adaeze.okafor": "group.cro", "tunde.bakare": "head.erm", "ngozi.eze": "group.cco", "zainab.lawal": "compliance.officer", "hauwa.sani": "pensions.risk", "kunle.ajayi": "asset.mgmt.risk", "tobi.fashola": "mfb.compliance", "musa.garba": "infra.bank.cco", "ibrahim.musa": "chief.auditor", "chidi.okonkwo": "investigator", "halima.bello": "hse.esg", "funmi.adeyemi": "head.claims", "emeka.nwosu": "head.underwriting", "bola.ogunleye": "group.cfo", "segun.alabi": "group.cio", "amaka.obi": "head.actuarial", "yusuf.danjuma": "risk.champion"};

const LEGACY_DEMO_ADMIN = "admin@demo-insurance.ng";
/** Local development only. Deployed demos use DEMO_PASSWORD or, without it, a random unknown password. */
const LOCAL_DEFAULT_PASSWORD = "Demo!2026grc";

function demoPassword(): { value: string; source: "env" | "random" | "local" } {
  if (process.env.DEMO_PASSWORD) return { value: process.env.DEMO_PASSWORD, source: "env" };
  if (process.env.VERCEL_ENV) return { value: randomBytes(24).toString("base64url"), source: "random" };
  return { value: LOCAL_DEFAULT_PASSWORD, source: "local" };
}

const DATA_TABLES = ["records", "record_links", "record_versions", "comments", "audit_log", "notifications", "snapshots", "counters", "users", "org_units", "api_tokens", "entities"];

async function setting(db: DB, key: string): Promise<string | null> {
  const rows = (await db.execute(sql`SELECT value FROM app_settings WHERE key = ${key}`)).rows as { value: string }[];
  return rows[0]?.value ?? null;
}
async function put(db: DB, key: string, value: string) {
  await db.execute(sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`);
}

/** Is the demo dataset active? Used for the "FICTIONAL DEMO DATA" marker. */
export async function isDemoTenant(db: DB): Promise<boolean> {
  return (await setting(db, "demo_tenant")) !== null;
}

export async function seedIfEmpty(db: DB) {
  const [{ n }] = (await db.execute(sql`SELECT count(*)::int AS n FROM users`)).rows as { n: number }[];
  const users = Number(n);

  // A real tenant: never truncate anything. Create the first administrator on an empty database.
  if (process.env.SEED_DEMO === "false") {
    if (users === 0) {
      const pw = process.env.ADMIN_PASSWORD;
      await db.insert(schema.users).values({
        email: (process.env.ADMIN_EMAIL ?? "admin@example.com").toLowerCase(),
        name: "Platform administrator",
        // Without ADMIN_PASSWORD nobody can sign in until it is set, rather than falling back to a known password.
        passwordHash: hashPassword(pw && pw.length >= 12 ? pw : randomBytes(24).toString("hex")),
        roles: ["admin"],
      });
    }
    await db.execute(sql`DELETE FROM app_settings WHERE key = 'demo_tenant'`);
    await put(db, "seed_complete", new Date().toISOString());
    return;
  }

  // Demo mode. Only a database that this code seeded as a demo is ever reset.
  const legacyDemo = users > 0 && (await db.execute(sql`SELECT 1 FROM users WHERE email = ${LEGACY_DEMO_ADMIN}`)).rows.length > 0;
  const demo = users === 0 || (await isDemoTenant(db)) || legacyDemo;
  if (!demo) {
    await put(db, "seed_complete", new Date().toISOString());
    return;
  }
  const [{ r }] = (await db.execute(sql`SELECT count(*)::int AS r FROM records`)).rows as { r: number }[];
  const current = (await setting(db, "seed_version")) === SEED_VERSION && (await setting(db, "seed_complete")) !== null && Number(r) >= 100;
  if (current) {
    await renameDemoAccounts(db);
    await syncDemoPassword(db);
    return;
  }
  if (users > 0) {
    await db.execute(sql.raw(`TRUNCATE ${DATA_TABLES.join(", ")} RESTART IDENTITY`));
    // New user ids: invalidate every session signed before the reseed.
    await db.execute(sql`UPDATE app_settings SET value = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '') WHERE key = 'session_secret'`);
    const { resetSessionKeyCache } = await import("../auth/session");
    resetSessionKeyCache();
  }
  const pw = demoPassword();
  await seedDemo(db, pw.value);
  await put(db, "demo_pw", pw.source === "env" ? hashPassword(pw.value) : pw.source);
  await put(db, "demo_tenant", "Demo Financial Group (fictional)");
  await put(db, "seed_version", SEED_VERSION);
  await put(db, "seed_complete", new Date().toISOString());
}

/** One-off: move demo accounts from first.last to role-named emails in place, keeping MFA enrolment and history. */
export async function renameDemoAccounts(db: DB) {
  for (const [from, to] of Object.entries(DEMO_EMAIL_RENAMES)) {
    await db.execute(sql`UPDATE users SET email = ${to + "@" + DEMO_DOMAIN} WHERE email = ${from + "@" + DEMO_DOMAIN} AND NOT EXISTS (SELECT 1 FROM users WHERE email = ${to + "@" + DEMO_DOMAIN})`);
  }
  await db.execute(sql`UPDATE users SET name = 'Olumide Bankole' WHERE email = ${"admin@" + DEMO_DOMAIN} AND name = 'Platform Admin'`);
}

/** Apply a changed DEMO_PASSWORD to the demo accounts on boot, so it can be rotated from the host's settings. */
async function syncDemoPassword(db: DB) {
  const env = process.env.DEMO_PASSWORD;
  const stored = await setting(db, "demo_pw");
  let value: string | null = null;
  if (env) {
    if (stored && stored.startsWith("scrypt$") && verifyPassword(env, stored)) return;
    value = env;
  } else if (process.env.VERCEL_ENV && stored === "local") {
    value = randomBytes(24).toString("base64url"); // a deployed demo must never keep the published local default
  }
  if (!value) return;
  await db.execute(sql`UPDATE users SET password_hash = ${hashPassword(value)}, session_gen = session_gen + 1 WHERE email LIKE ${"%@" + DEMO_DOMAIN}`);
  await put(db, "demo_pw", env ? hashPassword(env) : "random");
}

const d = (days: number) => addDays(today(), days);

async function seedDemo(db: DB, password: string) {
  // Entities -------------------------------------------------------------------
  const ent = async (code: string, name: string, kind: string, business: string, licence: string, regulators: string[], frameworks: string[], opts: { walled?: boolean; insurer?: boolean; parent?: number | null; sort: number }) =>
    (await db.insert(schema.entities).values({ code, name, kind, business, licence, regulators, frameworks, walled: !!opts.walled, insurer: !!opts.insurer, parentId: opts.parent ?? null, sort: opts.sort }).returning())[0].id;
  const DFG = await ent("DFG", "Demo Financial Group Plc", "group", "Holding company", "Holding company (fictional)", ["SEC", "FRC"], ["Nigerian Code of Corporate Governance 2018", "NDPA 2023 and GAID 2025"], { sort: 0 });
  const DAP = await ent("DAP", "Demo Advisory Partners Ltd", "subsidiary", "Issuing house and financial advisory; majority shareholder of Demo Insurance", "SEC issuing house (fictional)", ["SEC", "NFIU", "FRC"], ["SEC rules (pack to source)"], { parent: DFG, sort: 1 });
  const DIP = await ent("DIP", "Demo Insurance Plc", "subsidiary", "General (non-life) insurance; listed", "NAICOM general business licence (fictional)", ["NAICOM", "SEC", "NGX", "FRC", "NFIU", "NDPC"], ["NIIRA 2025", "NAICOM Prudential Guidelines 2022", "NAICOM Corporate Governance Guidelines 2021", "NAICOM AML/CFT/CPF Regulations", "Nigerian Code of Corporate Governance 2018", "NDPA 2023 and GAID 2025"], { insurer: true, parent: DAP, sort: 2 });
  const DPL = await ent("DPL", "Demo Pensions Ltd", "subsidiary", "Pension fund administrator", "PenCom PFA licence (fictional)", ["PenCom", "FRC", "NFIU", "NDPC"], ["Pension Reform Act 2014 and PenCom regulations (pack to source)", "NDPA 2023 and GAID 2025"], { walled: true, parent: DFG, sort: 3 });
  const DAM = await ent("DAM", "Demo Asset Management Ltd", "subsidiary", "Fund manager: money market, Islamic and dollar funds", "SEC fund manager (fictional)", ["SEC", "NGX", "NFIU", "NDPC"], ["ISA 2007 and SEC rules (pack to source)", "Shariah governance (pack to source)"], { parent: DFG, sort: 4 });
  const DSL = await ent("DSL", "Demo Securities Ltd", "subsidiary", "Stockbroking", "SEC broker-dealer (fictional)", ["SEC", "NGX", "NFIU"], ["ISA 2007 and SEC rules (pack to source)"], { parent: DFG, sort: 5 });
  const DMB = await ent("DMB", "Demo Microfinance Bank Ltd", "subsidiary", "Microfinance and digital banking", "CBN microfinance bank licence (fictional)", ["CBN", "NFIU", "NDPC"], ["CBN MFB prudential and AML/CFT frameworks (pack to source)"], { walled: true, parent: DFG, sort: 6 });
  const DIB = await ent("DIB", "Demo Infrastructure Bank Plc", "subsidiary", "Development finance institution", "CBN DFI licence (fictional)", ["CBN", "SEC"], ["CBN DFI prudential framework (pack to source)"], { walled: true, parent: DFG, sort: 7 });
  const ALL = [DFG, DAP, DIP, DPL, DAM, DSL, DMB, DIB];

  // Org structure ------------------------------------------------------------
  const ou = async (name: string, kind: string, parentId: number | null = null) =>
    (await db.insert(schema.orgUnits).values({ name, kind, parentId }).returning())[0].id;
  const group = await ou("Group", "group");
  const nonLife = await ou("Underwriting (Demo Insurance)", "division", group);
  const claims = await ou("Claims (Demo Insurance)", "function", group);
  const finance = await ou("Group finance and investments", "function", group);
  const riskFn = await ou("Group risk management", "function", group);
  const compFn = await ou("Enterprise Assurance (group compliance)", "function", group);
  const auditFn = await ou("Group internal audit", "function", group);
  const it = await ou("Group IT and operations", "function", group);
  const hr = await ou("Group HR and administration", "function", group);
  const ph = await ou("Port Harcourt branch", "branch", nonLife);
  await ou("Abuja branch", "branch", nonLife);

  // People (invented) -------------------------------------------------------------
  const pw = hashPassword(password);
  const user = async (local: string, name: string, title: string, roles: string[], orgUnitId: number, entityIds: number[], lineOfDefence: string | null, managerId: number | null = null) =>
    (await db.insert(schema.users).values({ email: `${local}@${DEMO_DOMAIN}`, name, title, roles, orgUnitId, managerId, passwordHash: pw, entityIds, lineOfDefence }).returning())[0].id;
  await user("admin", "Olumide Bankole", "GRC platform administrator", ["admin"], it, [], null);
  const kemi = await user("erm.committee.chair", "Kemi Adebayo", "Chair, ERM Committee, Demo Insurance", ["board"], group, [DIP], "Board and oversight");
  const ifeoma = await user("independent.director", "Ifeoma Nnaji", "Independent Non-Executive Director, Demo Insurance", ["board"], group, [DIP], "Board and oversight");
  const adaeze = await user("group.cro", "Adaeze Okafor", "Group Chief Risk Officer", ["cro", "risk"], riskFn, ALL, "Second line");
  const tunde = await user("head.erm", "Tunde Bakare", "Head of Enterprise Risk, Demo Insurance", ["risk"], riskFn, [DIP, DFG, DAP, DAM, DSL], "Second line", adaeze);
  const ngozi = await user("group.cco", "Ngozi Eze", "Group Chief Compliance Officer and Head of Enterprise Assurance", ["compliance", "mlro"], compFn, ALL, "Second line");
  const zainab = await user("compliance.officer", "Zainab Lawal", "Compliance Officer, Demo Insurance", ["compliance"], compFn, [DIP], "Second line", ngozi);
  const hauwa = await user("pensions.risk", "Hauwa Sani", "Head of Risk and Compliance, Demo Pensions", ["risk", "compliance"], riskFn, [DPL], "Second line", ngozi);
  const kunle = await user("asset.mgmt.risk", "Kunle Ajayi", "Head of Risk, Demo Asset Management", ["risk"], riskFn, [DAM], "Second line", adaeze);
  const tobi = await user("mfb.compliance", "Tobi Fashola", "Head of Risk and Compliance, Demo Microfinance Bank", ["risk", "compliance"], riskFn, [DMB], "Second line", ngozi);
  const musa = await user("infra.bank.cco", "Musa Garba", "Chief Compliance Officer, Demo Infrastructure Bank", ["risk", "compliance"], compFn, [DIB], "Second line", ngozi);
  const ibrahim = await user("chief.auditor", "Ibrahim Musa", "Group Chief Internal Auditor", ["auditor"], auditFn, ALL, "Third line");
  const chidi = await user("investigator", "Chidi Okonkwo", "Head of Investigations (SIU)", ["investigator"], compFn, ALL, "Second line", ngozi);
  const halima = await user("hse.esg", "Halima Bello", "Group HSE and Sustainability Lead", ["hse", "esg"], hr, [], "First line");
  const funmi = await user("head.claims", "Funmi Adeyemi", "Head of Claims, Demo Insurance", ["staff"], claims, [DIP], "First line");
  const emeka = await user("head.underwriting", "Emeka Nwosu", "Head of Underwriting, Demo Insurance", ["staff"], nonLife, [DIP], "First line");
  const bola = await user("group.cfo", "Bola Ogunleye", "Group Chief Financial Officer", ["staff"], finance, ALL, "First line");
  const segun = await user("group.cio", "Segun Alabi", "Group Chief Information Officer", ["staff"], it, [], "First line");
  const amaka = await user("head.actuarial", "Amaka Obi", "Head of Actuarial, Demo Insurance", ["staff"], finance, [DIP], "First line");
  const yusuf = await user("risk.champion", "Yusuf Danjuma", "Branch manager and risk champion, Port Harcourt", ["staff"], ph, [DIP], "First line", emeka);

  type Opt = { e?: number | null; ou?: number | null; by?: number };
  const R = (type: string, title: string, ownerId: number | null, data: Record<string, unknown>, status?: string, o: Opt = {}) =>
    seedInsert(db, type, { title, ownerId, orgUnitId: o.ou ?? null, entityId: o.e === undefined ? DIP : o.e, data }, o.by ?? tunde, status);
  const L = (a: { id: number }, b: { id: number }, kind = "related") => seedLink(db, a.id, b.id, kind, tunde);

  // ERM: objectives and appetite -------------------------------------------------
  const obj1 = await R("objective", "Grow gross written premium 25% while keeping the combined ratio below 95%", bola, { period: "2026-2028", target: "Combined ratio < 95%" }, "active", { ou: group, by: adaeze });
  const obj2 = await R("objective", "Hold capital comfortably above the NGN 15bn minimum and ready for NAICOM risk-based capital", bola, { period: "2026-2028", target: "Capital cover >= 150% of minimum" }, "active", { ou: group, by: adaeze });
  const obj3 = await R("objective", "Settle every admitted claim inside the 60-day statutory clock", funmi, { period: "2026", target: "100% within 60 days; 90% within 30" }, "active", { ou: claims, by: adaeze });
  const obj4 = await R("objective", "Never miss a regulatory filing across the group", ngozi, { period: "2026", target: "100% of returns filed on time" }, "active", { e: DFG, ou: compFn, by: adaeze });

  const groupAppetite: [string, number, string][] = [
    ["Insurance risk", 12, "We accept insurance risk in lines we understand and price, within reinsurance-protected net retentions."],
    ["Market risk", 12, "We accept moderate market risk; FX mismatch on USD-denominated liabilities is hedged or matched."],
    ["Credit risk", 10, "We place reinsurance only with approved reinsurers and lend within single-obligor limits."],
    ["Liquidity risk", 9, "Each entity holds liquid assets to meet stressed outflows for its own obligations."],
    ["Operational risk", 10, "We have low appetite for operational losses, fraud and service disruption."],
    ["Compliance and conduct", 6, "We have minimal appetite for regulatory breaches, late filings and unfair customer outcomes."],
    ["Strategic", 12, "We accept strategic risk in pursuit of growth, provided capital adequacy is never compromised."],
    ["ESG and climate", 12, "We accept climate-related risk only with exposure monitoring and screening of high-impact clients."],
    ["Intra-group contagion", 8, "No subsidiary's failure may threaten another's solvency, liquidity or licence."],
    ["Related-party exposure", 8, "Related-party transactions are at arm's length, board-approved and within limits."],
    ["Concentration in own funds", 8, "Group entities' treasury placed in the group's own funds is capped and disclosed."],
    ["Shariah non-compliance", 4, "We have no appetite for non-Shariah-compliant holdings in Islamic products."],
  ];
  for (const [category, threshold, statement] of groupAppetite) {
    await R("appetite", `Group appetite: ${category}`, adaeze, { category, threshold, statement, effective_date: "2026-01-01" }, "approved", { e: DFG, ou: riskFn });
  }
  const entityAppetite: [number, string, number, string, number][] = [
    [DPL, "Compliance and conduct", 4, "Zero tolerance for contributor fund segregation or investment-limit breaches.", hauwa],
    [DMB, "Operational risk", 8, "Tight appetite for digital channel fraud given deposit-holder exposure.", tobi],
    [DAM, "Liquidity risk", 8, "Each fund meets redemptions in its own currency without forced sales.", kunle],
  ];
  for (const [e, category, threshold, statement, owner] of entityAppetite) {
    await R("appetite", `Entity appetite: ${category}`, owner, { category, threshold, statement, effective_date: "2026-01-01" }, "approved", { e, ou: riskFn, by: owner });
  }

  // ERM: risk register across entities ---------------------------------------
  type RiskSeed = [number, string, string, string, string, number, [number, number], [number, number], [number, number], { id: number }, string];
  const riskSeeds: RiskSeed[] = [
    [DIP, "Under-reserving on motor and liability claims", "Insurance risk", "Reserving", "Motor", emeka, [4, 5], [3, 4], [2, 3], obj1, "Claims inflation and delayed reporting leave IBNR reserves short of ultimate cost."],
    [DIP, "Large-risk accumulation on the energy book", "Insurance risk", "Accumulation", "Oil and gas / energy", emeka, [3, 5], [3, 4], [2, 4], obj2, "Several large onshore and offshore energy risks share the same storm and pipeline exposures."],
    [DIP, "Reinsurer default on the energy book", "Credit risk", "Reinsurer counterparty", "Oil and gas / energy", bola, [3, 5], [2, 5], [2, 4], obj2, "Large facultative cessions concentrated with two reinsurers."],
    [DIP, "Naira depreciation against USD-denominated claims", "Market risk", "FX", "Investments", bola, [5, 4], [4, 4], [3, 3], obj2, "Marine and energy claims payable in USD while assets are largely naira-denominated."],
    [DIP, "Organised claims fraud in motor", "Operational risk", "Fraud", "Motor", funmi, [4, 4], [3, 4], [2, 3], obj3, "Staged accidents and collusive repair workshops inflate claims."],
    [DIP, "Ransomware attack disrupting policy and claims systems", "Operational risk", "Cyber (status from SecureComply)", "Group", segun, [4, 5], [3, 5], [2, 4], obj3, "Feed from SecureComply: patch and backup control gaps on the core policy system."],
    [DIP, "Capital falling below the NGN 15bn minimum or future RBC requirement", "Strategic", "Capital adequacy", "Group", bola, [3, 5], [2, 5], [1, 5], obj2, "Growth, FX losses or a large claim erode capital before NAICOM finalises risk-based capital."],
    [DIP, "Admitted claims not settled inside the 60-day statutory clock", "Compliance and conduct", "Claims conduct", "Motor", funmi, [4, 4], [2, 4], [1, 3], obj3, "Discharge vouchers and reinsurance recoveries delay payment beyond NIIRA 2025 s.210."],
    [DIP, "A regulatory return is filed late", "Compliance and conduct", "Regulatory reporting", "Group", ngozi, [4, 4], [2, 3], [1, 3], obj4, "Many returns across NAICOM, SEC, NGX, NFIU and NDPC with manual tracking."],
    [DIP, "Broker premium remittance delays", "Credit risk", "Premium debtors", "Group", bola, [4, 3], [3, 3], [2, 2], obj1, "Brokers hold premium beyond the no-premium-no-cover window."],
    [DIP, "Physical climate risk on the energy and property book", "ESG and climate", "Physical climate", "Oil and gas / energy", emeka, [3, 4], [3, 3], [2, 3], obj1, "Flooding and coastal erosion increase loss frequency on Niger Delta assets."],
    [DIP, "Key-person dependency in actuarial and IFRS 17 reporting", "Operational risk", "People", "Group", amaka, [3, 3], [2, 3], [2, 2], obj2, "One qualified actuary runs the IFRS 17 PAA model and reserving."],
    [DIP, "Prolonged outage of the core policy administration system", "Operational risk", "Business continuity", "Group", segun, [3, 4], [2, 4], [2, 3], obj3, "Single data centre with untested failover."],
    [DPL, "RSA fund assets not segregated from company accounts", "Compliance and conduct", "Fund segregation", "Pension fund administration", hauwa, [3, 5], [2, 4], [1, 3], obj4, "Reconciliation breaks between custodian and administrator records on contributions in transit."],
    [DPL, "Breach of investment limits on an RSA fund", "Compliance and conduct", "Investment limits", "Pension fund administration", hauwa, [3, 4], [2, 3], [1, 3], obj4, "Single-issuer concentration close to the limit after a market move."],
    [DAM, "Dollar Fund liquidity squeeze on mass redemptions", "Liquidity risk", "Fund liquidity", "Fund management", kunle, [3, 4], [3, 3], [2, 3], obj2, "USD redemptions cluster when the naira weakens; eurobond holdings take days to sell."],
    [DAM, "Non-Shariah-compliant holdings in the Islamic fund", "Shariah non-compliance", "Shariah screening", "Fund management", kunle, [2, 4], [1, 3], [1, 2], obj1, "An issuer's activities change after purchase and screening lags."],
    [DAM, "Group treasury concentrated in the group's own money market fund", "Concentration in own funds", "Own-fund concentration", "Fund management", bola, [3, 4], [2, 3], [2, 2], obj2, "Subsidiaries park surplus cash in the house fund; a run would hit fund and group together."],
    [DSL, "Late client trade confirmations", "Compliance and conduct", "Client reporting", "Stockbroking", ngozi, [4, 3], [3, 2], [2, 2], obj4, "Manual contract-note process misses the next-day standard on busy days."],
    [DAP, "Related-party funding of the insurer's capital raise", "Related-party exposure", "Related-party transactions", "Issuing house and advisory", bola, [3, 4], [2, 4], [2, 3], obj2, "Deposit-for-shares and underwriting commitments from the parent to the insurer."],
    [DMB, "Digital channel fraud on agent and USSD transactions", "Operational risk", "Fraud", "Microfinance banking", tobi, [4, 4], [3, 3], [2, 2], obj1, "SIM-swap and agent float fraud rising with transaction volumes."],
    [DIB, "Single-obligor concentration in the infrastructure loan book", "Credit risk", "Concentration", "Infrastructure finance", musa, [3, 5], [3, 4], [2, 4], obj2, "Three power-sector borrowers account for most of the book."],
    [DFG, "Contagion from an insurer capital shortfall to the wider group", "Intra-group contagion", "Contagion", "Group", adaeze, [2, 5], [2, 4], [1, 4], obj2, "A shortfall at the insurer damages the group's funding, ratings and other licences."],
    [DFG, "Failure of shared group IT services affects every subsidiary", "Operational risk", "Intra-group outsourcing", "Group", segun, [3, 4], [2, 4], [2, 3], obj3, "One shared-services team runs infrastructure for all entities."],
  ];
  const risks: Awaited<ReturnType<typeof R>>[] = [];
  for (const [i, [e, title, category, subcategory, business_line, owner, inh, res, tgt, obj, description]] of riskSeeds.entries()) {
    const r = await R(
      "risk",
      title,
      owner,
      {
        description,
        category,
        subcategory,
        business_line,
        principal: [0, 1, 3, 5, 6, 7, 8, 13, 15, 21, 22].includes(i),
        inherent_likelihood: inh[0],
        inherent_impact: inh[1],
        residual_likelihood: res[0],
        residual_impact: res[1],
        target_likelihood: tgt[0],
        target_impact: tgt[1],
        treatment: i === 2 ? "Transfer (incl. reinsurance)" : "Reduce",
        velocity: i === 5 || i === 15 ? "Fast (days)" : "Moderate (weeks)",
        trend: [3, 4, 20].includes(i) ? "Increasing" : "Stable",
        last_review: d(-((i * 7) % 60) - 5),
        expected_loss: ((i * 137) % 900 + 40) * 1_000_000,
      },
      i === 12 ? "submitted" : "active",
      { e, ou: i === 4 || i === 7 ? claims : group, by: e === DPL ? hauwa : e === DMB ? tobi : e === DIB ? musa : tunde },
    );
    risks.push(r);
    await seedLink(db, obj.id, r.id, "threatens", tunde);
  }

  // Appetite-breach actions for risks seeded outside appetite
  let actionCount = 0;
  for (const r of risks) {
    if (r.data.appetite_status === "Outside appetite") {
      const a = await R("action", `Appetite breach: ${r.title}`, r.ownerId, {
        source: "Appetite breach",
        description: `Residual score ${r.data.residual_score} exceeds appetite threshold ${r.data.appetite_threshold}. Agree treatment or seek formal acceptance.`,
        priority: "High",
        due_date: d(10 + actionCount * 6),
        progress: 30,
      }, "in_progress", { e: r.entityId, by: r.entityId === DPL ? hauwa : r.entityId === DMB ? tobi : r.entityId === DIB ? musa : tunde });
      await L(r, a, "treats");
      actionCount++;
    }
  }

  const controlSeeds: [string, string, number, number, string, string, string][] = [
    ["Quarterly IBNR reserve review by the Head of Actuarial", "Detective", amaka, 0, "Effective", "Effective", "First line"],
    ["Energy accumulation check at underwriting", "Preventive", emeka, 1, "Effective", "Partially effective", "First line"],
    ["Reinsurer security approval list (A- minimum)", "Preventive", adaeze, 2, "Effective", "Effective", "Second line"],
    ["Monthly FX asset-liability matching report", "Detective", bola, 3, "Partially effective", "Partially effective", "First line"],
    ["SIU red-flag referral rules on motor claims", "Detective", funmi, 4, "Effective", "Ineffective", "First line"],
    ["Immutable offline backups of core systems", "Corrective", segun, 5, "Partially effective", "Not tested", "First line"],
    ["Weekly claims-ageing review against the 60-day clock", "Detective", funmi, 7, "Effective", "Partially effective", "First line"],
    ["Group returns calendar with escalation to Enterprise Assurance", "Preventive", ngozi, 8, "Effective", "Effective", "Second line"],
    ["Daily custodian-to-administrator RSA reconciliation", "Detective", hauwa, 13, "Effective", "Partially effective", "First line"],
    ["Independent Shariah screening before purchase and quarterly", "Preventive", kunle, 16, "Effective", "Effective", "Second line"],
    ["Board approval of related-party transactions above threshold", "Preventive", ngozi, 19, "Effective", "Effective", "Board and oversight"],
  ];
  const controls = [];
  for (const [title, control_type, owner, riskIdx, design, operating, lod] of controlSeeds) {
    const c = await R("control", title, owner, { description: title, control_type, nature: "Manual", frequency: "Monthly", design_rating: design, operating_rating: operating, key_control: true, last_test: d(-60), line_of_defence: lod }, "active", { e: risks[riskIdx].entityId, by: risks[riskIdx].entityId === DPL ? hauwa : tunde });
    await L(c, risks[riskIdx], "mitigates");
    controls.push(c);
  }

  // KRIs ------------------------------------------------------------------------
  const quarters = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"];
  const capital = await R("kri", "Capital against the NGN 15bn minimum capital requirement", bola, {
    definition: "Admissible capital of Demo Insurance against the NIIRA 2025 non-life minimum capital (NGN 15bn). Red below 100%, amber inside a 20% buffer. Swap the requirement for the RBC figure once NAICOM finalises its framework.",
    kri_kind: "Capital vs requirement", unit: "NGN", direction: "Lower is worse", requirement: NON_LIFE_MCR_NGN, buffer_pct: 20, frequency: "Quarterly", data_source: "Finance: management accounts",
  }, "active");
  await seedReading(db, capital.id, [12.8e9, 13.9e9, 16.4e9, 33.1e9].map((value, i) => ({ date: quarters[i], value })));
  await L(capital, risks[6], "monitors");
  const kriSeeds: [number, string, number | null, string, string, number, number, number[]][] = [
    [DIP, "Motor claims ratio", 0, "%", "Higher is worse", 65, 75, [61, 66, 70, 77]],
    [DIP, "Admitted claims unsettled after 60 days", 7, "% of open admitted claims", "Higher is worse", 5, 10, [12, 9, 7, 6]],
    [DIP, "Ceded premium with the largest reinsurer", 2, "%", "Higher is worse", 30, 40, [26, 28, 31, 33]],
    [DIP, "Net USD liability mismatch", 3, "USD m", "Higher is worse", 5, 8, [3.2, 4.8, 6.1, 8.4]],
    [DIP, "SIU referrals per 1,000 motor claims", 4, "count", "Lower is worse", 12, 8, [15, 13, 11, 9]],
    [DPL, "RSA reconciliation breaks open over 5 days", 13, "count", "Higher is worse", 5, 10, [4, 3, 6, 2]],
    [DAM, "Dollar Fund liquid assets", 15, "% of NAV", "Lower is worse", 25, 15, [38, 31, 27, 24]],
    [DMB, "Digital channel fraud losses", 20, "NGN m per quarter", "Higher is worse", 20, 40, [12, 18, 26, 43]],
    [DFG, "Regulatory returns filed on time", 8, "%", "Lower is worse", 98, 95, [94, 96, 98, 100]],
  ];
  for (const [e, title, riskIdx, unit, direction, amber, red, values] of kriSeeds) {
    const owner = riskIdx !== null ? risks[riskIdx].ownerId : ngozi;
    const k = await R("kri", title, owner, { definition: title, kri_kind: "Standard", unit, direction, amber_limit: amber, red_limit: red, frequency: "Quarterly", data_source: "Management information" }, "active", { e, by: e === DPL ? hauwa : e === DMB ? tobi : tunde });
    await seedReading(db, k.id, values.map((value, i) => ({ date: quarters[i], value })));
    if (riskIdx !== null) await L(k, risks[riskIdx], "monitors");
  }

  // Loss events --------------------------------------------------------------------
  const l1 = await R("loss_event", "Staged multi-vehicle accident claims paid before SIU referral", funmi, { event_date: d(-75), discovery_date: d(-60), event_source: "Internal loss", description: "Three linked motor claims paid; later found to be staged.", event_type: "External fraud", currency: "NGN", gross_loss: 18_500_000, recoveries: 2_000_000, insurance_recoveries: 0, risk_ref: risks[4].ref, root_cause: "Referral rules not applied to claims below the auto-pay threshold." }, "validated");
  await L(risks[4], l1, "materialised");
  const l2 = await R("loss_event", "Reinsurance recovery on a marine cargo claim short-paid", amaka, { event_date: d(-50), event_source: "Internal loss", description: "Reinsurer applied a different exchange rate and a late-notification deduction on a USD claim.", event_type: "Execution, delivery and process management", currency: "USD", fx_rate: 1530, gross_loss: 42_000, recoveries: 0, insurance_recoveries: 0, risk_ref: risks[3].ref }, "reported");
  await L(risks[3], l2, "materialised");
  const l3 = await R("loss_event", "SIM-swap fraud on customer wallets", tobi, { event_date: d(-33), event_source: "Internal loss", description: "Customers' SIMs swapped and wallets drained through USSD.", event_type: "External fraud", currency: "NGN", gross_loss: 58_000_000, recoveries: 6_500_000, insurance_recoveries: 0, risk_ref: risks[20].ref }, "validated", { e: DMB, by: tobi });
  await L(risks[20], l3, "materialised");
  await R("loss_event", "Near miss: Islamic fund about to buy a non-compliant sukuk tranche", kunle, { event_date: d(-12), event_source: "Near miss", near_miss: true, description: "Pre-trade screen caught a conventional tranche mislabelled as sukuk.", event_type: "Execution, delivery and process management", currency: "NGN", gross_loss: 0, risk_ref: risks[16].ref }, "reported", { e: DAM, by: kunle });
  await R("loss_event", "Peer insurer: cyber extortion payment (external loss)", segun, { event_date: d(-90), event_source: "External loss (industry or peer)", description: "Industry report of a peer insurer paying to restore encrypted systems. Kept for scenario analysis.", event_type: "Business disruption and system failure", currency: "USD", fx_rate: 1500, gross_loss: 250_000, recoveries: 0 }, "validated", { e: DFG });

  await R("emerging_risk", "Mandatory climate disclosure under the IFRS S2 adoption roadmap", halima, { description: "FRC roadmap may require IFRS S2 climate disclosures, including insured and financed emissions.", horizon: "1-3 years", potential_impact: "High", signals: "FRC and NGX guidance; peer disclosures." }, "watching", { e: DFG });
  await R("emerging_risk", "NAICOM risk-based capital framework finalised with higher charges for energy risks", adaeze, { description: "The final RBC framework is not yet issued; charges on energy and catastrophe exposures may exceed the QIS.", horizon: "0-1 years", potential_impact: "High", signals: "NAICOM QIS circulars; consultant updates." }, "watching");
  await R("emerging_risk", "Generative-AI-enabled document fraud in claims", chidi, { description: "Synthetic medical reports and repair invoices produced at scale.", horizon: "0-1 years", potential_impact: "High", signals: "SIU case trends; industry fraud bureau alerts." }, "watching");
  await R("model", "IFRS 17 measurement model (premium allocation approach)", amaka, { model_type: "IFRS 17", materiality: "Tier 1", validator: "External actuarial firm", last_validation: d(-400), next_validation: d(-35), purpose: "Liability for remaining coverage and incurred claims for statutory accounts." }, "in_use");
  await R("model", "Capital and RBC readiness workbook", bola, { model_type: "Capital / RBC", materiality: "Tier 1", validator: "Internal Audit", last_validation: d(-200), next_validation: d(165), purpose: "Capital against the minimum and the NAICOM RBC quantitative impact study template." }, "in_use");
  await R("model", "Motor pricing GLM", emeka, { model_type: "Pricing", materiality: "Tier 2", validator: "Risk management", last_validation: d(-500), next_validation: d(-135) }, "in_use");
  const acc = await R("risk_acceptance", "Accept residual FX mismatch until USD bond allocation completes", bola, { rationale: "Matching assets being acquired over two quarters.", residual_at_acceptance: 16, authority: "Board Risk Committee", expiry_date: d(80) }, "requested", { by: bola });
  await L(acc, risks[3], "accepts");

  // ORSA, Risk Management Declaration and FCR (Demo Insurance) ----------------------
  await R("orsa", "ORSA FY2025: Demo Insurance", kemi, {
    financial_year: 2025, year_end: "2025-12-31", board_owner: kemi,
    register_summary: "13 active risks; 4 outside appetite.\nInsurance risk: 2 risks, highest residual 12.\nMarket risk: FX mismatch outside appetite.\n9 KRIs monitored; 1 red.",
    capital_summary: "Capital NGN 12.8bn against the NGN 15bn minimum (85%, red) at 31 Dec 2025. Recapitalisation plan approved by the board.",
    compiled_on: "2026-01-28",
    stress_tests: "Naira depreciation of 30%; a NGN 5bn energy loss net of reinsurance; reinsurer downgrade; 20% premium shortfall.",
    forward_assessment: "Capital restored above the minimum by Q3 2026 through the public offer; RBC readiness tracked against the QIS template.",
    conclusions: "Complete the capital raise; reduce single-reinsurer concentration; build a claims-ageing control.",
    board_approval_date: "2026-02-19", submitted_date: "2026-02-24", reference: "ORSA-2025-DEMO-01",
  }, "submitted", { by: adaeze });
  await R("orsa", "ORSA FY2026: Demo Insurance", kemi, { financial_year: 2026, year_end: "2026-12-31", board_owner: kemi }, "draft", { by: adaeze });
  await R("rm_declaration", "Risk Management Declaration FY2025: Demo Insurance", ngozi, {
    financial_year: 2025, due_date: "2026-03-31",
    statement: "The board confirms that the company has a risk management framework appropriate to its business, that it monitors risks against its approved appetite, and that the systems of internal control operated effectively during the year except as disclosed.",
    basis: "ORSA FY2025, risk register and appetite monitoring, internal audit opinion, independent review of the framework.",
    director_1_by: kemi, director_1_on: "2026-02-19", director_2_by: ifeoma, director_2_on: "2026-02-20", submitted_date: "2026-02-24", reference: "RMD-2025-DEMO-01",
  }, "submitted", { by: ngozi });
  await R("rm_declaration", "Risk Management Declaration FY2026: Demo Insurance", ngozi, {
    financial_year: 2026, due_date: "2027-03-01",
    statement: "The board confirms that the company has a risk management framework appropriate to its business, that it monitors risks against its approved appetite, and that the systems of internal control operated effectively during the year except as disclosed.",
    basis: "ORSA FY2026 (in preparation), risk register and appetite monitoring, internal audit opinion.",
  }, "draft", { by: ngozi });
  await R("fcr", "Financial Condition Report FY2025: Demo Insurance", adaeze, { financial_year: 2025, actuary_firm: "Example Actuarial Partners (fictional)", actuary_independent: true, report_date: "2026-04-10", published_date: "2026-04-21", key_findings: "Capital below minimum at year end; recapitalisation in progress; reserves adequate." }, "published", { by: adaeze });
  await R("fcr", "Financial Condition Report FY2026: Demo Insurance", adaeze, { financial_year: 2026, actuary_firm: "Example Actuarial Partners (fictional)" }, "commissioned", { by: adaeze });

  // Policies ------------------------------------------------------------------
  const policySeeds: [number, string, string, number, string, string][] = [
    [DFG, "Group Enterprise Risk Management Policy and Appetite Framework", "Board", adaeze, "Sets the group framework, entity appetites and the three lines of defence.", "Report risks to your risk champion\nReview your risks on time\nEscalate appetite breaches immediately"],
    [DIP, "Underwriting Policy", "Board committee", emeka, "Authority limits, accumulation rules and referral criteria.", "Check the accumulation tool before binding energy risks\nRefer risks above your authority"],
    [DIP, "Claims Management Policy", "Board committee", funmi, "Claims standards, settlement inside the 60-day statutory clock and SIU referral.", "Refer red-flag claims to SIU before payment\nSettle admitted claims within 60 days"],
    [DIP, "Reinsurance Strategy and Security Policy", "Board", bola, "Retentions, programme structure and reinsurer security.", "Place only with approved reinsurers\nCheck the panel limit before ceding"],
    [DFG, "Group AML/CFT/CPF Policy", "Board", ngozi, "Customer due diligence, third-party payments and STR reporting to NFIU across all entities.", "Verify the payer on third-party payments\nReport suspicions to the MLRO, not the customer"],
    [DFG, "Conflicts of Interest, Related Parties and Gifts Policy", "Board committee", ngozi, "Declarations, gift thresholds, related-party approval and recusal.", "Declare gifts above NGN 50,000\nRecuse yourself from decisions involving a declared interest"],
    [DFG, "Group Whistleblowing Policy", "Board", ngozi, "Protected reporting channels, non-retaliation and reporting to the Audit Committee.", "Use the anonymous portal if you prefer\nNever try to identify a reporter"],
    [DFG, "Group Regulatory Reporting Policy", "ExCo", ngozi, "Every return has an owner, a reviewer and a calendar entry; Enterprise Assurance tracks filing.", "Prepare returns before the reminder date\nRecord the submission reference the day you file"],
  ];
  const policies = [];
  for (const [i, [e, title, tier, owner, summary, dos]] of policySeeds.entries()) {
    const p = await R("policy", title, owner, { doc_type: "Policy", tier, version: "2.0", summary, dos, donts: "", audience: "All staff", effective_date: d(-200), next_review: d(i === 1 ? -12 : 160 + i * 10) }, "published", { e, ou: compFn, by: zainab });
    policies.push(p);
  }
  await L(policies[0], risks[0], "governs");
  await L(policies[2], risks[7], "governs");
  await L(policies[7], risks[8], "governs");
  await R("policy", "Outsourcing and Third-Party Risk Policy", adaeze, { doc_type: "Policy", tier: "Board", version: "1.0", summary: "Due diligence, tiering, contracts, regulator notification and exit for third parties, including intra-group services.", audience: "All staff" }, "draft", { e: DFG, ou: compFn });
  for (const [uid, done] of [[funmi, true], [emeka, true], [yusuf, false], [segun, false], [amaka, true]] as [number, boolean][]) {
    const a = await R("attestation", `Attest: ${policies[4].title}`, uid, { policy_version: "2.0", acknowledged: done, attested_on: done ? d(-5) : null }, done ? "attested" : "pending", { e: DFG, by: zainab });
    await L(policies[4], a, "attestation");
  }
  const pex = await R("policy_exception", "Temporary auto-pay above threshold for flood claims in Port Harcourt", yusuf, { justification: "Mass flood event; manual review backlog threatens the 60-day clock.", compensating_controls: "Post-payment SIU sampling of 20%.", risk_rating: "Medium", expiry_date: d(30) }, "approved", { ou: ph, by: yusuf });
  await L(pex, policies[2], "exception-to");

  // Compliance: frameworks with primary citations ------------------------------------------
  const fw = async (title: string, issuer: string, edition: string, desc: string, e: number | null = DIP) =>
    R("framework", title, ngozi, { issuer, jurisdiction: "Nigeria", edition, description: desc }, "active", { e, ou: compFn, by: zainab });
  const niira = await fw("Nigerian Insurance Industry Reform Act 2025 (NIIRA)", "National Assembly; administered by NAICOM", "Assented 31 July 2025", "s.15 minimum capital; s.25-26 risk-based supervision and annual RBC report by 31 March; s.202 AML/CFT/CPF; s.206 internal control over financial reporting; s.207 fraud reporting; s.210 claims settlement within 60 days.");
  const pg = await fw("NAICOM Prudential Guidelines for Insurance Institutions", "NAICOM", "Revised October 2022", "s.6.2 risk management framework (CRO, ERM committee, register, appetite); s.6.2.7 three lines of defence; s.6.2.8 independent review; s.6.2.9 Risk Management Declaration by two directors; s.6.4 ORSA within 60 days of year end; s.6.5 Financial Condition Report; s.9 outsourcing notification.");
  const cg = await fw("NAICOM Corporate Governance Guidelines", "NAICOM", "2021", "Board committees including Compliance and Finance, Investment and General Purpose (s.2.2); conflicts of interest (s.7); whistleblowing (s.11). Read with the NCCG 2018.");
  const aml = await fw("NAICOM AML/CFT/CPF Regulations", "NAICOM / NFIU", "2022 (edition to confirm)", "Customer due diligence, monitoring and STR reporting to the NFIU.");
  const ndpa = await fw("Nigeria Data Protection Act 2023 and GAID 2025", "NDPC", "2023 / 2025", "Breach notification within 72 hours (s.40); annual compliance audit; compliance audit return by 31 March (GAID Art. 7).", DFG);
  const frc = await fw("Nigerian Code of Corporate Governance 2018", "FRC", "2018", "Board risk oversight, internal audit reporting to the Audit Committee, anonymous whistleblowing.", DFG);
  await fw("Pension Reform Act 2014 and PenCom regulations", "PenCom", "Pack to source before go-live", "Not yet loaded. Source PenCom risk management, investment and governance regulations before go-live.", DPL);
  await fw("Investments and Securities Act and SEC Rules", "SEC Nigeria", "Pack to source before go-live", "Not yet loaded. Source collective investment scheme, broker-dealer and AML/CFT rules before go-live.", DAM);
  await fw("CBN prudential and AML/CFT frameworks for MFBs and DFIs", "CBN", "Pack to source before go-live", "Not yet loaded. Source before go-live.", DMB);
  const oblSeeds: [typeof niira, string, string, string, string, string][] = [
    [niira, "s.25", "File the annual risk-based capital report with NAICOM by 31 March as at 31 December.", "Annual", "Compliant", "Insurer"],
    [niira, "s.15", "Maintain capital at or above the NGN 15bn non-life minimum.", "Ongoing", "Compliant", "Insurer"],
    [niira, "s.210", "Settle admitted claims, decide special-risk claims and give written declines within 60 days.", "Ongoing", "Partially compliant", "Insurer"],
    [pg, "s.6.2.7", "Operate three lines of defence with clear first, second and third line responsibilities.", "Ongoing", "Compliant", "Insurer"],
    [pg, "s.6.2.9", "File an annual Risk Management Declaration signed by two directors.", "Annual", "Compliant", "Insurer"],
    [pg, "s.6.4", "Complete an ORSA at least annually, owned by the board, submitted within 60 days of year end.", "Annual", "Compliant", "Insurer"],
    [pg, "s.9.4.1", "Notify NAICOM of outsourcing within 30 days and report on it every six months.", "Event-driven", "Partially compliant", "Insurer"],
    [cg, "s.2.2", "Maintain the required board committees, including Compliance and FIGP.", "Ongoing", "Compliant", "Insurer"],
    [aml, "CDD", "Verify the identity of policyholders and third-party payers before cover incepts.", "Ongoing", "Partially compliant", "Insurer"],
    [aml, "STR", "Report suspicious transactions to the NFIU.", "Event-driven", "Compliant", "All entities"],
    [ndpa, "s.40", "Notify the NDPC of qualifying personal data breaches within 72 hours.", "Event-driven", "Compliant", "All entities"],
    [ndpa, "GAID Art. 7", "File the annual data protection compliance audit return by 31 March.", "Annual", "Not assessed", "All entities"],
    [frc, "Whistleblowing", "Provide a protected whistleblowing channel reporting to the Audit Committee.", "Ongoing", "Compliant", "All entities"],
  ];
  const obligations = [];
  for (const [f, clause, req, freq, status, applicability] of oblSeeds) {
    const o = await R("obligation", `${clause}: ${req.slice(0, 70)}`, ngozi, { clause_ref: clause, requirement: req, frequency: freq, applicability, compliance_status: status }, "active", { e: f.entityId, ou: compFn, by: zainab });
    await L(f, o, "contains");
    obligations.push(o);
  }
  await L(obligations[8], controls[2], "satisfied-by");
  await L(obligations[3], policies[0], "satisfied-by");
  await L(obligations[9], policies[4], "satisfied-by");

  const test1 = await R("control_test", "Q3 test of SIU red-flag referral rules", zainab, { test_type: "Independent test (second line)", test_date: d(-21), procedure: "Sample 40 motor claims with two or more red flags; confirm SIU referral before payment.", sample_size: 40, result: "Fail", evidence: "11 of 40 red-flag claims were paid without SIU referral." }, "completed", { ou: compFn, by: zainab });
  await L(test1, controls[4], "tests");
  const f1 = await R("finding", "Control failure: SIU referral rules bypassed on motor claims", funmi, { source: "Compliance test", rating: "High", criteria: "All red-flag claims referred to SIU before payment.", condition: "11 of 40 red-flag claims paid without referral.", cause: "Auto-pay threshold bypasses referral rules.", management_response: "Referral check to be added to auto-pay workflow." }, "response_agreed", { ou: claims, by: zainab });
  await L(test1, f1, "raised-by");
  await L(f1, controls[4], "concerns");
  const fa = await R("action", "Add SIU referral check to motor auto-pay workflow", funmi, { source: "Control test", description: "Block auto-payment where any red flag is present until SIU clears the claim.", priority: "High", due_date: d(-6), progress: 70, progress_note: "Rule configured in test; awaiting release." }, "in_progress", { ou: claims, by: zainab });
  await L(f1, fa, "remediates");
  await R("control_test", "Q4 test of offline backup restores", zainab, { test_type: "Independent test (second line)", procedure: "Restore core policy database from offline copy and check integrity.", test_date: d(14) }, "planned", { ou: it, by: zainab });

  // Returns calendar: per entity, per regulator --------------------------------------
  type Ret = [number, string, string, string, string, string, string, string, number, number | null, number | null];
  const yr = Number(today().slice(0, 4));
  const fyNext = `${yr + 1}-03-31`;
  const returns: Ret[] = [
    // entity, title, regulator, return type, period, recurrence, due, status, owner, reviewer, submittedOffsetDays
    [DIP, "NAICOM ORSA return FY2025", "NAICOM", "ORSA return", "FY2025", "Annual", `${yr}-03-01`, "submitted", adaeze, ngozi, -5],
    [DIP, "NAICOM ORSA return FY2026", "NAICOM", "ORSA return", "FY2026", "Annual", `${yr + 1}-03-01`, "scheduled", adaeze, ngozi, null],
    [DIP, "NAICOM quarterly ORSA return Q3 2026", "NAICOM", "ORSA return", "Q3 2026", "Quarterly", d(17), "in_preparation", tunde, zainab, null],
    [DIP, "NAICOM quarterly ERM return Q3 2026", "NAICOM", "ERM return", "Q3 2026", "Quarterly", d(17), "in_preparation", tunde, zainab, null],
    [DIP, "NAICOM claims return Q3 2026", "NAICOM", "Claims return", "Q3 2026", "Quarterly", d(-3), "in_preparation", funmi, zainab, null],
    [DIP, "NAICOM claims return Q2 2026", "NAICOM", "Claims return", "Q2 2026", "Quarterly", d(-95), "submitted", funmi, zainab, -2],
    [DIP, "Risk-based capital annual report FY2026", "NAICOM", "Risk-based capital annual report", "FY2026", "Annual", fyNext, "scheduled", bola, adaeze, null],
    [DIP, "Audited financial statements FY2026 (SEC)", "SEC", "Audited financial statements", "FY2026", "Annual", fyNext, "scheduled", bola, ngozi, null],
    [DIP, "Audited financial statements FY2026 (NGX)", "NGX", "Audited financial statements", "FY2026", "Annual", fyNext, "scheduled", bola, ngozi, null],
    [DIP, "Unaudited financial statements Q3 2026 (NGX)", "NGX", "Interim financial statements", "Q3 2026", "Quarterly", d(17), "in_preparation", bola, ngozi, null],
    [DIP, "NFIU AML/CFT return Q3 2026", "NFIU", "AML/CFT return", "Q3 2026", "Quarterly", d(4), "in_preparation", ngozi, zainab, null],
    [DIP, "NDPC compliance audit return FY2026", "NDPC", "Data protection compliance audit return", "FY2026", "Annual", fyNext, "scheduled", zainab, ngozi, null],
    [DPL, "PenCom monthly returns Sep 2026", "PenCom", "Prudential returns", "Sep 2026", "Monthly", d(5), "in_preparation", hauwa, ngozi, null],
    [DPL, "NDPC compliance audit return FY2026", "NDPC", "Data protection compliance audit return", "FY2026", "Annual", fyNext, "scheduled", hauwa, ngozi, null],
    [DAM, "SEC quarterly fund returns Q3 2026", "SEC", "Fund returns", "Q3 2026", "Quarterly", d(17), "scheduled", kunle, ngozi, null],
    [DAM, "NDPC compliance audit return FY2026", "NDPC", "Data protection compliance audit return", "FY2026", "Annual", fyNext, "scheduled", kunle, ngozi, null],
    [DSL, "SEC quarterly returns Q3 2026", "SEC", "Quarterly returns", "Q3 2026", "Quarterly", d(17), "scheduled", ngozi, null, null],
    [DMB, "CBN monthly prudential returns Sep 2026", "CBN", "Prudential returns", "Sep 2026", "Monthly", d(8), "in_preparation", tobi, ngozi, null],
    [DMB, "NDPC compliance audit return FY2026", "NDPC", "Data protection compliance audit return", "FY2026", "Annual", fyNext, "scheduled", tobi, ngozi, null],
    [DIB, "CBN monthly prudential returns Sep 2026", "CBN", "Prudential returns", "Sep 2026", "Monthly", d(8), "in_preparation", musa, ngozi, null],
  ];
  const basis: Record<string, string> = {
    "ORSA return": "NAICOM Prudential Guidelines 2022 s.6.4 (quarterly ORSA return frequency to confirm with NAICOM)",
    "ERM return": "NAICOM Prudential Guidelines 2022 s.6 (frequency to confirm with NAICOM)",
    "Claims return": "NAICOM market conduct returns (deadline to confirm)",
    "Risk-based capital annual report": "NIIRA 2025 s.25: annual RBC report by 31 March",
    "Audited financial statements": "SEC and NGX listing rules (deadline to confirm against the rulebook)",
    "Interim financial statements": "NGX Rulebook (deadline to confirm)",
    "AML/CFT return": "NAICOM AML/CFT/CPF Regulations",
    "Data protection compliance audit return": "NDPA 2023 and GAID 2025 Art. 7: by 31 March",
    "Prudential returns": "Regulator's prudential returns calendar (to confirm)",
    "Fund returns": "SEC rules on collective investment schemes (to confirm)",
    "Quarterly returns": "SEC broker-dealer returns (to confirm)",
  };
  for (const [e, title, regulator, return_type, period, recurrence, due, status, owner, reviewer, sub] of returns) {
    const by = e === DPL ? hauwa : e === DMB ? tobi : e === DIB ? musa : zainab;
    await R("reg_return", title, owner, { regulator, return_type, period, recurrence, due_date: due, legal_basis: basis[return_type] ?? null, reminder_days: 14, preparer: owner, reviewer, submitted_date: sub !== null ? addDays(due, sub) : null, reference: sub !== null ? `${regulator}/${period}/DEMO` : null }, status, { e, ou: compFn, by });
  }
  await R("outsourcing_notice", "Initial notification: claims TPA for motor claims (Demo Insurance)", zainab, { notice_type: "Initial notification (30 days)", regulator: "NAICOM", arrangement_date: d(-18), recurrence: "Semi-annual" }, "scheduled", { ou: compFn, by: zainab });
  await R("outsourcing_notice", "Six-monthly report: shared group IT services (intra-group)", zainab, { notice_type: "Six-monthly report", regulator: "NAICOM", due_date: d(40), recurrence: "Semi-annual" }, "scheduled", { ou: compFn, by: zainab });

  await R("reg_change", "NAICOM circular on mandatory risk-based capital quantitative impact study", ngozi, { regulator: "NAICOM", source: "NAICOM circular (QIS FY2025)", issued_date: "2026-06-02", effective_date: "2026-07-31", summary: "Insurers complete and submit the RBC QIS template for FY2025 while NAICOM finalises the framework.", applicable: "Yes", impact: "Capital workbook, data checklist and actuarial sign-off." }, "accepted", { ou: compFn, by: zainab });
  await R("reg_change", "NAICOM recapitalisation circular under NIIRA 2025", ngozi, { regulator: "NAICOM", source: "NAICOM recapitalisation circular", issued_date: "2025-08-12", effective_date: "2026-07-30", summary: "Minimum capital for non-life rises to NGN 15bn with a 30 July 2026 deadline.", applicable: "Yes", impact: "Capital raise; capital KRI against NGN 15bn." }, "implemented", { ou: compFn, by: zainab });
  await R("reg_change", "SEC guidance on fund liquidity management (example)", ngozi, { regulator: "SEC", source: "Example circular (fictional)", issued_date: d(-20), summary: "Example entry for the regulatory circular log.", applicable: "Partially" }, "assessing", { e: DAM, ou: compFn, by: ngozi });
  await R("product_approval", "Parametric flood cover for SME shops in Lagos", emeka, { product_line: "Property", change_type: "New product", description: "Index-triggered payout on rainfall gauge readings.", signoffs: "Underwriting and actuarial signed; legal pending." }, "internal_review", { ou: nonLife });
  for (const [uid, course, done] of [[funmi, "AML/CFT/CPF", true], [yusuf, "AML/CFT/CPF", false], [emeka, "Conflicts of interest", true], [segun, "Data protection", false]] as [number, string, boolean][]) {
    await R("training", `${course} training`, uid, { course, due_date: done ? d(-30) : d(-3), completion_date: done ? d(-40) : null, expiry_date: done ? d(325) : null, score: done ? 88 : null }, done ? "completed" : "assigned", { by: zainab });
  }

  // Actions -------------------------------------------------------------------
  const actSeeds: [string, number, string, string, number, string, number][] = [
    ["Commission an energy accumulation model for the large-risk book", emeka, "Risk", "High", 25, "in_progress", 1],
    ["Re-tender the reinsurance panel to reduce single-reinsurer concentration", bola, "Risk", "Critical", 45, "agreed", 2],
    ["Train a second actuary to run the IFRS 17 model", amaka, "Risk", "Medium", 120, "proposed", 11],
    ["Restore-test offline backups for the policy system", segun, "Risk", "High", -15, "in_progress", 5],
    ["Weekly claims-ageing report to the ERM Committee", funmi, "Risk", "High", 20, "in_progress", 7],
  ];
  for (const [title, owner, source, priority, due, status, riskIdx] of actSeeds) {
    const a = await R("action", title, owner, { source, description: title, priority, due_date: d(due), progress: status === "in_progress" ? 40 : 0, validator: tunde }, status);
    await L(risks[riskIdx], a, "treats");
  }
  const mtg = await R("meeting", "ERM Committee, Q3 2026", kemi, { committee: "ERM Committee", meeting_date: d(-18), quorate: true, attendees: "Kemi Adebayo (Chair), Ifeoma Nnaji, Group CRO, Group CFO, Group CCO", minutes: "Committee reviewed the Q3 risk profile; capital restored above the minimum; FX mismatch outside appetite.", decisions: "1. Management to present FX hedging options at the next meeting." }, "held", { ou: group, by: kemi });
  const ma = await R("action", "Present FX hedging options to the ERM Committee", bola, { source: "Board decision", description: "Options paper on hedging or matching USD liabilities.", priority: "High", due_date: d(40) }, "agreed", { ou: finance, by: kemi });
  await L(mtg, ma, "decided");
  await L(ma, risks[3], "treats");
  await R("meeting", "Board Audit Committee, Q4 2026", kemi, { committee: "Board Audit Committee", meeting_date: d(30) }, "scheduled", { ou: group, by: kemi });
  await R("meeting", "Shariah Advisory Committee, Q4 2026", kunle, { committee: "Shariah Advisory Committee", meeting_date: d(21) }, "scheduled", { e: DAM, by: kunle });

  // Declarations --------------------------------------------------------------
  await R("declaration", "Annual declaration 2026", funmi, { decl_type: "Annual conflict of interest declaration", nil_return: true, triage: "Nil return", review_outcome: "No conflict" }, "filed", { ou: claims, by: funmi });
  await R("declaration", "Annual declaration 2026", yusuf, { decl_type: "Annual conflict of interest declaration", nil_return: false, counterparty: "Rivers Auto Repairs Ltd", counterparty_type: "Supplier", relationship: "Brother-in-law is a director of an approved repair workshop used by the branch." }, "compliance_review", { ou: ph, by: yusuf });
  await R("declaration", "Hospitality from broker at industry dinner", emeka, { decl_type: "Gift or hospitality", gift_direction: "Received", gift_value: 120_000, counterparty: "Meridian Insurance Brokers", counterparty_type: "Broker", event_date: d(-9), relationship: "Dinner and hamper at year-end industry event." }, "compliance_review", { ou: nonLife, by: emeka });
  await R("declaration", "Related-party: parent's deposit for shares in Demo Insurance", bola, { decl_type: "Related-party transaction", nil_return: false, counterparty: "Demo Advisory Partners Ltd", counterparty_type: "Other", relationship: "Group CFO sits on both boards; deposit-for-shares conversion requires board and shareholder approval." }, "completed", { e: DAP, ou: finance, by: bola });
  await R("declaration", "Annual declaration 2026", segun, { decl_type: "Annual conflict of interest declaration" }, "draft", { e: DFG, ou: it, by: segun });

  // Cases ---------------------------------------------------------------------
  const cs = async (title: string, owner: number, data: Record<string, unknown>, status: string, creator = owner, e: number = DIP) => R("case", title, owner, data, status, { e, by: creator });
  await cs("Motor claim repudiated without written reasons", funmi, { case_type: "Customer complaint", channel: "Regulator referral", business_line: "Motor", reported_date: d(-9), description: "Policyholder says the claim was declined by phone with no written reasons.", severity: "Medium", amount_at_risk: 4_200_000 }, "investigating", ngozi);
  await cs("Admitted fire claim for a Lagos warehouse still unpaid", funmi, { case_type: "Claim awaiting settlement or decision", channel: "Broker", business_line: "Property", reported_date: d(-68), description: "Claim admitted; payment held for a reinsurance recovery. Past the 60-day statutory clock.", severity: "High", amount_at_risk: 96_000_000, claim_ref: "PRP/CL/2026/0142" }, "investigating", funmi);
  await cs("Marine cargo claim awaiting admit or decline decision", funmi, { case_type: "Claim awaiting settlement or decision", channel: "Broker", business_line: "Marine and aviation", reported_date: d(-21), description: "Surveyor's report received; decision pending on the warranty breach.", severity: "Medium", amount_at_risk: 38_000_000, claim_ref: "MAR/CL/2026/0077" }, "triaged", funmi);
  const c2 = await cs("Ring of staged accidents linked to two repair workshops", chidi, { case_type: "Suspected claims fraud", channel: "Core system", business_line: "Motor", reported_date: d(-30), description: "Analytics linked 14 claims to the same two workshops and three claimants.", severity: "High", amount_at_risk: 62_000_000, amount_saved: 12_400_000, subjects: "Two repair workshops; three claimants", claim_ref: "MTR/CL/2026/0884" }, "investigating");
  await L(c2, risks[4], "evidences");
  const wb = await cs("Concern about refunds approved by a branch underwriter", chidi, { case_type: "Whistleblowing report", channel: "Anonymous portal", reported_date: d(-6), description: "Reporter alleges premium refunds paid to an account linked to staff.", severity: "High", reporter_key_hash: null }, "triaged", chidi);
  await db.insert(schema.comments).values({ recordId: wb.id, authorId: null, channel: "reporter", body: "I can share the refund dates if needed." });
  await cs("Contributor statements emailed to the wrong employer", hauwa, { case_type: "Data protection breach", channel: "Staff form", reported_date: d(-1), description: "Statements for 230 RSA holders sent to an unrelated employer's HR mailbox.", severity: "High" }, "triaged", hauwa, DPL);
  await cs("Staff member slipped on wet stairs at Abuja branch", halima, { case_type: "HSE incident", channel: "Staff form", reported_date: d(-12), description: "Wet floor, no warning sign; sprained ankle.", severity: "Low", lost_time_days: 3, root_cause: "Process", findings: "Cleaning schedule overlapped with opening hours.", outcome: "Substantiated", lessons: "Clean before opening; signage." }, "closed", yusuf);
  await cs("Large premium paid by an unrelated company, refund requested after three weeks", ngozi, { case_type: "AML/CFT suspicious activity", channel: "Core system", business_line: "Engineering", reported_date: d(-2), description: "NGN 45m premium on a contractors' all-risks policy paid by a third party; cancellation and refund requested.", severity: "High", amount_at_risk: 45_000_000 }, "reported", zainab);
  await cs("Agent float diverted at a microfinance agent location", tobi, { case_type: "Internal fraud or misconduct", channel: "Core system", business_line: "Microfinance banking", reported_date: d(-4), description: "Agent float reconciliation shows NGN 7m diverted over three weeks.", severity: "High", amount_at_risk: 7_000_000 }, "triaged", tobi, DMB);

  // ESG / EHS -----------------------------------------------------------------
  const diesel = await R("esg_metric", "Diesel consumed by generators and fleet", halima, { pillar: "Environmental", unit: "litres", scope: "Scope 1", emission_factor: 2.68, frameworks: ["IFRS S2", "GRI", "NGX sustainability disclosure"], target: 180000, target_year: 2027, method: "Fuel purchase records for all group sites." }, "active", { e: DFG, ou: hr, by: halima });
  await seedReading(db, diesel.id, [{ date: "2026-03-31", value: 61200 }, { date: "2026-06-30", value: 58900 }, { date: "2026-09-30", value: 55400 }]);
  const grid = await R("esg_metric", "Grid electricity purchased", halima, { pillar: "Environmental", unit: "kWh", scope: "Scope 2", emission_factor: 0.43, frameworks: ["IFRS S2", "GRI"], method: "Utility bills, all sites." }, "active", { e: DFG, ou: hr, by: halima });
  await seedReading(db, grid.id, [{ date: "2026-03-31", value: 212000 }, { date: "2026-06-30", value: 224500 }, { date: "2026-09-30", value: 219800 }]);
  const women = await R("esg_metric", "Women in senior management", halima, { pillar: "Social", unit: "%", scope: "Not an emissions metric", frameworks: ["GRI", "NGX sustainability disclosure"], target: 40, target_year: 2028 }, "active", { e: DFG, ou: hr, by: halima });
  await seedReading(db, women.id, [{ date: "2025-12-31", value: 31 }, { date: "2026-06-30", value: 33 }]);
  await R("hse_inspection", "Generator room inspection, Lagos head office", halima, { site: "Lagos head office", inspection_type: "Generator room", inspection_date: d(-25), score: 72, findings: "Fuel spill tray cracked; extinguisher out of date." }, "completed", { e: DFG, ou: hr, by: halima });
  await R("hse_inspection", "Fire safety inspection, Port Harcourt branch", halima, { site: "Port Harcourt branch", inspection_type: "Fire safety", inspection_date: d(9) }, "scheduled", { ou: hr, by: halima });
  await R("permit", "Fire certificate, Lagos head office", halima, { permit_type: "Fire certificate", site: "Lagos head office", issuer: "State fire service", expiry_date: d(21) }, "valid", { e: DFG, ou: hr, by: halima });
  await R("permit", "Generator emission permit, Abuja branch", halima, { permit_type: "Generator emission permit", site: "Abuja branch", issuer: "State environmental agency", expiry_date: d(-4) }, "valid", { ou: hr, by: halima });
  await R("uw_screen", "Onshore gas gathering facility, Delta State", emeka, { client: "Delta Gas Gathering Ltd", sector: "Oil and gas", red_flags: ["Gas flaring", "Community conflict"], decision: "Proceed with conditions", conditions: "Flare-reduction plan and community engagement evidence before renewal." }, "decided", { ou: nonLife, by: emeka });

  // Third parties --------------------------------------------------------------
  const tp = async (title: string, owner: number, data: Record<string, unknown>, status = "approved", e: number = DIP) => R("third_party", title, owner, data, status, { e, by: tunde });
  const re1 = await tp("Atlantic Re (Lagos)", bola, { tp_type: "Reinsurer", critical_service: "Yes", data_access: "Limited", substitutability: "Hard", regulatory_significance: true, annual_value: 4_800_000_000, rating_agency: "AM Best", rating: "B+", rating_date: d(-50), licence_number: "NAICOM/RE/0012", licence_expiry: d(200), last_assessment: d(-300), key_clauses: ["Audit rights", "Termination and exit"] });
  await L(re1, risks[2], "concentration");
  await tp("Northgate Re (London)", bola, { tp_type: "Reinsurer", critical_service: "Yes", data_access: "Limited", substitutability: "Moderate", annual_value: 2_100_000_000, rating_agency: "S&P", rating: "A", rating_date: d(-120), last_assessment: d(-90) });
  await tp("Meridian Insurance Brokers", emeka, { tp_type: "Broker", critical_service: "No", data_access: "Extensive", substitutability: "Easy", annual_value: 1_300_000_000, licence_number: "NAICOM/BR/0456", licence_expiry: d(18), last_assessment: d(-400) });
  const tpa = await tp("Swift Claims Services (motor claims TPA)", funmi, { tp_type: "TPA / HMO", critical_service: "Yes", data_access: "Extensive", substitutability: "Moderate", regulatory_significance: true, annual_value: 350_000_000, last_assessment: d(-200), exit_plan: "Bring claims handling back in-house within 60 days.", key_clauses: ["Audit rights", "Data protection", "SLA and service credits"] });
  const shared = await tp("Demo Group Shared Services (intra-group IT)", segun, { tp_type: "Intra-group service provider", services: "Infrastructure, core-system hosting and service desk for all subsidiaries.", critical_service: "Yes", data_access: "Extensive", substitutability: "Hard", regulatory_significance: true, annual_value: 210_000_000, security_ref: "SecureComply vendor assessment SC-VA-0193", last_assessment: d(-30) });
  await L(shared, risks[23], "source-of");
  await tp("Example Trustees Ltd (fund trustee)", kunle, { tp_type: "Fund trustee", services: "Trustee to the money market and Islamic funds.", critical_service: "Yes", data_access: "Limited", substitutability: "Moderate", regulatory_significance: true, last_assessment: d(-150) }, "approved", DAM);
  await tp("Rivers Auto Repairs Ltd", funmi, { tp_type: "Repair workshop", critical_service: "No", data_access: "None", substitutability: "Easy" }, "suspended");
  const tpa1 = await R("tp_assessment", "Periodic assessment: Swift Claims Services", tunde, { assessment_type: "Periodic", assessment_date: d(-3), financial: "Adequate", conduct: "Adequate", operational: "Weak", screening: "Clear", overall: "Needs improvement", notes: "Claims turnaround 19 days against a 10-day SLA; risk to the 60-day statutory clock." }, "review", { by: zainab });
  await L(tpa1, tpa, "assesses");

  // Internal audit ---------------------------------------------------------------
  const ae = async (title: string, entity_type: string, inherent_risk: string, last_audit: string | null, regulatory_focus = false, e: number = DIP) =>
    R("audit_entity", title, ibrahim, { entity_type, inherent_risk, last_audit, regulatory_focus }, "active", { e, ou: auditFn, by: ibrahim });
  const aeClaims = await ae("Motor and property claims", "Process", "Critical", d(-700), true);
  await ae("Reinsurance placement and recoveries", "Process", "High", d(-420), true);
  await ae("Regulatory reporting across the group", "Process", "High", d(-500), true, DFG);
  await ae("RSA fund administration and reconciliation", "Process", "High", d(-380), true, DPL);
  await ae("IT general controls (with SecureComply evidence)", "Function", "High", d(-200), false, DFG);
  await ae("Port Harcourt branch", "Branch", "Medium", null);
  const eng1 = await R("engagement", "Claims management and 60-day clock audit", ibrahim, { plan_year: yr, quarter: "Q4", scope: "Motor and property claims, auto-pay, SIU referral, settlement inside 60 days.", objectives: "Assess design and operation of claims controls.", budget_hours: 320, actual_hours: 140, report_date: d(35), independence_confirmed: true }, "fieldwork", { ou: auditFn, by: ibrahim });
  await L(aeClaims, eng1, "audited-by");
  await R("engagement", "Group regulatory returns process audit", ibrahim, { plan_year: yr + 1, quarter: "Q1", budget_hours: 240, report_date: d(130) }, "planned", { e: DFG, ou: auditFn, by: ibrahim });
  const eng3 = await R("engagement", "Premium receipting and broker remittance audit", ibrahim, { plan_year: yr, quarter: "Q2", budget_hours: 200, actual_hours: 214, report_date: d(-90), independence_confirmed: true, overall_rating: "Needs improvement" }, "final_report", { ou: auditFn, by: ibrahim });
  const af = await R("finding", "Broker premium ageing not reviewed monthly", bola, { source: "Internal audit", rating: "Medium", criteria: "Monthly ageing review with escalation over 30 days.", condition: "No evidence of review for 4 of 6 months.", cause: "Ownership unclear after reorganisation.", management_response: "Credit control to own monthly review." }, "response_agreed", { ou: finance, by: ibrahim });
  await L(eng3, af, "raised");
  const afa = await R("action", "Assign ownership and evidence monthly broker ageing review", bola, { source: "Internal audit finding", description: "Credit controller to evidence review monthly.", priority: "Medium", due_date: d(-20), progress: 50 }, "in_progress", { ou: finance, by: ibrahim });
  await L(af, afa, "remediates");
  await L(afa, risks[9], "treats");

  // Business continuity ---------------------------------------------------------
  const svc = async (title: string, tolerance_hours: number, owner: number, tolerance_status: string, last_exercise: string | null) =>
    R("business_service", title, owner, { tolerance_hours, tolerance_status, last_exercise, description: title }, "active", { by: adaeze });
  const sClaims = await svc("Claims notification and payment", 48, funmi, "Within tolerance", d(-60));
  const sIssue = await svc("Policy issuance and renewal", 24, emeka, "Outside tolerance", d(-45));
  await svc("Premium collection and receipting", 72, bola, "Not tested", null);
  await svc("Customer and broker contact centre", 8, funmi, "Within tolerance", d(-100));
  await svc("Reinsurance placement and recoveries", 120, bola, "Not tested", null);
  await R("bia", "BIA: Policy issuance", emeka, { process: "Policy issuance and renewal", mtpd_hours: 24, rto_hours: 12, rpo_hours: 4, min_staff: 6, systems: "Core policy administration system; document generation", third_parties: "Demo Group Shared Services", financial_impact: "High", regulatory_impact: "Medium" }, "approved");
  await R("bia", "BIA: Claims payment", funmi, { process: "Claims notification and payment", mtpd_hours: 48, rto_hours: 24, rpo_hours: 4, min_staff: 8, financial_impact: "Medium", regulatory_impact: "High" }, "approved");
  await R("bc_plan", "Continuity plan: Lagos head office", segun, { scope: "Lagos head office and core systems", version: "3.1", call_tree: "CIO > IT duty manager > department heads", recovery_steps: "Invoke DR site; restore from offline backups; switch call routing.", next_review: d(55) }, "approved", { e: DFG });
  const ex1 = await R("bc_exercise", "DR test: core policy system failover", segun, { exercise_type: "DR test", scenario: "Core system loss", exercise_date: d(-45), recovery_hours: 31, met_tolerance: "No", lessons: "Failover runbook out of date; backup restore slower than planned." }, "completed");
  await L(ex1, sIssue, "exercises");
  await L(ex1, risks[12], "raised");
  const ex2 = await R("bc_exercise", "Tabletop: ransomware on claims platform", funmi, { exercise_type: "Tabletop", scenario: "Cyber incident", exercise_date: d(-60), recovery_hours: 30, met_tolerance: "Yes", lessons: "Manual claims payment fallback works for 48 hours." }, "completed");
  await L(ex2, sClaims, "exercises");

  // Notifications so the demo has something in each inbox
  await db.insert(schema.notifications).values([
    { userId: adaeze, recordId: risks[3].id, message: `${risks[3].ref} is outside appetite. Breach action opened.` },
    { userId: ngozi, recordId: null, message: "NAICOM claims return Q3 2026 is overdue. Enterprise Assurance has been alerted." },
    { userId: funmi, recordId: fa.id, message: `${fa.ref} is overdue.` },
    { userId: kemi, recordId: null, message: "The FY2026 Risk Management Declaration is waiting for two directors' signatures." },
  ]);
  void ifeoma;
}
