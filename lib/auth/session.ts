import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "grc_session";
const MAX_AGE_HOURS = 10;

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (s && s.length >= 32) return new TextEncoder().encode(s);
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production" && !process.env.ALLOW_DEMO_SECRET) {
    throw new Error("SESSION_SECRET must be set (32+ characters) in production.");
  }
  // Development and demo fallback only.
  return new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret-change-me");
}

export async function signSession(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_HOURS}h`)
    .sign(secret());
}

export async function readSession(token: string | undefined): Promise<{ uid: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return typeof payload.uid === "number" ? { uid: payload.uid } : null;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_HOURS * 3600;
