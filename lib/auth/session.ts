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

export async function signSession(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_HOURS}h`)
    .sign(await secret());
}

export async function readSession(token: string | undefined): Promise<{ uid: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await secret(), { algorithms: ["HS256"] });
    return typeof payload.uid === "number" ? { uid: payload.uid } : null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_HOURS * 3600;
