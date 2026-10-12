// Record-type sync and demo data for a fictional Nigerian multi-line insurer.
// All people and organisations below are invented.
import { eq, sql } from "drizzle-orm";
import type { DB } from "./index";
import * as schema from "./schema";
import { DEFAULT_TYPES } from "../defs/modules";
import type { TypeDef } from "../defs/types";
import { hashPassword } from "../auth/password";
import { seedInsert, seedLink, seedReading } from "../engine/records";
import { addDays, today } from "../engine/pure";

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

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo!2026grc";

const DATA_TABLES = ["records", "record_links", "record_versions", "comments", "audit_log", "notifications", "snapshots", "counters", "users", "org_units", "api_tokens"];

export async function seedIfEmpty(db: DB) {
  const [{ n }] = (await db.execute(sql`SELECT count(*)::int AS n FROM users`)).rows as { n: number }[];
  const done = (await db.execute(sql`SELECT 1 FROM app_settings WHERE key = 'seed_complete'`)).rows.length > 0;
  if (Number(n) > 0) {
    if (done) return;
    // Users exist but no completion marker: either an older complete install, or a demo
    // seed that was cut off before this release made seeding transactional.
    const [{ r }] = (await db.execute(sql`SELECT count(*)::int AS r FROM records`)).rows as { r: number }[];
    if (process.env.SEED_DEMO === "false" || Number(r) >= 100) {
      await db.execute(sql`INSERT INTO app_settings (key, value) VALUES ('seed_complete', now()::text) ON CONFLICT (key) DO NOTHING`);
      return;
    }
    await db.execute(sql.raw(`TRUNCATE ${DATA_TABLES.join(", ")} RESTART IDENTITY`));
  }
  if (process.env.SEED_DEMO === "false") {
    // Production without demo data: create the first administrator only.
    await db.insert(schema.users).values({
      email: process.env.ADMIN_EMAIL ?? "admin@example.com",
      name: "Platform administrator",
      passwordHash: hashPassword(process.env.ADMIN_PASSWORD ?? DEMO_PASSWORD),
      roles: ["admin"],
    });
  } else {
    await seedDemo(db);
  }
  await db.execute(sql`INSERT INTO app_settings (key, value) VALUES ('seed_complete', now()::text) ON CONFLICT (key) DO NOTHING`);
}

const d = (days: number) => addDays(today(), days);

