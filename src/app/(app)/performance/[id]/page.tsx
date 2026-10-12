import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canManagePerformance } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export default async function ObjectivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const objective = await prisma.objective.findUnique({
    where: { id },
    include: {
      owner: true,
      department: true,
      risk: true,
      requirement: true,
      kpis: { include: { scores: { orderBy: { period: "asc" } } } },
    },
  });
  if (!objective) notFound();
  const editable = session ? canManagePerformance(session.role) : false;
  return (
    <div>
      <PageHead kicker={`${objective.code} · ${objective.period}`} title={objective.title} lede={objective.description}>
        <Pill value={objective.status} />
      </PageHead>
      <p>
        {objective.owner.name} · {objective.department.name} · weight {objective.weight}
      </p>
      <ul className="list">
        {objective.risk ? (
          <li>
            Linked risk <Link href={`/risks/${objective.riskId}`}>{objective.risk.code}</Link> {objective.risk.title} · {objective.risk.lineOfBusiness}
          </li>
        ) : null}
        {objective.requirement ? (
          <li>
            Linked requirement <Link href={`/compliance/requirements/${objective.requirementId}`}>{objective.requirement.code}</Link> {objective.requirement.title}
          </li>
        ) : null}
      </ul>
      <div className="stack" style={{ marginTop: 14 }}>
        {objective.kpis.map((kpi) => (
          <section key={kpi.id} className="card" data-testid="kpi-score">
            <h2>{kpi.name}</h2>
            <p className="muted">
              Target {kpi.target} {kpi.unit} · {kpi.direction === "LOWER_IS_BETTER" ? "lower is better" : "higher is better"} · weight {kpi.weight}
            </p>
            <ul className="list">
              {kpi.scores.map((score) => (
                <li key={score.id}>
                  {score.period}: actual {score.actual} {kpi.unit} · score {score.score} · {score.notes} · {formatDate(score.scoredAt)}
                </li>
              ))}
            </ul>
            {editable ? (
              <JsonForm action="/api/scores" submitLabel="Record a score">
                <input type="hidden" name="kpiId" value={kpi.id} />
                <div className="form-grid">
                  <label>
                    Period
                    <input name="period" defaultValue="2026-Q3" />
                  </label>
                  <label>
                    Actual
                    <input name="actual" type="number" step="0.1" />
                  </label>
                  <label className="wide">
                    Notes
                    <input name="notes" defaultValue="Quarterly update." />
                  </label>
                </div>
              </JsonForm>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
