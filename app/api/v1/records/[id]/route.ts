import { NextResponse } from "next/server";
import { apiUser } from "@/lib/apiauth";
import { getRecordForUser, transitionRecord, updateRecord, EngineError } from "@/lib/engine/records";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token." }, { status: 401 });
  const found = await getRecordForUser(user, Number((await params).id));
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(found.record);
}

/** PATCH { title?, ownerId?, data?, transition?, comment? } */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token." }, { status: 401 });
  const id = Number((await params).id);
  const found = await getRecordForUser(user, id);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { title?: string; ownerId?: number | null; data?: Record<string, unknown>; transition?: string; comment?: string };
  try {
    if (body.data || body.title || body.ownerId !== undefined) {
      await updateRecord(user, id, { title: body.title ?? found.record.title, ownerId: body.ownerId === undefined ? found.record.ownerId : body.ownerId, orgUnitId: found.record.orgUnitId, raw: body.data ?? {} });
    }
    if (body.transition) await transitionRecord(user, id, body.transition, body.comment);
    const after = await getRecordForUser(user, id);
    return NextResponse.json(after?.record);
  } catch (e) {
    if (e instanceof EngineError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
