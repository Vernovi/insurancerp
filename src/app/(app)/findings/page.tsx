import Link from "next/link";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function FindingsPage() {
  const findings = await prisma.finding.findMany({
    include: { owner: true, risk: true, actions: true, requirement: true },
    orderBy: { code: "asc" },
  });
  return (
    <div>
      <PageHead kicker="Assurance" title="Audit findings" lede="Internal audit, external audit, control tests and regulator queries, with the actions raised against them." />
      <div className="stack">
        {findings.map((finding) => (
          <section key={finding.id} className="card" data-testid="finding-card">
            <div className="page-head">
              <h2>
                {finding.code} {finding.title}
              </h2>
              <Pill value={finding.severity} />
            </div>
            <p>{finding.description}</p>
            <p className="muted">
              {finding.source.toLowerCase().replaceAll("_", " ")} · {finding.status.toLowerCase().replaceAll("_", " ")} · {finding.owner.name} · raised {formatDate(finding.raisedAt)}
            </p>
            <ul className="list">
              {finding.risk ? (
                <li>
                  <Link href={`/risks/${finding.riskId}`}>{finding.risk.code}</Link> {finding.risk.title}
                </li>
              ) : null}
              {finding.requirement ? (
                <li>
                  <Link href={`/compliance/requirements/${finding.requirementId}`}>{finding.requirement.code}</Link> {finding.requirement.title}
                </li>
              ) : null}
              {finding.actions.map((action) => (
                <li key={action.id}>
                  <Link href={`/actions/${action.id}`}>{action.code}</Link> {action.title}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
