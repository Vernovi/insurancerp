import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/current";
import { getDb, schema } from "@/lib/db";
import { fmtDateTime } from "@/lib/format";
import { markAllRead } from "@/app/actions";

export default async function Notifications() {
  const user = await requireUser();
  const db = await getDb();
  const items = await db.select().from(schema.notifications).where(eq(schema.notifications.userId, user.id)).orderBy(desc(schema.notifications.createdAt)).limit(200);
  const unread = items.filter((i) => !i.read).length;
  return (
    <div className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-ink-2">{unread} unread</p>
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <button className="btn btn-secondary">Mark all as read</button>
          </form>
        )}
      </header>
      <ul className="divide-y divide-line-2 rounded-md border border-line bg-surface">
        {items.map((n) => (
          <li key={n.id} className={`flex items-start justify-between gap-4 px-4 py-3 text-sm ${n.read ? "text-ink-2" : ""}`}>
            <div className="flex gap-2">
              {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
              {n.recordId ? <Link href={`/records/${n.recordId}`} className="hover:text-accent hover:underline">{n.message}</Link> : <span>{n.message}</span>}
            </div>
            <span className="shrink-0 text-xs text-ink-3">{fmtDateTime(n.createdAt)}</span>
          </li>
        ))}
        {items.length === 0 && <li className="px-4 py-8 text-center text-sm text-ink-2">No notifications yet.</li>}
      </ul>
    </div>
  );
}
