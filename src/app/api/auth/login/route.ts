import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson } from "@/lib/api";
import { prisma } from "@/lib/db";
import { isRole } from "@/lib/domain";
import { sessionCookieOptions, SESSION_COOKIE, signSession } from "@/lib/session";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = await readJson(request, schema);
  if (parsed.error) return parsed.error;
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  const valid = user && user.active && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!user || !valid || !isRole(user.role)) {
    return jsonError("Email or password is not recognised.", 401);
  }
  const token = await signSession({ id: user.id, email: user.email, name: user.name, role: user.role });
  await recordAudit({
    actor: { id: user.id, name: user.name, role: user.role },
    action: "LOGIN",
    entityType: "USER",
    entityId: user.id,
    summary: `${user.name} signed in.`,
  });
  const response = NextResponse.json({ ok: true, name: user.name, role: user.role });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
