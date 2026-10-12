import Link from "next/link";
import { PageHead, Pill } from "@/components/ui";
import { CATEGORY_LABEL, type RiskCategory } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { appetitePosition } from "@/lib/scoring";

export default async function AppetitePage() {
  const [limits, risks] = await Promise.all([
    prisma.riskAppetiteLimit.findMany({ include: { owner: true }, orderBy: { category: "asc" } }),
    prisma.risk.findMany({ include: { owner: true } }),
  ]);
  return (
    <div>
      <PageHead
        kicker="Board limits"
        title="Risk appetite"
        lede="A residual score above the category limit is flagged and can be escalated to the Risk Committee."
      />
      <div className="stack">
        {limits.map((limit) => {
          const inCategory = risks.filter((risk) => risk.category === limit.category);
          const above = inCategory.filter((risk) => appetitePosition(risk.residualScore, limit.maxResidualScore) === "ABOVE");
          return (
            <section key={limit.id} className="card">
              <div className="page-head">
                <h2>{CATEGORY_LABEL[limit.category as RiskCategory]}</h2>
                <strong>Limit {limit.maxResidualScore}</strong>
              </div>
              <p>{limit.statement}</p>
              <p className="muted">
                Owner {limit.owner.name} · reviewed {formatDate(limit.reviewDate)} · {above.length} above the limit
              </p>
              <ul className="list">
                {above.map((risk) => (
                  <li key={risk.id}>
                    <Link href={`/risks/${risk.id}`}>{risk.code}</Link> {risk.title} · residual {risk.residualScore} · <Pill value={risk.escalationStatus === "NONE" ? "ABOVE" : risk.escalationStatus} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
