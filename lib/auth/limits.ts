import { eq } from "drizzle-orm";
import { schema, type DB } from "../db";

export const LOCK_AFTER = 5;
export const LOCK_MS = 15 * 60_000;

function atMs(v: Date | string): number {
  return v instanceof Date ? v.getTime() : new Date(v).getTime();
}

/** True when this key has had too many failures inside the lock window. */
export async function isLocked(db: DB, key: string, now = Date.now()): Promise<boolean> {
  const [row] = await db.select().from(schema.authLimits).where(eq(schema.authLimits.key, key));
  if (!row) return false;
  return row.n >= LOCK_AFTER && now - atMs(row.at) < LOCK_MS;
}

/** Count a failure. A gap longer than the window starts the count again. */
export async function strike(db: DB, key: string, now = Date.now()): Promise<void> {
  const [row] = await db.select().from(schema.authLimits).where(eq(schema.authLimits.key, key));
  const within = !!row && now - atMs(row.at) < LOCK_MS;
  const n = (within ? row!.n : 0) + 1;
  const at = new Date(now);
  if (!row) await db.insert(schema.authLimits).values({ key, n, at });
  else await db.update(schema.authLimits).set({ n, at }).where(eq(schema.authLimits.key, key));
}

export async function clearLimit(db: DB, key: string): Promise<void> {
  await db.delete(schema.authLimits).where(eq(schema.authLimits.key, key));
}

/**
 * Fixed-window counter shared by every instance. Returns true when the caller is over the limit
 * and this hit was not counted.
 */
export async function rateLimited(db: DB, key: string, limit: number, windowMs: number, now = Date.now()): Promise<boolean> {
  const [row] = await db.select().from(schema.authLimits).where(eq(schema.authLimits.key, key));
  if (!row || now - atMs(row.at) >= windowMs) {
    const at = new Date(now);
    if (!row) await db.insert(schema.authLimits).values({ key, n: 1, at });
    else await db.update(schema.authLimits).set({ n: 1, at }).where(eq(schema.authLimits.key, key));
    return false;
  }
  if (row.n >= limit) return true;
  await db.update(schema.authLimits).set({ n: row.n + 1 }).where(eq(schema.authLimits.key, key));
  return false;
}

export function clientAddress(h: { get(name: string): string | null }): string {
  const xff = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || h.get("x-real-ip")?.trim() || "local";
}
