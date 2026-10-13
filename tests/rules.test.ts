import { describe, it, expect } from "vitest";
import { base32Encode, hotp, totp, verifyTotp, stepAt, mfaMandatory, newSecret, base32Decode } from "../lib/auth/totp";
import { capitalCover, claimsAgeing, caseClock, checkTransition, lossFigures, lossBand, nextDue, filingStatus, reminderPlan, orsaDue, fcrPublishDue, NON_LIFE_MCR_NGN } from "../lib/engine/pure";
import { canView, canUseEntity, deniedEntities, entityAllowed } from "../lib/engine/permissions";
import { rollPeriod, pickAppetite } from "../lib/engine/hooks";
import { DEFAULT_TYPES } from "../lib/defs/modules";

const def = (k: string) => DEFAULT_TYPES.find((t) => t.key === k)!;
const tr = (k: string, key: string) => def(k).workflow.transitions.find((t) => t.key === key)!;

describe("TOTP (RFC 6238)", () => {
  const rfcSecret = base32Encode(Buffer.from("12345678901234567890"));
  it("matches the RFC 6238 SHA-1 test vectors", () => {
    expect(totp(rfcSecret, 59_000, 8)).toBe("94287082");
    expect(totp(rfcSecret, 1_111_111_109_000, 8)).toBe("07081804");
    expect(totp(rfcSecret, 1_234_567_890_000, 8)).toBe("89005924");
    expect(totp(rfcSecret, 20_000_000_000_000, 8)).toBe("65353130");
    expect(hotp(Buffer.from("12345678901234567890"), 0)).toBe("755224"); // RFC 4226
  });
  it("round-trips base32 secrets", () => {
    const s = newSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });
  it("accepts the current code and one step of drift, and nothing else", () => {
    const s = newSecret();
    const now = 1_790_000_000_000;
    expect(verifyTotp(s, totp(s, now), now)).toBe(stepAt(now));
    expect(verifyTotp(s, totp(s, now - 30_000), now)).toBe(stepAt(now) - 1);
    expect(verifyTotp(s, totp(s, now - 90_000), now)).toBeNull();
    expect(verifyTotp(s, "000000", now) === null || totp(s, now) === "000000").toBe(true);
    expect(verifyTotp(s, "12345", now)).toBeNull();
    expect(verifyTotp(s, "abcdef", now)).toBeNull();
  });
  it("refuses a replayed code", () => {
    const s = newSecret();
    const now = 1_790_000_000_000;
    const step = verifyTotp(s, totp(s, now), now)!;
    expect(verifyTotp(s, totp(s, now), now, step)).toBeNull();
  });
  it("makes MFA mandatory for administrators and for anyone an admin requires it of", () => {
    expect(mfaMandatory({ roles: ["admin"], mfaRequired: false })).toBe(true);
    expect(mfaMandatory({ roles: ["risk"], mfaRequired: true })).toBe(true);
    expect(mfaMandatory({ roles: ["risk"], mfaRequired: false })).toBe(false);
  });
});

describe("entity walls", () => {
  const walled = [3, 7];
  it("denies walled entities a person isn't a member of", () => {
    expect(deniedEntities(walled, [3])).toEqual([7]);
    expect(deniedEntities(walled, [])).toEqual([3, 7]);
    expect(deniedEntities(walled, [3, 7, 1])).toEqual([]);
  });
  it("hides walled records, except from their owner and creator", () => {
    const u = { id: 10, roles: ["cro" as const], deniedEntities: [7] };
    const rec = (entityId: number | null, ownerId: number | null = 1) => ({ ownerId, createdBy: 2, confidential: false, entityId });
    expect(canView(u, def("risk"), rec(7))).toBe(false);
    expect(canView(u, def("risk"), rec(3))).toBe(true);
    expect(canView(u, def("risk"), rec(null))).toBe(true);
    expect(canView(u, def("risk"), rec(7, 10))).toBe(true);
    expect(entityAllowed({ id: 1, roles: ["admin"], deniedEntities: [7] }, rec(7, 5))).toBe(false); // admin gets no bypass
    expect(canUseEntity(u, 7)).toBe(false);
    expect(canUseEntity(u, null)).toBe(true);
  });
  it("applies the confidentiality wall inside a visible entity", () => {
    const inv = { id: 5, roles: ["investigator" as const], deniedEntities: [] };
    const cro = { id: 6, roles: ["cro" as const], deniedEntities: [] };
    const wb = { ownerId: 1, createdBy: 1, confidential: true, entityId: 3 };
    expect(canView(inv, def("case"), wb)).toBe(true);
    expect(canView(cro, def("case"), wb)).toBe(false);
  });
  it("prefers an entity's own appetite over the group appetite", () => {
    const apps = [{ entityId: 1, t: "group" }, { entityId: 4, t: "entity" }];
    expect(pickAppetite(apps, 4, (a) => a.entityId === 1)?.t).toBe("entity");
    expect(pickAppetite(apps, 5, (a) => a.entityId === 1)?.t).toBe("group");
    expect(pickAppetite([{ entityId: 9 }], 5, () => false)).toBeNull();
  });
});

