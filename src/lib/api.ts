import { NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import type { Role } from "./domain";
import { getSession, type SessionUser } from "./session";

export async function requireApiUser(roles?: Role[]): Promise<
  { session: SessionUser; response: null } | { session: SessionUser | null; response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { session: null, response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) };
  }
  if (roles && !roles.includes(session.role)) {
    return {
      session,
      response: NextResponse.json({ error: "Your role cannot perform this action." }, { status: 403 }),
    };
  }
  return { session, response: null };
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export async function readJson<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { error: jsonError(parsed.error.issues[0]?.message ?? "Check the form and try again.") };
  }
  return { data: parsed.data };
}
