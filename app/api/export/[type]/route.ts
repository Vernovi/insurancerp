import { getCurrentUser } from "@/lib/auth/current";
import { listRecords, audit } from "@/lib/engine/records";
import { getTypeDef } from "@/lib/engine/registry";
import { userMap, unitMap } from "@/lib/lookups";
import { displayValue } from "@/lib/format";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // neutralise spreadsheet formulas
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const { type } = await params;
  const def = await getTypeDef(type);
  if (!def) return new Response("Unknown type.", { status: 404 });
  const u = new URL(req.url);
  const sp = u.searchParams;
  const rows = await listRecords(user, type, { status: sp.get("status") ?? undefined, q: sp.get("q") ?? undefined, mine: sp.get("mine") === "1", overdue: sp.get("overdue") === "1", open: sp.get("open") === "1", field: sp.get("field") ?? undefined, value: sp.get("value") ?? undefined, limit: 10000 });
  const [users, units] = await Promise.all([userMap(), unitMap()]);
  const header = ["Reference", "Title", "Status", "Owner", "Business unit", "Due", ...def.fields.map((f) => f.label)];
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    const d = r.data as Record<string, unknown>;
    const st = def.workflow.states.find((s) => s.key === r.status)?.label ?? r.status;
    lines.push([r.ref, r.title, st, r.ownerId ? users.get(r.ownerId) : "", r.orgUnitId ? units.get(r.orgUnitId) : "", r.dueDate ?? "", ...def.fields.map((f) => displayValue(f, d[f.key], users, units))].map(cell).join(","));
  }
  await audit(await getDb(), user.id, "export", null, { type, count: rows.length });
  return new Response(lines.join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${def.key}-${new Date().toISOString().slice(0, 10)}.csv"` },
  });
}
