import Link from "next/link";
import { PageHead } from "@/components/ui";
import { prisma } from "@/lib/db";
import type { AssessmentStatus } from "@/lib/domain";
import { compliancePercent } from "@/lib/scoring";

export default async function CompliancePage() {
  const frameworks = await prisma.framework.findMany({
    include: { requirements: { include: { assessments: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <div>
      <PageHead
        kicker="Obligations"
        title="Frameworks"
        lede="NAICOM section 6 is stored from the published guideline. NDPA duties are cited to the Act. ISO entries are titles only."
      />
      <div className="grid cards-2">
        {frameworks.map((framework) => {
          const statuses = framework.requirements.map((requirement) => {
            const latest = [...requirement.assessments].sort((a, b) => b.assessedAt.getTime() - a.assessedAt.getTime())[0];
            return (latest?.status ?? "NOT_ASSESSED") as AssessmentStatus;
          });
          const summary = compliancePercent(statuses);
          return (
            <Link key={framework.id} href={`/compliance/${framework.id}`} className="card" data-testid="framework-card">
              <p className="kicker">{framework.authority}</p>
              <h2>{framework.name}</h2>
              <p className="stat">
                <b>{summary.percent === null ? "—" : `${summary.percent}%`}</b>
              </p>
              <p className="muted">
                {summary.assessed} of {summary.total} elements assessed · {framework.versionLabel}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
