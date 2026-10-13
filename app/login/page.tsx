import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import { getDb, dbMode } from "@/lib/db";
import { isDemoTenant } from "@/lib/db/seed";
import HostingNote from "@/components/HostingNote";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const demo = await isDemoTenant(await getDb());
  // Demo hints are off unless explicitly switched on, and never include a password.
  const hints = process.env.SHOW_DEMO_HINTS === "true" && demo;
  const appName = process.env.APP_NAME ?? "Vernovi GRC";
  return (
    <main className="min-h-screen grid lg:grid-cols-[1fr_480px]">
      <section className="hidden lg:flex flex-col justify-between bg-nav text-white p-12">
        <p className="text-lg font-semibold">{appName}</p>
        <div className="max-w-lg">
          <h1 className="text-[2.4rem] leading-[1.15] font-semibold tracking-tight">Every entity, every regulator, every filing, in one view of risk.</h1>
          <p className="mt-5 text-white/75 leading-relaxed">
            Governance, risk and compliance for a financial group with an insurer at its core: enterprise risk against appetite, ORSA and declarations, the returns calendar, cases, policies, third parties, audit and continuity.
          </p>
        </div>
        <p className="text-sm text-white/60">Confidential. Access is logged.</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12 bg-surface">
        <div className="w-full max-w-sm">
          {demo && <p className="mb-6 inline-block rounded-sm bg-accent-soft px-2 py-1 text-xs font-semibold tracking-wide text-accent">FICTIONAL DEMO DATA</p>}
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-ink-2">Use your work email. Administrators confirm with an authenticator app.</p>
          <LoginForm next={next ?? "/"} />
          {hints && (
            <div className="mt-8 rounded-md border border-line bg-canvas p-4 text-sm text-ink-2">
              <p className="font-semibold text-ink">Trial accounts</p>
              <p className="mt-1">Your Vernovi contact issues trial sign-in details. They are not published here.</p>
            </div>
          )}
          {dbMode() === "embedded" && <p className="mt-6 text-sm text-warn">Running on the embedded local database. Changes reset when the server restarts.</p>}
          <p className="mt-6 text-sm text-ink-2">
            Want to raise a concern anonymously? <a className="text-accent underline" href="/portal">Use the whistleblowing portal</a>.
          </p>
          <HostingNote className="mt-6 text-xs text-ink-3" />
        </div>
      </section>
    </main>
  );
}