describe("capital, claims and losses", () => {
  it("rates capital against the NGN 15bn non-life minimum", () => {
    expect(capitalCover(33.1e9, NON_LIFE_MCR_NGN)).toEqual({ ratio: 220.7, status: "Green" });
    expect(capitalCover(16.4e9, NON_LIFE_MCR_NGN)).toEqual({ ratio: 109.3, status: "Amber" });
    expect(capitalCover(18e9, NON_LIFE_MCR_NGN).status).toBe("Green"); // exactly 120% is outside a 20% buffer
    expect(capitalCover(14.99e9, NON_LIFE_MCR_NGN).status).toBe("Red");
    expect(capitalCover(null, NON_LIFE_MCR_NGN).status).toBe("No data");
    expect(capitalCover(16e9, NON_LIFE_MCR_NGN, 0).status).toBe("Green");
  });
  it("puts a 60-day clock on claims and claims complaints (NIIRA 2025 s.210)", () => {
    expect(caseClock("Claim awaiting settlement or decision", "2026-01-01")).toBe("2026-03-02");
    expect(caseClock("Customer complaint", "2026-10-01")).toBe("2026-11-30");
  });
  it("counts open claims past the 60-day clock", () => {
    const c = (reportedDate: string, open = true, caseType = "Claim awaiting settlement or decision") => ({ caseType, reportedDate, open });
    expect(claimsAgeing([c("2026-01-01"), c("2026-09-01"), c("2026-01-01", false), c("2026-01-01", true, "Customer complaint")], "2026-10-13")).toEqual({ open: 2, late: 1, pct: 50 });
    expect(claimsAgeing([], "2026-10-13")).toEqual({ open: 0, late: 0, pct: 0 });
  });
  it("converts losses to naira and bands them", () => {
    expect(lossFigures({ currency: "USD", fx_rate: 1500, gross_loss: 10_000, recoveries: 1000, insurance_recoveries: 1000 })).toEqual({ net: 8000, netNgn: 12_000_000, grossNgn: 15_000_000 });
    expect(lossFigures({ currency: "USD", gross_loss: 10 }).netNgn).toBeNull();
    expect(lossFigures({ gross_loss: 5, near_miss: true }).net).toBe(0);
    expect(lossBand(500_000)).toBe("Below threshold");
    expect(lossBand(1_000_000)).toBe("Reportable");
    expect(lossBand(50_000_000)).toBe("Board-reportable");
    expect(lossBand(0, true)).toBe("Near miss");
    expect(lossBand(null)).toBe("Enter the exchange rate");
  });
});

