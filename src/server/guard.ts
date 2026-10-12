import { redirect } from "next/navigation";
import type { Role } from "@/lib/domain";
import { getSession, type SessionUser } from "@/lib/session";

export async function requirePage(roles?: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles && !roles.includes(session.role)) redirect("/?denied=1");
  return session;
}
