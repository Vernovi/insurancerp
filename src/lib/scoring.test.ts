import { describe, expect, it } from "vitest";
import {
  appetitePosition,
  compliancePercent,
  isOverdue,
  kpiScore,
  kriRag,
  riskScore,
  scoreBand,
  topRisks,
} from "./scoring";

describe("risk scoring", () => {
  it("multiplies a 5 by 5 likelihood and impact", () => {
    expect(riskScore(1, 1)).toBe(1);
    expect(riskScore(5, 5)).toBe(25);
    expect(riskScore(4, 4)).toBe(16);
    expect(scoreBand(4)).toBe("LOW");
    expect(scoreBand(9)).toBe("MEDIUM");
    expect(scoreBand(15)).toBe("HIGH");
    expect(scoreBand(16)).toBe("SEVERE");
  });

  it("flags a residual score above the category limit", () => {
    expect(appetitePosition(16, 12)).toBe("ABOVE");
    expect(appetitePosition(12, 12)).toBe("APPROACHING");
    expect(appetitePosition(10, 12)).toBe("APPROACHING");
    expect(appetitePosition(8, 12)).toBe("WITHIN");
  });

  it("colours KRIs from the threshold direction", () => {
    expect(kriRag(81, 65, 75, "LOWER_IS_BETTER")).toBe("RED");
    expect(kriRag(70, 65, 75, "LOWER_IS_BETTER")).toBe("AMBER");
    expect(kriRag(60, 65, 75, "LOWER_IS_BETTER")).toBe("GREEN");
    expect(kriRag(164, 150, 120, "HIGHER_IS_BETTER")).toBe("GREEN");
    expect(kriRag(130, 150, 120, "HIGHER_IS_BETTER")).toBe("AMBER");
    expect(kriRag(90, 150, 120, "HIGHER_IS_BETTER")).toBe("RED");
  });

  it("caps KPI scores at 100", () => {
    expect(kpiScore(68, 68, "LOWER_IS_BETTER")).toBe(100);
    expect(kpiScore(136, 68, "LOWER_IS_BETTER")).toBe(50);
    expect(kpiScore(90, 90, "HIGHER_IS_BETTER")).toBe(100);
    expect(kpiScore(45, 90, "HIGHER_IS_BETTER")).toBe(50);
  });

  it("averages assessed compliance and ignores items not assessed", () => {
    expect(compliancePercent(["COMPLIANT", "PARTIAL", "NON_COMPLIANT", "NOT_ASSESSED"])).toEqual({
      percent: 50,
      assessed: 3,
      total: 4,
    });
    expect(compliancePercent(["NOT_ASSESSED"]).percent).toBeNull();
  });

  it("treats a due date before today as overdue until the action is closed", () => {
    const today = new Date(2026, 9, 12, 15, 0, 0);
    expect(isOverdue(new Date(2026, 9, 5, 0, 0, 0), "OPEN", today)).toBe(true);
    expect(isOverdue(new Date(2026, 9, 12, 0, 0, 0), "OPEN", today)).toBe(false);
    expect(isOverdue(new Date(2026, 8, 1, 0, 0, 0), "COMPLETED", today)).toBe(false);
  });

  it("ranks the top residual scores", () => {
    const ranked = topRisks(
      [
        { code: "B", residualScore: 9, inherentScore: 12 },
        { code: "A", residualScore: 16, inherentScore: 20 },
        { code: "C", residualScore: 16, inherentScore: 25 },
      ],
      2,
    );
    expect(ranked.map((risk) => risk.code)).toEqual(["C", "A"]);
  });
});
