import { NextResponse } from "next/server";
import { apiUser } from "@/lib/apiauth";
import { createRecord, listRecords, EngineError } from "@/lib/engine/records";
import { loadTypes } from "@/lib/engine/registry";

export const dynamic = "force-dynamic";

/** GET /api/v1/records?type=risk&status=active&q=fraud  |  POST { type, title, ownerId?, data } */
export async function GET(req: Request) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token." }, { status: 401 });
  const u = new URL(req.url);
  const type = u.searchParams.get("type");
  const types = await loadTypes();
  const keys = type ? [type] : types.map((t) => t.key);
  if (type && !types.some((t) => t.key === type)) return NextResponse.json({ error: `Unknown type ${type}.`, types: types.map((t) => t.key) }, { status: 400 });
  const rows = await listRecords(user, keys, { status: u.searchParams.get("status") ?? undefined, q: u.searchParams.get("q") ?? undefined, limit: Math.min(1000, Number(u.searchParams.get("limit") ?? 200)) });
  return NextResponse.json({ count: rows.length, records: rows });
}

export async function POST(req: Request) {
  const user = await apiUser(req);
  if (!user) return NextResponse.json({ error: "Missing or invalid bearer token." }, { status: 401 });
  let body: { type?: string; title?: string; ownerId?: number; orgUnitId?: number; data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }
  if (!body.type || !body.title) return NextResponse.json({ error: "type and title are required." }, { status: 400 });
  try {
    const rec = await createRecord(user, body.type, { title: body.title, ownerId: body.ownerId ?? null, orgUnitId: body.orgUnitId ?? null, raw: body.data ?? {} });
    return NextResponse.json(rec, { status: 201 });
  } catch (e) {
    if (e instanceof EngineError) return NextResponse.json({ error: e.message }, { status: 422 });
    throw e;
  }
}
