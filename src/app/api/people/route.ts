import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import { jsonError, readJson, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { canManagePeople } from "@/lib/permissions";
import { personSchema } from "@/lib/schemas";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;
  if (!canManagePeople(auth.session.role)) return jsonError("Only an admin can add a person.", 403);
  const parsed = await readJson(request, personSchema);
  if (parsed.error) return parsed.error;
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError("That email is already in use.");
  const id = email.split("@")[0].replace(/[^a-z0-9]+/g, "-");
  const user = await prisma.user.create({
    data: {
      id,
      email,
      name: parsed.data.name,
      role: parsed.data.role,
      title: parsed.data.title,
      departmentId: parsed.data.departmentId,
      passwordHash: bcrypt.hashSync(parsed.data.password, 10),
    },
  });
  await recordAudit({
    actor: auth.session,
    action: "CREATE",
    entityType: "USER",
    entityId: user.id,
    summary: `Added ${user.name} as ${user.role}.`,
  });
  return NextResponse.json({ id: user.id });
}
