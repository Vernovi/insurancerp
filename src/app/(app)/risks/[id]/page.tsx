import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { RecordPanels } from "@/components/record-panels";
import { PageHead, Pill } from "@/components/ui";
import { CATEGORY_LABEL, IMPACT_LABEL, LIKELIHOOD_LABEL, type RiskCategory } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { canManageRisks } from "@/lib/permissions";
import { appetitePosition, scoreBand } from "@/lib/scoring";
import { getSession } from "@/lib/session";

export default async function RiskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const risk = await prisma.risk.findUnique({
    where: { id },
    include: {
      owner: true,
      department: true,
      controls: { include: { control: true } },
      kris: true,
      actions: { include: { owner: true } },
      objectives: true,
      escalatedBy: true,
    },
  });
  if (!risk) notFound();
  const limit = await prisma.riskAppetiteLimit.findUnique({ where: { category: risk.category } });
  const appetite = appetitePosition(risk.residualScore, limit?.maxResidualScore ?? 25);
  const editable = session ? canManageRisks(session.role) : false;

  return (
    <div>
      <PageHead kicker={`${risk.code} · ${risk.lineOfBusiness}`} title={risk.title} lede={risk.description}>
        <Pill value={appetite} />
        <span data-testid="appetite-flag">{appetite === "ABOVE" ? "Above appetite" : appetite === "APPROACHING" ? "Approaching appetite" : "Within appetite"}</span>
      </PageHead>
      <div className="split">
        <div className="stack">
          <section className="card grid cards-2">
            <div>
              <h2>Inherent {risk.inherentScore}</h2>
              <p>
                Likelihood {risk.likelihoodInherent} ({LIKELIHOOD_LABEL[risk.likelihoodInherent]}) × impact {risk.impactInherent} ({IMPACT_LABEL[risk.impactInherent]})
              </p>
              <Pill value={scoreBand(risk.inherentScore)} />
            </div>
            <div>
              <h2>Residual {risk.residualScore}</h2>
              <p>
                Likelihood {risk.likelihoodResidual} ({LIKELIHOOD_LABEL[risk.likelihoodResidual]}) × impact {risk.impactResidual} ({IMPACT_LABEL[risk.impactResidual]})
              </p>
              <Pill value={scoreBand(risk.residualScore)} />
            </div>
          </section>
          <section className="card">
            <h2>Ownership</h2>
            <p>
              {CATEGORY_LABEL[risk.category as RiskCategory]} · {risk.department.name} · {risk.owner.name}
            </p>
            <p>Treatment {risk.treatment.toLowerCase()} · status {risk.status.toLowerCase()} · trend {risk.trend.toLowerCase()}</p>
            <p>{risk.strategicObjective}</p>
            <p>
              Category limit {limit?.maxResidualScore ?? "—"} · escalation {risk.escalationStatus.toLowerCase()}
              {risk.escalationNote ? ` · ${risk.escalationNote}` : ""}
            </p>
          </section>
          {editable && appetite === "ABOVE" ? (
            <section className="card">
              <h2>Escalate to the Risk Committee</h2>
              <JsonForm action={`/api/risks/${risk.id}/escalate`} submitLabel={risk.escalationStatus === "ESCALATED" ? "Acknowledge" : "Escalate"}>
                <input type="hidden" name="decision" value={risk.escalationStatus === "ESCALATED" ? "ACKNOWLEDGE" : "ESCALATE"} />
                <label>
                  Note
                  <textarea name="note" required defaultValue={risk.escalationNote ?? ""} />
                </label>
              </JsonForm>
            </section>
          ) : null}
          <section className="card">
            <h2>Controls</h2>
            <ul className="list">
              {risk.controls.map((link) => (
                <li key={link.controlId}>
                  <Link href={`/controls/${link.controlId}`}>{link.control.code}</Link> {link.control.name} · <Pill value={link.control.effectiveness} />
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>Linked actions and objectives</h2>
            <ul className="list">
              {risk.actions.map((action) => (
                <li key={action.id}>
                  <Link href={`/actions/${action.id}`}>{action.code}</Link> {action.title}
                </li>
              ))}
              {risk.objectives.map((objective) => (
                <li key={objective.id}>
                  <Link href={`/performance/${objective.id}`}>{objective.code}</Link> {objective.title}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <RecordPanels entityType="RISK" entityId={risk.id} canUpload={editable} />
      </div>
    </div>
  );
}
