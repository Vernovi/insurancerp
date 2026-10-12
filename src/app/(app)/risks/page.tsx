import Link from "next/link";
import { Filters, PageHead, Pill } from "@/components/ui";
import { CATEGORY_LABEL, LINES_OF_BUSINESS, type RiskCategory } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { canManageRisks } from "@/lib/permissions";
import { appetitePosition, scoreBand } from "@/lib/scoring";
import { getSession } from "@/lib/session";

export default async function RisksPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; line?: string; appetite?: string; q?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const [risks, limits] = await Promise.all([
    prisma.risk.findMany({ include: { owner: true, department: true }, orderBy: { residualScore: "desc" } }),
    prisma.riskAppetiteLimit.findMany(),
  ]);
  const limitOf = new Map(limits.map((limit) => [limit.category, limit.maxResidualScore]));
  const rows = risks
    .map((risk) => ({
      ...risk,
      appetite: appetitePosition(risk.residualScore, limitOf.get(risk.category) ?? 25),
      band: scoreBand(risk.residualScore),
    }))
    .filter((risk) => (params.category ? risk.category === params.category : true))
    .filter((risk) => (params.line ? risk.lineOfBusiness === params.line : true))
    .filter((risk) => (params.appetite ? risk.appetite === params.appetite : true))
    .filter((risk) =>
      params.q ? `${risk.code} ${risk.title} ${risk.lineOfBusiness}`.toLowerCase().includes(params.q.toLowerCase()) : true,
    );

  return (
    <div>
      <PageHead kicker="Enterprise risk" title="Risk register" lede={`${risks.length} risks across Harbourline’s lines. Scores are likelihood × impact on a 5×5 scale.`}>
        <a className="btn secondary" href="/api/export/risks.csv">
          Export CSV
        </a>
        {session && canManageRisks(session.role) ? (
          <Link className="btn" href="/risks/new" data-testid="new-risk">
            Add a risk
          </Link>
        ) : null}
      </PageHead>
      <Filters
        items={[
          { href: "/risks", label: "All lines", on: !params.line && !params.appetite && !params.category },
          ...LINES_OF_BUSINESS.map((line) => ({ href: `/risks?line=${encodeURIComponent(line)}`, label: line, on: params.line === line })),
          { href: "/risks?appetite=ABOVE", label: "Above appetite", on: params.appetite === "ABOVE" },
        ]}
      />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Risk</th>
              <th>Line</th>
              <th>Category</th>
              <th>Owner</th>
              <th>Inherent</th>
              <th>Residual</th>
              <th>Appetite</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((risk) => (
              <tr key={risk.id} data-testid="risk-row">
                <td>
                  <Link href={`/risks/${risk.id}`}>{risk.code}</Link>
                </td>
                <td>{risk.title}</td>
                <td>{risk.lineOfBusiness}</td>
                <td>{CATEGORY_LABEL[risk.category as RiskCategory]}</td>
                <td>{risk.owner.name}</td>
                <td>
                  {risk.inherentScore} <Pill value={scoreBand(risk.inherentScore)} />
                </td>
                <td>
                  {risk.residualScore} <Pill value={risk.band} />
                </td>
                <td>
                  <Pill value={risk.appetite} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
