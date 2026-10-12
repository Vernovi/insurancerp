import Link from "next/link";
import { desc, eq, type SQL } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { getDb, schema } from "@/lib/db";
import { userMap } from "@/lib/lookups";
import { fmtDateTime } from "@/lib/format";

export default async function AuditLog({ searchParams }: { searchParams: Promise<{ action?: string }> }) {
  const user = await requireUser();
  if (!user.roles.includes("admin") && !user.roles.includes("auditor")) return <p className="rounded-md bg-warn-soft p-4 text-warn">Only administrators and Internal Audit can view the audit log.</p>;
  const { action } = await searchParams;
  const db = await getDb();
  const where: SQL | undefined = action ? eq(schema.auditLog.action, action) : undefined;
  const rows = await db.select().from(schema.auditLog).where(where).orderBy(desc(schema.auditLog.at)).limit(500);
  const users = await userMap();
  const actions = ["login", "login_failed", "create", "update", "transition", "view_confidential", "link", "comment", "config_update", "user_update", "portal_report", "snapshot"];
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-ink-2">Every sign-in, change, approval, configuration edit and view of a confidential record. Entries can&apos;t be edited or deleted from the application.</p>
      </header>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Filter by action">
        <Link href="/admin/audit" className={`rounded px-2 py-1 ${!action ? "bg-accent-soft font-semibold text-accent" : "text-ink-2"}`}>All</Link>
        {actions.map((a) => <Link key={a} href={`?action=${a}`} className={`rounded px-2 py-1 ${action === a ? "bg-accent-soft font-semibold text-accent" : "text-ink-2"}`}>{a.replace(/_/g, " ")}</Link>)}
      </nav>
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="data-table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Record</th><th>Detail</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-ink-2">{fmtDateTime(r.at)}</td>
                <td className="whitespace-nowrap">{r.actorId ? users.get(r.actorId) : "System or portal"}</td>
                <td className="whitespace-nowrap">{r.action.replace(/_/g, " ")}</td>
                <td>{r.recordId ? <Link href={`/records/${r.recordId}`} className="text-accent hover:underline">#{r.recordId}</Link> : ""}</td>
                <td className="max-w-md truncate text-xs text-ink-3">{r.detail ? JSON.stringify(r.detail) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
