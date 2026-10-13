import { describe, it, expect } from "vitest";
import {
  score, rating, appetiteStatus, reviewDays, kriStatus, thirdPartyTier, caseClock,
  declarationTriage, auditPriority, checkTransition, coerceFields, fieldVisible,
} from "../lib/engine/pure";
import { DEFAULT_TYPES } from "../lib/defs/modules";

const def = (k: string) => DEFAULT_TYPES.find((t) => t.key === k)!;

describe("risk scoring", () => {
  it("multiplies likelihood and impact on a 5x5 matrix", () => {
    expect(score(4, 5)).toBe(20);
    expect(score("3", "4")).toBe(12);
    expect(score(0, 5)).toBeNull();
    expect(score(6, 1)).toBeNull();
    expect(score(null, 3)).toBeNull();
  });
  it("bands scores into ratings", () => {
    expect(rating(4)).toBe("Low");
    expect(rating(5)).toBe("Medium");
    expect(rating(10)).toBe("High");
    expect(rating(15)).toBe("Critical");
  });
  it("tests residual against appetite (PRD acceptance test: 16 vs 12 is outside)", () => {
    expect(appetiteStatus(16, 12)).toBe("Outside appetite");
    expect(appetiteStatus(12, 12)).toBe("Approaching appetite");
    expect(appetiteStatus(10, 12)).toBe("Approaching appetite");
    expect(appetiteStatus(9, 12)).toBe("Within appetite");
    expect(appetiteStatus(9, null)).toBe("No appetite set");
  });
  it("sets review cadence by rating", () => {
    expect(reviewDays("Critical")).toBe(30);
    expect(reviewDays("Medium")).toBe(90);
    expect(reviewDays("Low")).toBe(365);
  });
});

describe("KRIs", () => {
  it("handles higher-is-worse and lower-is-worse", () => {
    expect(kriStatus(80, 65, 75, "Higher is worse")).toBe("Red");
    expect(kriStatus(70, 65, 75, "Higher is worse")).toBe("Amber");
    expect(kriStatus(60, 65, 75, "Higher is worse")).toBe("Green");
    expect(kriStatus(149, 160, 130, "Lower is worse")).toBe("Amber");
    expect(kriStatus(120, 160, 130, "Lower is worse")).toBe("Red");
    expect(kriStatus(null, 1, 2, undefined)).toBe("No data");
  });
});

describe("third-party tiering", () => {
  it("puts critical reinsurers in tier 1", () => {
    expect(thirdPartyTier({ tp_type: "Reinsurer", critical_service: "Yes", data_access: "Limited", substitutability: "Hard" }).tier).toBe("Tier 1");
    expect(thirdPartyTier({ tp_type: "Repair workshop", critical_service: "No", data_access: "None", substitutability: "Easy" }).tier).toBe("Tier 3");
  });
});

describe("cases and declarations", () => {
  it("sets the NDPA 72-hour clock for data breaches", () => {
    expect(caseClock("Data protection breach", "2026-10-12")).toBe("2026-10-15");
    expect(caseClock("Unknown", "2026-10-12")).toBeNull();
  });
  it("routes declarations", () => {
    expect(declarationTriage({ decl_type: "Annual conflict of interest declaration", nil_return: true })).toBe("Nil return");
    expect(declarationTriage({ decl_type: "Ad hoc conflict of interest", counterparty_type: "Broker" })).toBe("Compliance review");
    expect(declarationTriage({ decl_type: "Gift or hospitality", gift_value: 120000, counterparty_type: "Other" })).toBe("Compliance review");
    expect(declarationTriage({ decl_type: "Gift or hospitality", gift_value: 10000, counterparty_type: "Other" })).toBe("Manager review");
  });
  it("prioritises audit entities never audited with regulatory focus", () => {
    expect(auditPriority("Critical", null, true, "2026-10-12")).toBe(13);
    expect(auditPriority("Low", "2026-01-01", false, "2026-10-12")).toBe(2);
  });
});

