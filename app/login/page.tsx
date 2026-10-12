import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current";
import { dbMode } from "@/lib/db";
import { DEMO_PASSWORD } from "@/lib/db/seed";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (await getCurrentUser()) redirect("/");
  const { next } = await searchParams;
  const demo = process.env.SEED_DEMO !== "false";
  const appName = process.env.APP_NAME ?? "Vernovi GRC";
  return (
    <main className="min-h-screen grid lg:grid-cols-[1fr_480px]">
      <section className="hidden lg:flex flex-col justify-between bg-ink text-white p-12">
        <p className="text-lg font-semibold">{appName}</p>
        <div className="max-w-lg">
          <h1 className="text-[2.5rem] leading-[1.1] font-semibold tracking-tight">Know where every risk sits against appetite, and who is fixing it.</h1>
          <p className="mt-5 text-white/70 leading-relaxed">
            One register for enterprise risk, compliance, policies, declarations, cases, third parties, audit, continuity and ESG, built for a multi-line insurer supervised by NAICOM.
          </p>
        </div>
        <p className="text-sm text-white/50">Confidential. Access is logged.</p>
      </section>
      <section className="flex items-center justify-center p-6 sm:p-12 bg-surface">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-ink-2">Use your work email.</p>
          <LoginForm next={next ?? "/"} />
          {demo && (
            <div className="mt-8 rounded-md border border-line bg-canvas p-4 text-sm">
              <p className="font-semibold">Demo accounts</p>
              <p className="mt-1 text-ink-2">
                Password for all: <code className="font-semibold text-ink">{DEMO_PASSWORD}</code>
              </p>
              <ul className="mt-2 space-y-1 text-ink-2">
                <li>adaeze.okafor@demo-insurance.ng (CRO)</li>
                <li>ngozi.eze@demo-insurance.ng (Compliance, MLRO)</li>
                <li>tunde.bakare@demo-insurance.ng (Risk team)</li>
                <li>ibrahim.musa@demo-insurance.ng (Internal Audit)</li>
                <li>chidi.okonkwo@demo-insurance.ng (Investigator)</li>
                <li>funmi.adeyemi@demo-insurance.ng (Head of Claims)</li>
                <li>admin@demo-insurance.ng (Administrator)</li>
              </ul>
              {dbMode() === "embedded" && <p className="mt-3 text-warn">Running on the embedded demo database. Changes reset when the server restarts.</p>}
            </div>
          )}
          <p className="mt-6 text-sm text-ink-2">
            Want to raise a concern anonymously? <a className="text-accent underline" href="/portal">Use the whistleblowing portal</a>.
          </p>
        </div>
      </section>
    </main>
  );
}
