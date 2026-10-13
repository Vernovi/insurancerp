// Time-based one-time passwords (RFC 6238, HMAC-SHA1, 6 digits, 30-second step),
// compatible with Microsoft Authenticator, Google Authenticator, 1Password and Authy.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 secret.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32 encoded. */
export function newSecret(): string {
  return base32Encode(randomBytes(20));
}

/** HOTP (RFC 4226) for a counter. `key` is the raw secret bytes. */
export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export function stepAt(unixMs: number): number {
  return Math.floor(unixMs / 1000 / STEP_SECONDS);
}

/** The code for a base32 secret at a moment in time. */
export function totp(secret: string, unixMs = Date.now(), digits = DIGITS): string {
  return hotp(base32Decode(secret), stepAt(unixMs), digits);
}

/**
 * Verify a code, allowing one step of clock drift either side. Returns the matched time step,
 * or null. A step at or before `lastStep` is refused so a code can't be replayed.
 */
export function verifyTotp(secret: string, code: string, unixMs = Date.now(), lastStep: number | null = null, window = 1): number | null {
  const c = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return null;
  }
  const now = stepAt(unixMs);
  for (let w = -window; w <= window; w++) {
    const step = now + w;
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(hotp(key, step));
    if (timingSafeEqual(expected, Buffer.from(c))) return step;
  }
  return null;
}

export function otpauthUri(secret: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/** Who must use an authenticator app. Administrators always do, whatever the policy. */
export type MfaPolicy = "admin" | "privileged" | "all";
export const MFA_POLICIES: { key: MfaPolicy; label: string }[] = [
  { key: "admin", label: "Administrators only" },
  { key: "privileged", label: "Administrators, risk, compliance, audit, investigations and board" },
  { key: "all", label: "Everyone" },
];
export const PRIVILEGED_ROLES = ["admin", "cro", "risk", "compliance", "mlro", "auditor", "investigator", "board"];

/** Whether a user must use MFA: administrators always; others by policy or when an admin requires it. */
export function mfaMandatory(u: { roles: string[]; mfaRequired: boolean }, policy: MfaPolicy = "admin"): boolean {
  if (u.roles.includes("admin") || u.mfaRequired || policy === "all") return true;
  return policy === "privileged" && u.roles.some((r) => PRIVILEGED_ROLES.includes(r));
}

/** The sign-in page sentence, so it always says what will actually happen. */
export function mfaPolicySentence(policy: MfaPolicy): string {
  if (policy === "all") return "Everyone confirms sign-in with an authenticator app.";
  if (policy === "privileged") return "Administrators and risk, compliance, audit, investigations and board users confirm with an authenticator app.";
  return "Administrators confirm with an authenticator app. Other users can turn it on from My account.";
}
