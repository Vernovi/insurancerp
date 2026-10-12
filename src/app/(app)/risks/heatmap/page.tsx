import Link from "next/link";
import { Fragment } from "react";
import { PageHead } from "@/components/ui";
import { IMPACT_LABEL, LIKELIHOOD_LABEL } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { scoreBand } from "@/lib/scoring";

export default async function HeatmapPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const params = await searchParams;
  const inherent = params.view === "inherent";
  const risks = await prisma.risk.findMany();
  const cell = (likelihood: number, impact: number) =>
    risks.filter((risk) =>
      inherent
        ? risk.likelihoodInherent === likelihood && risk.impactInherent === impact
        : risk.likelihoodResidual === likelihood && risk.impactResidual === impact,
    );

  return (
    <div>
      <PageHead
        kicker="5 × 5"
        title={inherent ? "Inherent heat map" : "Residual heat map"}
        lede="Count of risks in each likelihood and impact cell. Colour is the score band."
      >
        <Link className="btn secondary" href={inherent ? "/risks/heatmap" : "/risks/heatmap?view=inherent"}>
          {inherent ? "Show residual" : "Show inherent"}
        </Link>
      </PageHead>
      <section className="card">
        <div className="heat" data-testid="heatmap">
          <div />
          {[1, 2, 3, 4, 5].map((likelihood) => (
            <div key={likelihood} className="heat-label">
              {likelihood} {LIKELIHOOD_LABEL[likelihood]}
            </div>
          ))}
          {[5, 4, 3, 2, 1].map((impact) => (
            <Fragment key={impact}>
              <div className="heat-label">
                {impact} {IMPACT_LABEL[impact]}
              </div>
              {[1, 2, 3, 4, 5].map((likelihood) => {
                const risksHere = cell(likelihood, impact);
                const band = scoreBand(likelihood * impact);
                return (
                  <Link
                    key={`${likelihood}-${impact}`}
                    href={`/risks`}
                    className={`heat-cell band-${band}`}
                    data-testid="heat-cell"
                    title={risksHere.map((risk) => risk.code).join(", ")}
                  >
                    {risksHere.length}
                    <small>{band.toLowerCase()}</small>
                  </Link>
                );
              })}
            </Fragment>
          ))}
        </div>
      </section>
    </div>
  );
}
