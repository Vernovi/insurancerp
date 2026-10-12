import Link from "next/link";
import { and, count, eq, inArray, lt, sql } from "drizzle-orm";
import { requireUser, hasRole } from "@/lib/auth/current";
import { getDb, schema, dbMode } from "@/lib/db";
import { MODULES } from "@/lib/defs/types";
import { today } from "@/lib/engine/pure";
import Nav, { type NavGroup } from "@/components/Nav";
import { logout } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const db = await getDb();
  const [{ unread }] = await db.select({ unread: count() }).from(schema.notifications).where(and(eq(schema.notifications.userId, user.id), eq(schema.notifications.read, false)));
  const [{ mine }] = await db
    .select({ mine: count() })
    .from(schema.records)
    .where(
      and(
        eq(schema.records.ownerId, user.id),
        lt(schema.records.dueDate, today()),
        sql`${schema.records.status} not in ('closed','cancelled','completed','attested','filed','submitted','retired','expired','exited')`,
      ),
    );
  const pendingAttest = await db.select({ n: count() }).from(schema.records).where(and(eq(schema.records.ownerId, user.id), inArray(schema.records.typeKey, ["attestation"]), eq(schema.records.status, "pending")));

  const groups: NavGroup[] = [
    { label: "Workspace", items: [{ href: "/", label: "Board overview" }, { href: "/my", label: "My work", count: Number(mine) + Number(pendingAttest[0].n) }, { href: "/board-pack", label: "Board packs" }] },
    ...(["Risk", "Governance", "Compliance", "Resilience"] as const).map((g) => ({
      label: g,
      items: MODULES.filter((m) => m.group === g).map((m) => ({ href: `/m/${m.key}`, label: m.label })),
    })),
  ];
  if (hasRole(user, "admin")) groups.push({ label: "Administration", items: [{ href: "/admin", label: "Settings and users" }, { href: "/admin/audit", label: "Audit log" }] });
  const appName = process.env.APP_NAME ?? "Vernovi GRC";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="no-print bg-ink text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/" className="text-base font-semibold tracking-tight">{appName}</Link>
        </div>
        <details className="lg:hidden px-3 pb-3">
          <summary className="cursor-pointer rounded-md px-3 py-2 text-sm text-white/80">Menu</summary>
          <div className="pt-2"><Nav groups={groups} /></div>
        </details>
        <div className="hidden lg:block px-2 pb-8"><Nav groups={groups} /></div>
      </aside>
      <div className="min-w-0">
        {dbMode() === "embedded" && (
          <div className="no-print bg-warn-soft px-6 py-2 text-sm text-warn">
            Demo database: data resets when the server restarts. Connect Neon (DATABASE_URL) to keep it.
          </div>
        )}
        <header className="no-print sticky top-0 z-10 flex items-center gap-4 border-b border-line bg-surface/95 px-6 py-3 backdrop-blur">
          <form action="/search" className="flex-1 max-w-md">
            <label className="sr-only" htmlFor="q">Search records</label>
            <input id="q" name="q" placeholder="Search by reference, title or content" className="field-input" />
          </form>
          <Link href="/notifications" className="relative text-sm text-ink-2 hover:text-ink">
            Notifications
            {Number(unread) > 0 && <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-white">{Number(unread)}</span>}
          </Link>
          <div className="text-right text-sm leading-tight">
            <p className="font-semibold">{user.name}</p>
            <p className="text-xs text-ink-3">{user.title}</p>
          </div>
          <form action={logout}>
            <button className="btn btn-secondary">Sign out</button>
          </form>
        </header>
        <main className="px-6 py-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