describe("workflow rules", () => {
  const risk = def("risk");
  const approve = risk.workflow.transitions.find((t) => t.key === "approve")!;
  const submit = risk.workflow.transitions.find((t) => t.key === "submit")!;
  const rec = { status: "submitted", ownerId: 5, createdBy: 5, data: {} };
  it("enforces four-eyes: the raiser cannot approve", () => {
    expect(checkTransition(risk, { ...rec, ownerId: 9 }, approve, { id: 5, roles: ["risk"] })).toMatch(/Four-eyes/);
  });
  it("blocks the owner from approving their own risk even with the role", () => {
    expect(checkTransition(risk, { ...rec, createdBy: 1 }, approve, { id: 5, roles: ["cro"] })).toMatch(/owner cannot/);
  });
  it("requires the right role", () => {
    expect(checkTransition(risk, { ...rec, ownerId: 2, createdBy: 3 }, approve, { id: 7, roles: ["staff"] })).toMatch(/Only these roles/);
    expect(checkTransition(risk, { ...rec, ownerId: 2, createdBy: 3 }, approve, { id: 7, roles: ["risk"] })).toBeNull();
  });
  it("requires fields before submitting", () => {
    const err = checkTransition(risk, { status: "draft", ownerId: 5, createdBy: 5, data: { description: "x" } }, submit, { id: 5, roles: ["staff"] });
    expect(err).toMatch(/Fill in "Category"/);
  });
  it("requires a comment where configured", () => {
    const ret = risk.workflow.transitions.find((t) => t.key === "return")!;
    expect(checkTransition(risk, { ...rec, ownerId: 2, createdBy: 3 }, ret, { id: 7, roles: ["risk"] })).toMatch(/comment/);
  });
});

describe("form handling", () => {
  it("coerces and validates field values", () => {
    const { data, errors } = coerceFields(def("risk").fields, { residual_likelihood: "3", category: "Market risk", principal: "on", expected_loss: "1,000,000" });
    expect(data.residual_likelihood).toBe(3);
    expect(data.principal).toBe(true);
    expect(data.expected_loss).toBe(1000000);
    expect(errors).toEqual([]);
    expect(coerceFields(def("risk").fields, { category: "Nonsense" }).errors.length).toBe(1);
    expect(coerceFields(def("risk").fields, { residual_likelihood: "9" }).errors.length).toBe(1);
  });
  it("evaluates conditional fields", () => {
    const f = def("declaration").fields.find((x) => x.key === "gift_value")!;
    expect(fieldVisible(f, { decl_type: "Gift or hospitality" })).toBe(true);
    expect(fieldVisible(f, { decl_type: "Ad hoc conflict of interest" })).toBe(false);
  });
});

describe("definitions", () => {
  it("every transition targets a defined state and has unique keys", () => {
    for (const t of DEFAULT_TYPES) {
      const states = new Set(t.workflow.states.map((s) => s.key));
      expect(states.has(t.workflow.initial), `${t.key} initial`).toBe(true);
      const keys = new Set<string>();
      for (const tr of t.workflow.transitions) {
        expect(states.has(tr.to), `${t.key}.${tr.key} -> ${tr.to}`).toBe(true);
        tr.from.forEach((f) => expect(states.has(f), `${t.key}.${tr.key} from ${f}`).toBe(true));
        for (const r of tr.requires ?? []) expect(t.fields.some((f) => f.key === r), `${t.key}.${tr.key} requires ${r}`).toBe(true);
        expect(keys.has(tr.key)).toBe(false);
        keys.add(tr.key);
      }
    }
  });
  it("prefixes are unique", () => {
    const p = DEFAULT_TYPES.map((t) => t.prefix);
    expect(new Set(p).size).toBe(p.length);
  });
});

describe("midSentence", () => {
  it("lower-cases words but keeps acronyms", async () => {
    const { midSentence } = await import("../lib/format");
    expect(midSentence("ORSA")).toBe("ORSA");
    expect(midSentence("Risk Management Declaration")).toBe("risk management declaration");
    expect(midSentence("ESG metric")).toBe("ESG metric");
    expect(midSentence("KRIs")).toBe("KRIs");
  });
});