describe("returns calendar", () => {
  it("rolls recurring due dates and period labels", () => {
    expect(nextDue("2026-10-30", "Quarterly")).toBe("2027-01-30");
    expect(nextDue("2026-03-31", "Annual")).toBe("2027-03-31");
    expect(nextDue("2026-10-30", "Semi-annual")).toBe("2027-04-30");
    expect(nextDue("2026-10-30", "One-off")).toBeNull();
    expect(rollPeriod("Q4 2026", "Quarterly")).toBe("Q1 2027");
    expect(rollPeriod("Q2 2026", "Quarterly")).toBe("Q3 2026");
    expect(rollPeriod("FY2026", "Annual")).toBe("FY2027");
    expect(rollPeriod("Dec 2026", "Monthly")).toBe("Jan 2027");
    expect(rollPeriod("whatever", "Quarterly")).toBeNull();
  });
  it("classifies filing status", () => {
    expect(filingStatus("2026-10-10", null, "2026-10-13")).toBe("Overdue");
    expect(filingStatus("2026-10-20", null, "2026-10-13")).toBe("Due soon");
    expect(filingStatus("2026-12-20", null, "2026-10-13")).toBe("Scheduled");
    expect(filingStatus("2026-10-10", "2026-10-09")).toBe("Filed on time");
    expect(filingStatus("2026-10-10", "2026-10-11")).toBe("Filed late");
    expect(filingStatus(null, null)).toBeNull();
  });
  it("reminds before the due date and escalates daily in the first overdue week", () => {
    const base = { label: "Regulatory return", ref: "RET-0001", due: "2026-10-30", isReturn: true, leadDays: 14 };
    expect(reminderPlan(base, "2026-10-16").map((r) => r.to)).toEqual(["owner"]);
    expect(reminderPlan(base, "2026-10-23")[0].message).toMatch(/due in 7 days/);
    expect(reminderPlan(base, "2026-10-29")[0].message).toMatch(/due in 1 day/);
    expect(reminderPlan(base, "2026-10-20")).toEqual([]);
    expect(reminderPlan(base, "2026-10-30")[0].message).toMatch(/due today/);
    const late1 = reminderPlan(base, "2026-10-31");
    expect(late1.map((r) => r.to)).toEqual(["owner", "escalation"]);
    expect(reminderPlan(base, "2026-11-04").length).toBe(2);
    expect(reminderPlan(base, "2026-11-08")).toEqual([]); // day 9: weekly after the first week
    expect(reminderPlan(base, "2026-11-13").length).toBe(2); // day 14
  });
  it("keeps the old pattern for other records, with manager escalation from a week overdue", () => {
    const a = { label: "Action", ref: "ACT-1", due: "2026-10-01", isReturn: false };
    expect(reminderPlan(a, "2026-09-24")[0].message).toMatch(/in 7 days/);
    expect(reminderPlan(a, "2026-10-02").map((r) => r.to)).toEqual(["owner"]);
    expect(reminderPlan(a, "2026-10-08").map((r) => r.to)).toEqual(["owner", "manager"]);
    expect(reminderPlan(a, "2026-10-05")).toEqual([]);
  });
  it("sets ORSA and FCR deadlines", () => {
    expect(orsaDue("2026-12-31")).toBe("2027-03-01");
    expect(orsaDue("2025-12-31")).toBe("2026-03-01");
    expect(orsaDue(null)).toBeNull();
    expect(fcrPublishDue("2026-04-10")).toBe("2026-04-24");
  });
});

describe("Risk Management Declaration: two different directors", () => {
  const rmd = def("rm_declaration");
  const director = (id: number) => ({ id, roles: ["board" as const] });
  const rec = (status: string, data: Record<string, unknown> = { statement: "x" }) => ({ status, ownerId: 50, createdBy: 50, data });
  it("only directors sign; admins and the owner can't", () => {
    expect(checkTransition(rmd, rec("draft"), tr("rm_declaration", "sign1"), director(1))).toBeNull();
    expect(checkTransition(rmd, rec("draft"), tr("rm_declaration", "sign1"), { id: 2, roles: ["admin"] })).toMatch(/Only these roles/);
    expect(checkTransition(rmd, rec("draft"), tr("rm_declaration", "sign1"), { id: 50, roles: ["compliance"] })).toMatch(/Only these roles/);
  });
  it("the second signature must come from a different director", () => {
    const signed = rec("first_signed", { statement: "x", director_1_by: 1 });
    expect(checkTransition(rmd, signed, tr("rm_declaration", "sign2"), director(1))).toMatch(/different person/);
    expect(checkTransition(rmd, signed, tr("rm_declaration", "sign2"), director(2))).toBeNull();
  });
  it("needs the declaration text before the first signature", () => {
    expect(checkTransition(rmd, rec("draft", {}), tr("rm_declaration", "sign1"), director(1))).toMatch(/Declaration/);
  });
  it("ORSA approval is for the board, not management or admins", () => {
    const orsa = def("orsa");
    const r = { status: "board_review", ownerId: 9, createdBy: 8, data: { board_approval_date: "2027-02-20" } };
    expect(checkTransition(orsa, r, tr("orsa", "approve"), director(1))).toBeNull();
    expect(checkTransition(orsa, r, tr("orsa", "approve"), { id: 9, roles: ["cro"] })).toMatch(/Only these roles/);
    expect(checkTransition(orsa, r, tr("orsa", "approve"), { id: 3, roles: ["admin"] })).toMatch(/Only these roles/);
  });
});
