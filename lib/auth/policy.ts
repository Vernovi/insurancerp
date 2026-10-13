import "server-only";
import { cache } from "react";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import type { MfaPolicy } from "./totp";

/** Tenant-wide MFA policy (app_settings.mfa_policy). Defaults: demo tenant administrators only; real tenant everyone. */
export const getMfaPolicy = cache(async (): Promise<MfaPolicy> => {
  const db = await getDb();
  const rows = (await db.execute(sql`SELECT key, value FROM app_settings WHERE key IN ('mfa_policy', 'demo_tenant')`)).rows as { key: string; value: string }[];
  const v = rows.find((r) => r.key === "mfa_policy")?.value;
  if (v === "admin" || v === "privileged" || v === "all") return v;
  return rows.some((r) => r.key === "demo_tenant") ? "admin" : "all";
});
