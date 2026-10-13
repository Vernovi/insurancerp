import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "grc_session";
const MAX_AGE_HOURS = 10;

let cached: Uint8Array | null = null;

/**
 * Signing key: SESSION_SECRET if set, otherwise a random key generated in the
 * database on first boot (app_settings.session_secret), so a fresh deployment
 * is secure without anyone handling the secret.
 */
async function secret(): Promise<Uint8Array> {
  const env = process.env.SESSION_SECRET;
  if (env && env.length >= 32) return new TextEncoder().encode(env);
  if (cached) return cached;
  const { getDb, schema } = await import("../db");
  const { eq } = await import("drizzle-orm");
  const db = await getDb();
  const [row] = await db.select().from(schema.appSettings).where(eq(schema.appSettings.key, "session_secret"));
  if (!row || row.value.length < 32) throw new Error("Session secret missing from app_settings.");
  cached = new TextEncoder().encode(row.value);
  return cached;
}

/** Forget the cached key (after the database rotates it, e.g. on a demo reseed). */
export function resetSessionKeyCache() {
  cached = null;
}

/** Full session. `em` binds the token to the account's email, so a reseeded database can't reuse it. */
export async function signSession(userId: number, email: string, mfa: boolean): Promise<string> {
  return new SignJWT({ uid: userId, em: email, mfa, stage: "full" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_HOURS}h`)
    .sign(await secret());
}

export async function readSession(token: string | undefined): Promise<{ uid: number; em: string; mfa: boolean } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret(), { algorithms: ["HS256"] });
    if (payload.stage !== "full" || typeof payload.uid !== "number" || typeof payload.em !== "string") return null;
    return { uid: payload.uid, em: payload.em, mfa: payload.mfa === true };
  } catch {
    return null;
  }
}

/** Short-lived token issued after the password check while the second factor is pending. */
export const MFA_COOKIE = "grc_mfa";
export const MFA_MAX_AGE = 10 * 60;
export type MfaStage = "verify" | "enrol";

export async function signPending(userId: number, email: string, stage: MfaStage, next: string): Promise<string> {
  return new SignJWT({ uid: userId, em: email, stage: `mfa-${stage}`, next })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MFA_MAX_AGE}s`)
    .sign(await secret());
}

export async function readPending(token: string | undefined): Promise<{ uid: number; em: string; stage: MfaStage; next: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number" || typeof payload.em !== "string") return null;
    const stage = payload.stage === "mfa-verify" ? "verify" : payload.stage === "mfa-enrol" ? "enrol" : null;
    if (!stage) return null;
    return { uid: payload.uid, em: payload.em, stage, next: typeof payload.next === "string" ? payload.next : "/" };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_HOURS * 3600;
