import { describe, expect, it } from "vitest";
import { risks } from "./catalogue";
import { LINES_OF_BUSINESS, RISK_CATEGORIES } from "@/lib/domain";
import { naicomCitation, naicomRequirements } from "./naicom";
import { ndpaRequirements } from "./other-frameworks";

describe("trial content", () => {
  it("loads a multi-line book of at least 40 risks and never names IEI", () => {
    expect(risks.length).toBeGreaterThanOrEqual(40);
    const lines = new Set(risks.map((risk) => risk.line));
    for (const line of ["Motor", "Property", "Marine", "Energy", "Health", "Life"]) {
      expect(lines.has(line)).toBe(true);
    }
    for (const risk of risks) {
      expect(RISK_CATEGORIES).toContain(risk.category);
      expect(LINES_OF_BUSINESS).toContain(risk.line);
    }
    const blob = JSON.stringify({ risks, naicomRequirements, ndpaRequirements }).toLowerCase();
    expect(blob).not.toContain("international energy insurance");
    expect(blob).not.toMatch(/\biei\b/);
  });

  it("cites every NAICOM element to the published guideline", () => {
    expect(naicomRequirements.length).toBeGreaterThan(20);
    for (const requirement of naicomRequirements) {
      expect(requirement.code).toMatch(/^6\./);
      expect(requirement.text.length).toBeGreaterThan(40);
      const citation = naicomCitation(requirement.code);
      expect(citation).toContain("Revised Prudential Guidelines");
      expect(citation).toContain("naicom.gov.ng");
      expect(requirement.text.toLowerCase()).not.toContain("lorem");
      expect(requirement.text).not.toContain("TODO");
    }
  });
});
