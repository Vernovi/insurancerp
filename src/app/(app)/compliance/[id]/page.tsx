import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import type { AssessmentStatus } from "@/lib/domain";
import { compliancePercent } from "@/lib/scoring";

export default async function FrameworkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const framework = await prisma.framework.findUnique({
    where: { id },
    include: { requirements: { include: { assessments: true }, orderBy: { sortOrder: "asc" } } },
  });
  if (!framework) notFound();
  const statuses = framework.requirements.map((requirement) => {
    const latest = [...requirement.assessments].sort((a, b) => b.assessedAt.getTime() - a.assessedAt.getTime())[0];
    return (latest?.status ?? "NOT_ASSESSED") as AssessmentStatus;
  });
  const summary = compliancePercent(statuses);
  return (
    <div>
      <PageHead kicker={framework.authority} title={framework.name} lede={framework.description}>
        <span data-testid="framework-score">{summary.percent === null ? "Not assessed" : `${summary.percent}%`}</span>
      </PageHead>
      <p className="muted">
        Source: <a href={framework.sourceUrl}>{framework.sourceUrl}</a>
      </p>
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ref</th>
              <th>Element</th>
              <th>Assessment</th>
            </tr>
          </thead>
          <tbody>
            {framework.requirements.map((requirement, index) => (
              <tr key={requirement.id}>
                <td>
                  <Link href={`/compliance/requirements/${requirement.id}`}>{requirement.code}</Link>
                </td>
                <td>{requirement.title}</td>
                <td>
                  <Pill value={statuses[index]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
