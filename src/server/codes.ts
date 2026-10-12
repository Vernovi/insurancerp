import { prisma } from "@/lib/db";

export async function nextNumericCode(prefix: string, codes: string[]): Promise<string> {
  const max = codes.reduce((highest, code) => {
    const value = Number(code.slice(prefix.length));
    return Number.isFinite(value) ? Math.max(highest, value) : highest;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export async function nextRiskCode(): Promise<string> {
  const rows = await prisma.risk.findMany({ select: { code: true } });
  return nextNumericCode("RSK-", rows.map((row) => row.code));
}

export async function nextActionCode(): Promise<string> {
  const rows = await prisma.actionItem.findMany({ select: { code: true } });
  return nextNumericCode("ACT-", rows.map((row) => row.code));
}

export async function nextPolicyCode(): Promise<string> {
  const rows = await prisma.policy.findMany({ select: { code: true } });
  const numbered = rows.map((row) => row.code).filter((code) => /^POL-\d+$/.test(code));
  return nextNumericCode("POL-", numbered.length ? numbered : ["POL-000"]);
}
