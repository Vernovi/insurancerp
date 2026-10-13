import Link from "next/link";
import { and, count, eq, inArray, lt, sql } from "drizzle-orm";
import { requireUser, hasRole } from "@/lib/auth/current";
import { getDb, schema, dbMode } from "@/lib/db";
import { MODULES } from "@/lib/defs/types";
import { today } from "@/lib/engine/pure";
import Nav, { type NavGroup } from "@/components/Nav";
import { logout } from "@/app/actions";
import { isDemoTenant } from "@/lib/db/seed";
import { getScope } from "@/lib/scope";
import EntitySwitcher from "@/components/EntitySwitcher";
import HostingNote from "@/components/HostingNote";
import { Suspense } from "react";

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
    { label: "Workspace", items: [{ href: "/", label: "Group overview" }, { href: "/my", label: "My work", count: Number(mine) + Number(pendingAttest[0].n) }, { href: "/calendar", label: "Returns calendar" }, { href: "/board-pack", label: "Board packs" }] },
    ...(["Risk", "Governance", "Compliance", "Resilience"] as const).map((g) => ({
      label: g,
      items: MODULES.filter((m) => m.group === g).map((m) => ({ href: `/m/${m.key}`, label: m.label })),
    })),
  ];
  if (hasRole(user, "admin")) groups.push({ label: "Administration", items: [{ href: "/admin", label: "Settings and users" }, { href: "/admin/audit", label: "Audit log" }] });
  const appName = process.env.APP_NAME ?? "Vernovi GRC";
  const [demo, scope] = await Promise.all([isDemoTenant(db), getScope(user)]);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="no-print bg-nav text-white lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/" className="text-base font-semibold tracking-tight">{appName}</Link>
        </div>
        <details className="lg:hidden px-3 pb-3">
          <summary className="cursor-pointer rounded-md px-3 py-2 text-sm text-white/80">Menu</summary>
          <div className="pt-2"><Nav groups={groups} /></div>
        </details>
        <div className="hidden lg:block px-2 pb-8"><Nav groups={groups} /></div>
        <HostingNote className="hidden lg:block px-5 pb-6 text-[11px] leading-snug text-white/55" />
      </aside>
      <div className="min-w-0">
        {demo && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-accent px-4 py-1.5 text-xs text-white sm:px-6" role="note">
            <strong className="tracking-wide">FICTIONAL DEMO DATA</strong>
            <span className="text-white/90">Demo Financial Group and everyone in it are invented.</span>
          </div>
        )}
        {dbMode() === "embedded" && (
          <div className="no-print bg-warn-soft px-6 py-2 text-sm text-warn">
            Embedded local database: data resets when the server restarts.
          </div>
        )}
        <header className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:px-6">
          <Suspense fallback={null}>
            <EntitySwitcher entities={scope.visible.map((e) => ({ id: e.id, code: e.code, name: e.name, walled: e.walled }))} selected={scope.selected?.id ?? null} />
          </Suspense>
          <form action="/search" className="order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:max-w-sm">
            <label className="sr-only" htmlFor="q">Search records</label>
            <input id="q" name="q" placeholder="Search by reference, title or content" className="field-input" />
          </form>
          <Link href="/notifications" className="relative mr-auto text-sm text-ink-2 hover:text-ink sm:mr-0">
            Notifications
            {Number(unread) > 0 && <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-white">{Number(unread)}</span>}
          </Link>
          <Link href="/account" className="hidden text-right text-sm leading-tight hover:text-accent sm:block">
            <p className="font-semibold">{user.name}</p>
            <p className="text-xs text-ink-3">{user.title}</p>
          </Link>
          <Link href="/account" className="text-sm text-ink-2 hover:text-ink sm:hidden">Account</Link>
          <form action={logout}>
            <button className="btn btn-secondary">Sign out</button>
          </form>
        </header>
        <main className="px-4 py-6 sm:px-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
