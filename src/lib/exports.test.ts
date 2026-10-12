import { describe, expect, it } from "vitest";
import type { BoardPack } from "@/server/board";
import { buildBoardPdf, winAnsiText } from "./exports";

describe("board PDF text", () => {
  it("keeps the naira amount and the em dash inside WinAnsi", async () => {
    expect(winAnsiText("340 ₦ million — gap")).toBe("340 NGN million - gap");
    const pack = {
      company: "Harbourline Assurance Plc",
      profile: "Multi-line insurer — motor, property, marine",
      generatedAt: new Date("2026-10-12T00:00:00.000Z"),
      complianceScore: 72,
      aboveAppetite: [],
      openActions: [],
      overdueCount: 0,
      findings: [],
      topRisks: [],
      frameworkScores: [],
      kris: [{ code: "KRI-02", name: "Motor premium unpaid", currentValue: 340, unit: "₦ million", rag: "RED" }],
      categoryLabel: {},
    } as unknown as BoardPack;
    const pdf = await buildBoardPdf(pack);
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
