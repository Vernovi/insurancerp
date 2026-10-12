import Link from "next/link";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export default async function PerformancePage() {
  const session = await getSession();
  const [objectives, appraisals] = await Promise.all([
    prisma.objective.findMany({
      where: session?.role === "STAFF" ? { ownerId: session.id } : undefined,
      include: { owner: true, department: true, risk: true, kpis: { include: { scores: true } } },
      orderBy: { code: "asc" },
    }),
    prisma.appraisal.findMany({
      where: session?.role === "STAFF" ? { userId: session.id } : undefined,
      include: { subject: true, reviewer: true },
      orderBy: { period: "desc" },
    }),
  ]);
  return (
    <div>
      <PageHead kicker="Performance" title="Objectives and appraisals" lede="Objectives can point at a risk or a compliance element, so the appraisal is not separate from the risk picture." />
      <div className="stack">
        {objectives.map((objective) => (
          <Link key={objective.id} href={`/performance/${objective.id}`} className="card">
            <div className="page-head">
              <h2>
                {objective.code} {objective.title}
              </h2>
              <Pill value={objective.status} />
            </div>
            <p className="muted">
              {objective.owner.name} · {objective.department.name} · weight {objective.weight}
              {objective.risk ? ` · ${objective.risk.code}` : ""}
            </p>
          </Link>
        ))}
      </div>
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Appraisals</h2>
        <ul className="list">
          {appraisals.map((appraisal) => (
            <li key={appraisal.id}>
              {appraisal.subject.name} · {appraisal.period} · {appraisal.rating.toLowerCase()} · {appraisal.overallScore} · reviewer {appraisal.reviewer.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