async function seedDemo(db: DB) {
  // Org structure ------------------------------------------------------------
  const ou = async (name: string, kind: string, parentId: number | null = null) =>
    (await db.insert(schema.orgUnits).values({ name, kind, parentId }).returning())[0].id;
  const group = await ou("Group", "group");
  const nonLife = await ou("Non-life business", "division", group);
  const life = await ou("Life and health business", "division", group);
  const claims = await ou("Claims", "function", group);
  const finance = await ou("Finance and investments", "function", group);
  const riskFn = await ou("Risk management", "function", group);
  const compFn = await ou("Compliance", "function", group);
  const auditFn = await ou("Internal audit", "function", group);
  const it = await ou("IT and operations", "function", group);
  const hr = await ou("HR and administration", "function", group);
  const ph = await ou("Port Harcourt branch", "branch", nonLife);
  const abuja = await ou("Abuja branch", "branch", nonLife);

  // People --------------------------------------------------------------------
  const pw = hashPassword(DEMO_PASSWORD);
  const user = async (email: string, name: string, title: string, roles: string[], orgUnitId: number, managerId: number | null = null) =>
    (await db.insert(schema.users).values({ email, name, title, roles, orgUnitId, managerId, passwordHash: pw }).returning())[0].id;
  const admin = await user("admin@demo-insurance.ng", "Platform Admin", "GRC platform administrator", ["admin"], it);
  const kemi = await user("kemi.adebayo@demo-insurance.ng", "Kemi Adebayo", "Chair, Board Risk Management Committee", ["board"], group);
  const adaeze = await user("adaeze.okafor@demo-insurance.ng", "Adaeze Okafor", "Chief Risk Officer", ["cro", "risk"], riskFn);
  const tunde = await user("tunde.bakare@demo-insurance.ng", "Tunde Bakare", "Head of Enterprise Risk", ["risk"], riskFn, adaeze);
  const ngozi = await user("ngozi.eze@demo-insurance.ng", "Ngozi Eze", "Chief Compliance Officer and MLRO", ["compliance", "mlro"], compFn);
  const ibrahim = await user("ibrahim.musa@demo-insurance.ng", "Ibrahim Musa", "Chief Internal Auditor", ["auditor"], auditFn);
  const chidi = await user("chidi.okonkwo@demo-insurance.ng", "Chidi Okonkwo", "Head of Investigations (SIU)", ["investigator"], compFn, ngozi);
  const halima = await user("halima.bello@demo-insurance.ng", "Halima Bello", "HSE and Sustainability Lead", ["hse", "esg"], hr);
  const funmi = await user("funmi.adeyemi@demo-insurance.ng", "Funmi Adeyemi", "Head of Claims", ["staff"], claims);
  const emeka = await user("emeka.nwosu@demo-insurance.ng", "Emeka Nwosu", "Head of Underwriting, Non-life", ["staff"], nonLife);
  const bola = await user("bola.ogunleye@demo-insurance.ng", "Bola Ogunleye", "Chief Financial Officer", ["staff"], finance);
  const segun = await user("segun.alabi@demo-insurance.ng", "Segun Alabi", "Chief Information Officer", ["staff"], it);
  const amaka = await user("amaka.obi@demo-insurance.ng", "Amaka Obi", "Appointed Actuary, Life", ["staff"], life);
  const yusuf = await user("yusuf.danjuma@demo-insurance.ng", "Yusuf Danjuma", "Branch manager and risk champion, Port Harcourt", ["staff"], ph, emeka);
  const zainab = await user("zainab.lawal@demo-insurance.ng", "Zainab Lawal", "Compliance Analyst", ["compliance"], compFn, ngozi);
  void admin;
  void abuja;

  const R = (type: string, title: string, ownerId: number | null, data: Record<string, unknown>, status?: string, orgUnitId: number | null = null, actor: number = tunde) =>
    seedInsert(db, type, { title, ownerId, orgUnitId, data }, actor, status);
  const L = (a: { id: number }, b: { id: number }, kind = "related") => seedLink(db, a.id, b.id, kind, tunde);

  // ERM -----------------------------------------------------------------------
  const obj1 = await R("objective", "Grow gross written premium 25% while keeping the combined ratio below 95%", bola, { period: "2026-2028", target: "Combined ratio < 95%" }, "active", group, adaeze);
  const obj2 = await R("objective", "Exceed NAICOM risk-based capital requirement with a 150% solvency cover", bola, { period: "2026-2028", target: "Solvency cover >= 150%" }, "active", group, adaeze);
  const obj3 = await R("objective", "Settle 90% of valid motor and health claims within 10 working days", funmi, { period: "2026", target: "90% within 10 days" }, "active", claims, adaeze);

  const appetites: [string, number, string][] = [
    ["Insurance risk", 12, "We accept insurance risk in lines we understand and price, within reinsurance-protected net retentions."],
    ["Market risk", 12, "We accept moderate market risk; FX mismatch on USD-denominated liabilities is hedged or matched."],
    ["Credit risk", 10, "We place reinsurance only with approved reinsurers rated A- or better, or approved local reinsurers."],
    ["Liquidity risk", 9, "We hold liquid assets to meet one year of expected claims plus a stressed large-loss event."],
    ["Operational risk", 10, "We have low appetite for operational losses, fraud and service disruption."],
    ["Compliance and conduct", 6, "We have minimal appetite for regulatory breaches and unfair customer outcomes."],
    ["Strategic", 12, "We accept strategic risk in pursuit of growth, provided capital adequacy is never compromised."],
    ["ESG and climate", 12, "We accept climate-related insurance risk only with exposure monitoring and screening of high-impact clients."],
  ];
  for (const [category, threshold, statement] of appetites) {
    await R("appetite", `${category} appetite`, adaeze, { category, threshold, statement, effective_date: "2026-01-01" }, "approved", riskFn, tunde);
  }

  type RiskSeed = [string, string, string, string, number, [number, number], [number, number], [number, number], number, string];
  const riskSeeds: RiskSeed[] = [
    ["Under-reserving on motor and liability claims", "Insurance risk", "Reserving", "Motor", emeka, [4, 5], [3, 4], [2, 3], obj1.id, "Claims inflation and delayed reporting leave IBNR reserves short of ultimate cost."],
    ["Catastrophe accumulation from Lagos flood events", "Insurance risk", "Catastrophe and accumulation", "Property", emeka, [3, 5], [3, 4], [2, 4], obj2.id, "Concentration of property risks in flood-prone Lekki and Victoria Island postcodes."],
    ["Reinsurer default on the energy book", "Credit risk", "Reinsurer counterparty", "Oil and gas / energy", bola, [3, 5], [2, 5], [2, 4], obj2.id, "Large facultative cessions concentrated with two reinsurers."],
    ["Naira depreciation against USD-denominated liabilities", "Market risk", "FX", "Investments", bola, [5, 4], [4, 4], [3, 3], obj2.id, "Marine and energy claims payable in USD while assets are largely naira-denominated."],
    ["Organised claims fraud in motor and health", "Operational risk", "Fraud", "Motor", funmi, [4, 4], [3, 4], [2, 3], obj3.id, "Staged accidents and collusive repair workshops and hospitals inflate claims."],
    ["Ransomware attack disrupting policy and claims systems", "Operational risk", "Cyber (status from SecureComply)", "Group", segun, [4, 5], [3, 5], [2, 4], obj3.id, "Feed from SecureComply: patch and backup control gaps on the core policy system."],
    ["Failure to maintain risk-based capital cover under NIIRA 2025", "Strategic", "Capital adequacy", "Group", bola, [3, 5], [2, 5], [1, 5], obj2.id, "Growth and FX losses erode solvency cover below NAICOM's RBC requirement."],
    ["Money laundering through single-premium life and early surrender", "Compliance and conduct", "AML/CFT", "Individual life", ngozi, [3, 4], [2, 3], [1, 3], obj1.id, "Third-party premium payments and early surrenders used to layer funds."],
    ["Mis-selling through bancassurance partners", "Compliance and conduct", "Conduct", "Group life", ngozi, [3, 3], [2, 2], [1, 2], obj1.id, "Bank staff sell credit life without explaining exclusions."],
    ["Key-person dependency in the actuarial function", "Operational risk", "People", "Individual life", amaka, [3, 3], [2, 3], [2, 2], obj2.id, "One qualified actuary signs off reserves and IFRS 17 models."],
    ["Physical climate risk on the energy and property book", "ESG and climate", "Physical climate", "Oil and gas / energy", emeka, [3, 4], [3, 3], [2, 3], obj1.id, "Flooding and coastal erosion increase loss frequency on Niger Delta assets."],
    ["Claims leakage through TPAs and HMOs", "Operational risk", "Third party", "Health", funmi, [4, 3], [3, 3], [2, 2], obj3.id, "Tariff non-compliance and duplicate billing by HMO network hospitals."],
    ["Broker premium remittance delays", "Credit risk", "Premium debtors", "Group", bola, [4, 3], [3, 3], [2, 2], obj1.id, "Brokers hold premium beyond the no-premium-no-cover window."],
    ["Prolonged outage of the core policy administration system", "Operational risk", "Business continuity", "Group", segun, [3, 4], [2, 4], [2, 3], obj3.id, "Single data centre with untested failover."],
  ];
  const risks: Awaited<ReturnType<typeof R>>[] = [];
  for (const [i, [title, category, subcategory, business_line, owner, inh, res, tgt, objId, description]] of riskSeeds.entries()) {
    const status = i === 13 ? "submitted" : "active";
    const r = await R(
      "risk",
      title,
      owner,
      {
        description,
        category,
        subcategory,
        business_line,
        principal: i < 7,
        inherent_likelihood: inh[0],
        inherent_impact: inh[1],
        residual_likelihood: res[0],
        residual_impact: res[1],
        target_likelihood: tgt[0],
        target_impact: tgt[1],
        treatment: i === 2 ? "Transfer (incl. reinsurance)" : "Reduce",
        velocity: i === 5 ? "Fast (days)" : "Moderate (weeks)",
        trend: i === 3 || i === 4 ? "Increasing" : "Stable",
        last_review: d(-[10, 12, 25, 8, 40, 15, 20, 60, 30, 45, 50, 35, 70, 5][i]),
        expected_loss: [450, 900, 1200, 2100, 380, 750, 0, 120, 60, 40, 300, 260, 180, 220][i] * 1_000_000,
      },
      status,
      i === 4 ? claims : group,
    );
    risks.push(r);
    await seedLink(db, objIdToRec(objId), r.id, "threatens", tunde);
  }
  function objIdToRec(id: number) {
    return id;
  }

  // Appetite-breach actions for risks seeded outside appetite
  let actionCount = 0;
  for (const r of risks) {
    if (r.data.appetite_status === "Outside appetite") {
      const a = await R("action", `Appetite breach: ${r.title}`, r.ownerId, {
        source: "Appetite breach",
        description: `Residual score ${r.data.residual_score} exceeds appetite threshold ${r.data.appetite_threshold}. Agree treatment or seek formal acceptance.`,
        priority: "High",
        due_date: d(10 + actionCount * 8),
        progress: 30,
      }, "in_progress");
      await L(r, a, "treats");
      actionCount++;
    }
  }

  const controlSeeds: [string, string, number, number, string, string][] = [
    ["Quarterly IBNR reserve review by Appointed Actuary", "Detective", amaka, 0, "Effective", "Effective"],
    ["Flood-zone accumulation check at underwriting", "Preventive", emeka, 1, "Effective", "Partially effective"],
    ["Reinsurer security approval list (A- minimum)", "Preventive", adaeze, 2, "Effective", "Effective"],
    ["Monthly FX asset-liability matching report", "Detective", bola, 3, "Partially effective", "Partially effective"],
    ["SIU red-flag referral rules on motor claims", "Detective", funmi, 4, "Effective", "Ineffective"],
    ["Immutable offline backups of core systems", "Corrective", segun, 5, "Partially effective", "Not tested"],
    ["Third-party premium payment KYC check", "Preventive", ngozi, 7, "Effective", "Effective"],
    ["HMO tariff audit on high-value health claims", "Detective", funmi, 11, "Partially effective", "Partially effective"],
  ];
  const controls = [];
  for (const [title, control_type, owner, riskIdx, design, operating] of controlSeeds) {
    const c = await R("control", title, owner, { description: title, control_type, nature: "Manual", frequency: "Monthly", design_rating: design, operating_rating: operating, key_control: true, last_test: d(-60) }, "active");
    await L(c, risks[riskIdx], "mitigates");
    controls.push(c);
  }

  const kriSeeds: [string, number, string, string, number, number, number[]][] = [
    ["Motor claims ratio", 0, "%", "Higher is worse", 65, 75, [61, 66, 70, 77]],
    ["Solvency cover against RBC requirement", 6, "%", "Lower is worse", 160, 130, [182, 171, 158, 149]],
    ["Ceded premium with the largest reinsurer", 2, "%", "Higher is worse", 30, 40, [26, 28, 31, 33]],
    ["Net USD liability mismatch", 3, "USD m", "Higher is worse", 5, 8, [3.2, 4.8, 6.1, 8.4]],
    ["SIU referrals per 1,000 motor claims", 4, "count", "Lower is worse", 12, 8, [15, 13, 11, 9]],
    ["Broker premium debtors over 30 days", 12, "NGN m", "Higher is worse", 800, 1200, [650, 720, 910, 980]],
  ];
  const quarters = ["2025-12-31", "2026-03-31", "2026-06-30", "2026-09-30"];
  for (const [title, riskIdx, unit, direction, amber, red, values] of kriSeeds) {
    const k = await R("kri", title, risks[riskIdx].ownerId, { definition: title, unit, direction, amber_limit: amber, red_limit: red, frequency: "Quarterly", data_source: "Finance and claims MI" }, "active");
    await seedReading(db, k.id, values.map((value, i) => ({ date: quarters[i], value })));
    await L(k, risks[riskIdx], "monitors");
  }

  const l1 = await R("loss_event", "Staged multi-vehicle accident claim paid before SIU referral", funmi, { event_date: d(-75), description: "Three linked motor claims paid; later found to be staged.", event_type: "External fraud", gross_loss: 18_500_000, recoveries: 2_000_000, root_cause: "Referral rules not applied to claims below the auto-pay threshold." }, "validated");
  await L(l1, risks[4], "materialised");
  const l2 = await R("loss_event", "Premium receipts misallocated during system upgrade", bola, { event_date: d(-40), description: "Receipts posted to wrong policies for 4 days.", event_type: "Execution, delivery and process management", gross_loss: 3_200_000, recoveries: 3_200_000 }, "reported");
  await L(l2, risks[13], "materialised");
  await R("emerging_risk", "Mandatory climate disclosure under IFRS S2 adoption roadmap", halima, { description: "FRC roadmap may require IFRS S2 climate disclosures, including insured and financed emissions.", horizon: "1-3 years", potential_impact: "High", signals: "FRC and NGX guidance; peer disclosures." }, "watching");
  await R("emerging_risk", "Generative-AI-enabled document fraud in claims", chidi, { description: "Synthetic medical reports and repair invoices produced at scale.", horizon: "0-1 years", potential_impact: "High", signals: "SIU case trends; industry fraud bureau alerts." }, "watching");
  await R("model", "IFRS 17 measurement model (PAA and GMM)", amaka, { model_type: "IFRS 17", materiality: "Tier 1", validator: "External actuarial firm", last_validation: d(-400), next_validation: d(-35), purpose: "Insurance contract liabilities for statutory accounts." }, "in_use");
  await R("model", "Risk-based capital calculation workbook", bola, { model_type: "Capital / RBC", materiality: "Tier 1", validator: "Internal Audit", last_validation: d(-200), next_validation: d(165), purpose: "Annual RBC return to NAICOM." }, "in_use");
  await R("model", "Motor pricing GLM", emeka, { model_type: "Pricing", materiality: "Tier 2", validator: "Risk management", last_validation: d(-500), next_validation: d(-135) }, "in_use");
  const acc = await R("risk_acceptance", "Accept residual FX mismatch until USD bond allocation completes", bola, { rationale: "Matching assets being acquired over two quarters.", residual_at_acceptance: 16, authority: "Board Risk Committee", expiry_date: d(80) }, "requested", null, bola);
  await L(acc, risks[3], "accepts");

  // Policies ------------------------------------------------------------------
  const policySeeds: [string, string, number, string, string][] = [
    ["Enterprise Risk Management Policy and Appetite Framework", "Board", adaeze, "Sets the risk management framework, appetite and the three lines of defence.", "Report risks to your risk champion\nReview your risks on time\nEscalate appetite breaches immediately"],
    ["Underwriting Policy", "Board committee", emeka, "Authority limits, accumulation rules and referral criteria.", "Check the flood-zone map before binding property risks\nRefer risks above your authority"],
    ["Claims Management Policy", "ExCo", funmi, "Claims handling standards, settlement authorities and SIU referral.", "Refer red-flag claims to SIU before payment\nSettle valid claims within service standards"],
    ["Reinsurance Strategy and Security Policy", "Board", bola, "Retentions, programme structure and reinsurer security.", "Place only with approved reinsurers\nCheck the panel limit before ceding"],
    ["AML/CFT/CPF Policy", "Board", ngozi, "Customer due diligence, third-party payments and STR reporting to NFIU.", "Verify the payer on third-party premium payments\nReport suspicions to the MLRO, not the customer"],
    ["Conflicts of Interest and Gifts Policy", "Board committee", ngozi, "Declarations, gift thresholds and recusal.", "Declare gifts above NGN 50,000\nRecuse yourself from decisions involving a declared interest"],
    ["Whistleblowing Policy", "Board", ngozi, "Protected reporting channels and non-retaliation.", "Use the anonymous portal if you prefer\nNever try to identify a reporter"],
    ["Health, Safety and Environment Policy", "ExCo", halima, "Workplace safety, incident reporting and environmental management.", "Report near misses the same day\nKeep fire exits clear"],
  ];
  const policies = [];
  for (const [i, [title, tier, owner, summary, dos]] of policySeeds.entries()) {
    const p = await R("policy", title, owner, { doc_type: "Policy", tier, version: "2.0", summary, dos, donts: "", audience: "All staff", effective_date: d(-200), next_review: d(i === 1 ? -12 : 160 + i * 10) }, "published", compFn, zainab);
    policies.push(p);
  }
  await L(policies[0], risks[0], "governs");
  await L(policies[2], risks[4], "governs");
  await L(policies[4], risks[7], "governs");
  await R("policy", "Outsourcing and Third-Party Risk Policy", adaeze, { doc_type: "Policy", tier: "Board", version: "1.0", summary: "Due diligence, tiering, contracts and exit for third parties.", audience: "All staff" }, "draft", compFn);
  // Attestation campaign on the AML policy for a few people
  for (const [uid, done] of [[funmi, true], [emeka, true], [yusuf, false], [segun, false], [amaka, true]] as [number, boolean][]) {
    const a = await R("attestation", `Attest: ${policies[4].title}`, uid, { policy_version: "2.0", acknowledged: done, attested_on: done ? d(-5) : null }, done ? "attested" : "pending", null, zainab);
    await L(policies[4], a, "attestation");
  }
  const pex = await R("policy_exception", "Temporary auto-pay above threshold for flood claims in Port Harcourt", yusuf, { justification: "Mass flood event; manual review backlog exceeds 3 weeks.", compensating_controls: "Post-payment SIU sampling of 20%.", risk_rating: "Medium", expiry_date: d(30) }, "approved", ph, yusuf);
  await L(pex, policies[2], "exception-to");

  // Compliance ----------------------------------------------------------------
  const fw = async (title: string, issuer: string, edition: string, desc: string) =>
    R("framework", title, ngozi, { issuer, jurisdiction: "Nigeria", edition, description: desc }, "active", compFn, zainab);
  const niira = await fw("Nigerian Insurance Industry Reform Act 2025", "National Assembly / NAICOM", "2025", "Risk-based capital, licensing, corporate governance and enforcement.");
  const cg = await fw("NAICOM Corporate Governance Guidelines", "NAICOM", "Confirm current edition", "Board structure, risk committee, CRO and ERM framework.");
  const aml = await fw("NAICOM AML/CFT/CPF Regulations", "NAICOM / NFIU", "Confirm current edition", "Customer due diligence, monitoring and STR reporting.");
  const ndpa = await fw("Nigeria Data Protection Act 2023 and GAID", "NDPC", "2023 / 2025", "Lawful processing, breach notification and annual compliance audit returns.");
  const frc = await fw("Nigerian Code of Corporate Governance", "FRC", "2018", "Board accountability, disclosure and whistleblowing.");
  const oblSeeds: [typeof niira, string, string, string, string][] = [
    [niira, "Risk-based capital", "File the annual risk-based capital report with NAICOM by 31 March.", "Annual", "Compliant"],
    [niira, "Capital", "Maintain capital at or above the higher of the minimum and the risk-based requirement.", "Ongoing", "Compliant"],
    [cg, "Risk committee", "Maintain a Board Risk Management Committee and an independent CRO.", "Ongoing", "Compliant"],
    [cg, "ERM framework", "Maintain a board-approved ERM framework covering appetite and stress testing.", "Annual", "Partially compliant"],
    [aml, "CDD", "Verify the identity of policyholders and third-party payers before cover incepts.", "Ongoing", "Partially compliant"],
    [aml, "STR", "Report suspicious transactions to the NFIU promptly.", "Event-driven", "Compliant"],
    [ndpa, "Breach notification", "Notify the NDPC of qualifying personal data breaches within 72 hours.", "Event-driven", "Compliant"],
    [ndpa, "Compliance audit return", "File the annual data protection compliance audit return.", "Annual", "Not assessed"],
    [frc, "Whistleblowing", "Provide a protected whistleblowing channel and report to the Board.", "Ongoing", "Compliant"],
  ];
  const obligations = [];
  for (const [f, clause, req, freq, status] of oblSeeds) {
    const o = await R("obligation", `${clause}: ${req.slice(0, 70)}`, ngozi, { clause_ref: clause, requirement: req, frequency: freq, applicability: "All entities", compliance_status: status }, "active", compFn, zainab);
    await L(f, o, "contains");
    obligations.push(o);
  }
  await L(obligations[4], controls[6], "satisfied-by");
  await L(obligations[2], policies[0], "satisfied-by");
  await L(obligations[5], policies[4], "satisfied-by");

  const test1 = await R("control_test", "Q3 test of SIU red-flag referral rules", zainab, { test_type: "Independent test (second line)", test_date: d(-21), procedure: "Sample 40 motor claims with two or more red flags; confirm SIU referral before payment.", sample_size: 40, result: "Fail", evidence: "11 of 40 red-flag claims were paid without SIU referral." }, "completed", compFn, zainab);
  await L(test1, controls[4], "tests");
  const f1 = await R("finding", "Control failure: SIU referral rules bypassed on motor claims", funmi, { source: "Compliance test", rating: "High", criteria: "All red-flag claims referred to SIU before payment.", condition: "11 of 40 red-flag claims paid without referral.", cause: "Auto-pay threshold bypasses referral rules.", management_response: "Referral check to be added to auto-pay workflow." }, "response_agreed", claims, zainab);
  await L(test1, f1, "raised-by");
  await L(f1, controls[4], "concerns");
  const fa = await R("action", "Add SIU referral check to motor auto-pay workflow", funmi, { source: "Control test", description: "Block auto-payment where any red flag is present until SIU clears the claim.", priority: "High", due_date: d(-6), progress: 70, progress_note: "Rule configured in test; awaiting release." }, "in_progress", claims, zainab);
  await L(f1, fa, "remediates");
  const test2 = await R("control_test", "Q3 self-assessment of third-party payer KYC", ngozi, { test_type: "Control self-assessment", test_date: d(-30), result: "Pass", evidence: "25 of 25 third-party payments verified." }, "completed", compFn, ngozi);
  await L(test2, controls[6], "tests");
  await R("control_test", "Q4 test of offline backup restores", zainab, { test_type: "Independent test (second line)", procedure: "Restore core policy database from offline copy and check integrity.", test_date: d(14) }, "planned", it, zainab);

  const returns: [string, string, number, string][] = [
    ["Annual risk-based capital return 2026", "NAICOM", 170, "scheduled"],
    ["Quarterly returns Q3 2026", "NAICOM", 19, "in_preparation"],
    ["Quarterly AML/CFT returns Q3 2026", "NFIU", 4, "in_preparation"],
    ["Annual data protection compliance audit return", "NDPC", 170, "scheduled"],
    ["Audited financial statements 2025", "NAICOM", -140, "submitted"],
  ];
  for (const [title, regulator, due, status] of returns) {
    await R("reg_return", title, regulator === "NFIU" ? ngozi : bola, { regulator, due_date: d(due), frequency: title.includes("Quarterly") ? "Quarterly" : "Annual", preparer: zainab, reviewer: ngozi, submitted_date: status === "submitted" ? d(due - 5) : null, reference: status === "submitted" ? "NAICOM/FS/2025/0418" : null }, status, compFn, zainab);
  }
  const rc = await R("reg_change", "NAICOM circular on implementation of NIIRA 2025 risk-based capital", ngozi, { source: "NAICOM circular (confirm reference)", issued_date: "2025-08-12", effective_date: "2026-07-30", summary: "Implementation roadmap for minimum and risk-based capital under NIIRA 2025.", applicable: "Yes", impact: "Capital plan, RBC workbook and annual return process." }, "accepted", compFn, zainab);
  await L(rc, obligations[0], "amends");
  await R("product_approval", "Parametric flood cover for SME shops in Lagos", emeka, { product_line: "Property", change_type: "New product", description: "Index-triggered payout on rainfall gauge readings.", signoffs: "Underwriting and actuarial signed; legal pending." }, "internal_review", nonLife);
  for (const [uid, course, done] of [[funmi, "AML/CFT/CPF", true], [yusuf, "AML/CFT/CPF", false], [emeka, "Conflicts of interest", true], [segun, "Data protection", false]] as [number, string, boolean][]) {
    await R("training", `${course} training`, uid, { course, due_date: done ? d(-30) : d(-3), completion_date: done ? d(-40) : null, expiry_date: done ? d(325) : null, score: done ? 88 : null }, done ? "completed" : "assigned", null, zainab);
  }

  // Actions -------------------------------------------------------------------
  const actSeeds: [string, number, string, string, number, string, number][] = [
    ["Commission flood-zone accumulation model for Lagos portfolio", emeka, "Risk", "High", 25, "in_progress", 1],
    ["Re-tender reinsurance panel to reduce single-reinsurer concentration", bola, "Risk", "Critical", 45, "agreed", 2],
    ["Train a second actuary to sign off IFRS 17 models", amaka, "Risk", "Medium", 120, "proposed", 9],
    ["Restore-test offline backups for the policy system", segun, "Risk", "High", -15, "in_progress", 5],
    ["Bancassurance sales-script review with partner banks", ngozi, "Risk", "Low", 60, "closed", 8],
  ];
  for (const [title, owner, source, priority, due, status, riskIdx] of actSeeds) {
    const a = await R("action", title, owner, { source, description: title, priority, due_date: d(due), progress: status === "closed" ? 100 : status === "in_progress" ? 40 : 0, closure_evidence: status === "closed" ? "Revised scripts signed off by both banks." : null, validator: tunde }, status);
    await L(risks[riskIdx], a, "treats");
  }
  const mtg = await R("meeting", "Board Risk Management Committee, Q3 2026", kemi, { committee: "Board Risk Management Committee", meeting_date: d(-18), quorate: true, attendees: "Kemi Adebayo (Chair), two INEDs, CRO, CFO, CCO", minutes: "Committee reviewed Q3 risk profile; FX mismatch outside appetite.", decisions: "1. Management to present FX hedging options at next meeting." }, "held", group, kemi);
  const ma = await R("action", "Present FX hedging options to the Board Risk Committee", bola, { source: "Board decision", description: "Options paper on hedging or matching USD liabilities.", priority: "High", due_date: d(40) }, "agreed", finance, kemi);
  await L(mtg, ma, "decided");
  await L(ma, risks[3], "treats");
  await R("meeting", "Board Audit Committee, Q4 2026", kemi, { committee: "Board Audit Committee", meeting_date: d(30) }, "scheduled", group, kemi);

  // Declarations --------------------------------------------------------------
  await R("declaration", "Annual declaration 2026", funmi, { decl_type: "Annual conflict of interest declaration", nil_return: true, triage: "Nil return", review_outcome: "No conflict" }, "filed", claims, funmi);
  await R("declaration", "Annual declaration 2026", yusuf, { decl_type: "Annual conflict of interest declaration", nil_return: false, counterparty: "Rivers Auto Repairs Ltd", counterparty_type: "Supplier", relationship: "Brother-in-law is a director of an approved repair workshop used by the branch." }, "compliance_review", ph, yusuf);
  await R("declaration", "Hospitality from broker at industry dinner", emeka, { decl_type: "Gift or hospitality", gift_direction: "Received", gift_value: 120_000, counterparty: "Meridian Insurance Brokers", counterparty_type: "Broker", event_date: d(-9), relationship: "Dinner and hamper at year-end industry event." }, "compliance_review", nonLife, emeka);
  await R("declaration", "Non-executive directorship of a microfinance bank", bola, { decl_type: "Outside interest or directorship", nil_return: false, counterparty: "Harbour Microfinance Bank", counterparty_type: "Other", relationship: "Non-executive director since 2024." }, "completed", finance, bola);
  await R("declaration", "Annual declaration 2026", segun, { decl_type: "Annual conflict of interest declaration" }, "draft", it, segun);

  // Cases ---------------------------------------------------------------------
  const cs = async (title: string, owner: number, data: Record<string, unknown>, status: string, creator = owner) => R("case", title, owner, data, status, null, creator);
  const c1 = await cs("Motor claim repudiated without written reasons", funmi, { case_type: "Customer complaint", channel: "NAICOM referral", business_line: "Motor", reported_date: d(-9), description: "Policyholder says claim was declined by phone with no reasons; NAICOM referred complaint.", severity: "Medium", amount_at_risk: 4_200_000 }, "investigating", ngozi);
  void c1;
  const c2 = await cs("Ring of staged accidents linked to two repair workshops", chidi, { case_type: "Suspected claims fraud", channel: "Core system", business_line: "Motor", reported_date: d(-30), description: "Analytics linked 14 claims to the same two workshops and three claimants.", severity: "High", amount_at_risk: 62_000_000, amount_saved: 12_400_000, subjects: "Two repair workshops; three claimants", claim_ref: "MTR/CL/2026/0884" }, "investigating");
  await L(c2, risks[4], "evidences");
  const wb = await cs("Concern about refunds approved by a branch underwriter", chidi, { case_type: "Whistleblowing report", channel: "Anonymous portal", reported_date: d(-6), description: "Reporter alleges premium refunds paid to an account linked to staff.", severity: "High", reporter_key_hash: null }, "triaged", chidi);
  await db.insert(schema.comments).values({ recordId: wb.id, authorId: null, channel: "reporter", body: "I can share the refund dates if needed." });
  await cs("Policyholder data emailed to the wrong broker", ngozi, { case_type: "Data protection breach", channel: "Staff form", reported_date: d(-1), description: "Schedule of 230 group life members sent to an unrelated broker.", severity: "High" }, "triaged", zainab);
  await cs("Staff member slipped on wet stairs at Abuja branch", halima, { case_type: "HSE incident", channel: "Staff form", reported_date: d(-12), description: "Wet floor, no warning sign; sprained ankle.", severity: "Low", lost_time_days: 3, root_cause: "Process", findings: "Cleaning schedule overlapped with opening hours.", outcome: "Substantiated", lessons: "Clean before opening; signage." }, "closed", yusuf);
  await cs("Early surrender of single-premium policy funded by third party", ngozi, { case_type: "AML/CFT suspicious activity", channel: "Core system", business_line: "Individual life", reported_date: d(-2), description: "NGN 45m single premium paid by an unrelated company; surrender requested after 3 weeks.", severity: "High", amount_at_risk: 45_000_000 }, "reported", zainab);
  await cs("Premium receipts misallocated during system upgrade", bola, { case_type: "Operational incident", channel: "Staff form", reported_date: d(-40), description: "Receipts posted to wrong policies for 4 days.", severity: "Medium", root_cause: "Systems", findings: "Migration script mapped bank references incorrectly.", outcome: "Substantiated", amount_written_off: 0 }, "closed", segun);

  // ESG / EHS -----------------------------------------------------------------
  const diesel = await R("esg_metric", "Diesel consumed by generators and fleet", halima, { pillar: "Environmental", unit: "litres", scope: "Scope 1", emission_factor: 2.68, frameworks: ["IFRS S2", "GRI", "NGX sustainability disclosure"], target: 180000, target_year: 2027, method: "Fuel purchase records for all sites." }, "active", hr, halima);
  await seedReading(db, diesel.id, [{ date: "2026-03-31", value: 61200 }, { date: "2026-06-30", value: 58900 }, { date: "2026-09-30", value: 55400 }]);
  const grid = await R("esg_metric", "Grid electricity purchased", halima, { pillar: "Environmental", unit: "kWh", scope: "Scope 2", emission_factor: 0.43, frameworks: ["IFRS S2", "GRI"], method: "Utility bills, all sites." }, "active", hr, halima);
  await seedReading(db, grid.id, [{ date: "2026-03-31", value: 212000 }, { date: "2026-06-30", value: 224500 }, { date: "2026-09-30", value: 219800 }]);
  const women = await R("esg_metric", "Women in senior management", halima, { pillar: "Social", unit: "%", scope: "Not an emissions metric", frameworks: ["GRI", "NGX sustainability disclosure"], target: 40, target_year: 2028 }, "active", hr, halima);
  await seedReading(db, women.id, [{ date: "2025-12-31", value: 31 }, { date: "2026-06-30", value: 33 }]);
  await R("hse_inspection", "Generator room inspection, Lagos HQ", halima, { site: "Lagos HQ", inspection_type: "Generator room", inspection_date: d(-25), score: 72, findings: "Fuel spill tray cracked; extinguisher out of date." }, "completed", hr, halima);
  await R("hse_inspection", "Fire safety inspection, Port Harcourt branch", halima, { site: "Port Harcourt branch", inspection_type: "Fire safety", inspection_date: d(9) }, "scheduled", hr, halima);
  await R("permit", "Fire certificate, Lagos HQ", halima, { permit_type: "Fire certificate", site: "Lagos HQ", issuer: "Lagos State Fire Service", expiry_date: d(21) }, "valid", hr, halima);
  await R("permit", "Generator emission permit, Abuja branch", halima, { permit_type: "Generator emission permit", site: "Abuja branch", issuer: "State environmental agency", expiry_date: d(-4) }, "valid", hr, halima);
  await R("uw_screen", "Onshore gas gathering facility, Delta State", emeka, { client: "Delta Gas Gathering Ltd", sector: "Oil and gas", red_flags: ["Gas flaring", "Community conflict"], decision: "Proceed with conditions", conditions: "Flare-reduction plan and community engagement evidence before renewal." }, "decided", nonLife, emeka);

  // Third parties --------------------------------------------------------------
  const tp = async (title: string, owner: number, data: Record<string, unknown>, status = "approved") => R("third_party", title, owner, data, status, null, tunde);
  const re1 = await tp("Atlantic Re (Lagos)", bola, { tp_type: "Reinsurer", critical_service: "Yes", data_access: "Limited", substitutability: "Hard", regulatory_significance: true, annual_value: 4_800_000_000, rating_agency: "AM Best", rating: "B+", rating_date: d(-50), licence_number: "NAICOM/RE/0012", licence_expiry: d(200), last_assessment: d(-300), key_clauses: ["Audit rights", "Termination and exit"] });
  await L(re1, risks[2], "concentration");
  await tp("Northgate Re (London)", bola, { tp_type: "Reinsurer", critical_service: "Yes", data_access: "Limited", substitutability: "Moderate", annual_value: 2_100_000_000, rating_agency: "S&P", rating: "A", rating_date: d(-120), last_assessment: d(-90) });
  await tp("Meridian Insurance Brokers", emeka, { tp_type: "Broker", critical_service: "No", data_access: "Extensive", substitutability: "Easy", annual_value: 1_300_000_000, licence_number: "NAICOM/BR/0456", licence_expiry: d(18), last_assessment: d(-400) });
  const hmo = await tp("CareFirst HMO", funmi, { tp_type: "TPA / HMO", critical_service: "Yes", data_access: "Extensive", substitutability: "Moderate", regulatory_significance: true, annual_value: 950_000_000, last_assessment: d(-200), exit_plan: "Transfer members to alternative HMO within 60 days.", key_clauses: ["Audit rights", "Data protection", "SLA and service credits"] });
  await L(hmo, risks[11], "source-of");
  await tp("CloudCore Data Centre Services", segun, { tp_type: "IT or cloud provider", critical_service: "Yes", data_access: "Extensive", substitutability: "Hard", regulatory_significance: true, annual_value: 210_000_000, security_ref: "SecureComply vendor assessment SC-VA-0193", last_assessment: d(-30) });
  await tp("Rivers Auto Repairs Ltd", funmi, { tp_type: "Repair workshop", critical_service: "No", data_access: "None", substitutability: "Easy" }, "suspended");
  const tpa1 = await R("tp_assessment", "Periodic assessment: CareFirst HMO", tunde, { assessment_type: "Periodic", assessment_date: d(-3), financial: "Adequate", conduct: "Adequate", operational: "Weak", screening: "Clear", overall: "Needs improvement", notes: "Claims turnaround 19 days against a 10-day SLA." }, "review", null, zainab);
  await L(tpa1, hmo, "assesses");

  // Internal audit ---------------------------------------------------------------
  const ae = async (title: string, entity_type: string, inherent_risk: string, last_audit: string | null, regulatory_focus = false) =>
    R("audit_entity", title, ibrahim, { entity_type, inherent_risk, last_audit, regulatory_focus }, "active", auditFn, ibrahim);
  const aeClaims = await ae("Motor and health claims", "Process", "Critical", d(-700), true);
  await ae("Reinsurance placement and recoveries", "Process", "High", d(-420), true);
  await ae("Underwriting, non-life", "Business line", "High", d(-300));
  await ae("AML/CFT compliance", "Function", "High", d(-380), true);
  await ae("IT general controls (with SecureComply evidence)", "Function", "High", d(-200));
  await ae("Port Harcourt branch", "Branch", "Medium", null);
  const eng1 = await R("engagement", "Claims management and SIU referral audit", ibrahim, { plan_year: 2026, quarter: "Q4", scope: "Motor and health claims, auto-pay, SIU referral.", objectives: "Assess design and operation of claims controls.", budget_hours: 320, actual_hours: 140, report_date: d(35), independence_confirmed: true }, "fieldwork", auditFn, ibrahim);
  await L(aeClaims, eng1, "audited-by");
  await R("engagement", "Reinsurance recoveries audit", ibrahim, { plan_year: 2027, quarter: "Q1", budget_hours: 240, report_date: d(130) }, "planned", auditFn, ibrahim);
  const eng3 = await R("engagement", "Premium receipting and broker remittance audit", ibrahim, { plan_year: 2026, quarter: "Q2", budget_hours: 200, actual_hours: 214, report_date: d(-90), independence_confirmed: true, overall_rating: "Needs improvement" }, "final_report", auditFn, ibrahim);
  const af = await R("finding", "Broker premium ageing not reviewed monthly", bola, { source: "Internal audit", rating: "Medium", criteria: "Monthly ageing review with escalation over 30 days.", condition: "No evidence of review for 4 of 6 months.", cause: "Ownership unclear after reorganisation.", management_response: "Credit control to own monthly review." }, "response_agreed", finance, ibrahim);
  await L(eng3, af, "raised");
  const afa = await R("action", "Assign ownership and evidence monthly broker ageing review", bola, { source: "Internal audit finding", description: "Credit controller to evidence review monthly.", priority: "Medium", due_date: d(-20), progress: 50 }, "in_progress", finance, ibrahim);
  await L(af, afa, "remediates");
  await L(afa, risks[12], "treats");

  // Business continuity ---------------------------------------------------------
  const svc = async (title: string, tolerance_hours: number, owner: number, tolerance_status: string, last_exercise: string | null) =>
    R("business_service", title, owner, { tolerance_hours, tolerance_status, last_exercise, description: title }, "active", null, adaeze);
  const sClaims = await svc("Claims notification and payment", 48, funmi, "Within tolerance", d(-60));
  const sIssue = await svc("Policy issuance and renewal", 24, emeka, "Outside tolerance", d(-45));
  await svc("Premium collection and receipting", 72, bola, "Not tested", null);
  await svc("Customer and broker contact centre", 8, funmi, "Within tolerance", d(-100));
  await svc("Reinsurance placement and recoveries", 120, bola, "Not tested", null);
  await R("bia", "BIA: Policy issuance", emeka, { process: "Policy issuance and renewal", mtpd_hours: 24, rto_hours: 12, rpo_hours: 4, min_staff: 6, systems: "Core policy administration system; document generation", third_parties: "CloudCore Data Centre Services", financial_impact: "High", regulatory_impact: "Medium" }, "approved");
  await R("bia", "BIA: Claims payment", funmi, { process: "Claims notification and payment", mtpd_hours: 48, rto_hours: 24, rpo_hours: 4, min_staff: 8, financial_impact: "Medium", regulatory_impact: "High" }, "approved");
  await R("bc_plan", "Continuity plan: Lagos HQ", segun, { scope: "Lagos HQ and core systems", version: "3.1", call_tree: "CIO > IT duty manager > department heads", recovery_steps: "Invoke DR site; restore from offline backups; switch call routing.", next_review: d(55) }, "approved");
  const ex1 = await R("bc_exercise", "DR test: core policy system failover", segun, { exercise_type: "DR test", scenario: "Core system loss", exercise_date: d(-45), recovery_hours: 31, met_tolerance: "No", lessons: "Failover runbook out of date; backup restore slower than planned." }, "completed");
  await L(ex1, sIssue, "exercises");
  await L(ex1, risks[13], "raised");
  const ex2 = await R("bc_exercise", "Tabletop: ransomware on claims platform", funmi, { exercise_type: "Tabletop", scenario: "Cyber incident", exercise_date: d(-60), recovery_hours: 30, met_tolerance: "Yes", lessons: "Manual claims payment fallback works for 48 hours." }, "completed");
  await L(ex2, sClaims, "exercises");

  // Notifications so the demo has something in each inbox
  await db.insert(schema.notifications).values([
    { userId: adaeze, recordId: risks[3].id, message: `${risks[3].ref} is outside appetite. Breach action opened.` },
    { userId: ngozi, recordId: null, message: "Two declarations are waiting for Compliance review." },
    { userId: funmi, recordId: fa.id, message: `${fa.ref} is overdue.` },
  ]);
  void kemi;
  void abuja;
}
