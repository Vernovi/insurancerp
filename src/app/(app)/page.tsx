import Link from "next/link";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/session";
import { getBoardPack, categoryName } from "@/server/board";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const pack = await getBoardPack();
  const [mine, declarations, policiesDue, people] = await Promise.all([
    prisma.actionItem.findMany({
      where: { ownerId: session?.id, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.declarationCampaign.findMany({ include: { declarations: true } }),
    prisma.policy.findMany({ orderBy: { nextReviewDate: "asc" }, take: 5 }),
    prisma.user.count({ where: { active: true } }),
  ]);
  const red = pack.kris.filter((kri) => kri.rag === "RED").length;

  return (
    <div data-testid="dashboard">
      <PageHead
        kicker="Harbourline Assurance Plc"
        title="Executive view"
        lede="Motor, property, marine, energy, health, life and aviation on one register."
      />
      {params.denied ? <div className="banner bad">That page is outside your role.</div> : null}
      <div className="grid stats">
        <Link className="card stat" href="/appetite">
          <span>Above appetite</span>
          <b>{pack.aboveAppetite.length}</b>
        </Link>
        <Link className="card stat" href="/actions">
          <span>Open actions</span>
          <b>{pack.openActions.length}</b>
        </Link>
        <Link className="card stat" href="/actions?overdue=1">
          <span>Overdue</span>
          <b>{pack.overdueCount}</b>
        </Link>
        <Link className="card stat" href="/board">
          <span>Compliance score</span>
          <b>{pack.complianceScore ?? "—"}%</b>
        </Link>
      </div>
      <div className="grid cards-2" style={{ marginTop: 14 }}>
        <section className="card">
          <h2>Highest residual risks</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Risk</th>
                  <th>Line</th>
                  <th>Score</th>
                  <th>Appetite</th>
                </tr>
              </thead>
              <tbody>
                {pack.topRisks.slice(0, 6).map((risk) => (
                  <tr key={risk.id}>
                    <td>
                      <Link href={`/risks/${risk.id}`}>{risk.code}</Link> {risk.title}
                    </td>
                    <td>{risk.lineOfBusiness}</td>
                    <td>{risk.residualScore}</td>
                    <td>
                      <Pill value={risk.appetite} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card">
          <h2>What needs a decision</h2>
          <p>{red} key risk indicators are red. {pack.findings.length} audit findings are still open.</p>
          <ul className="list">
            {pack.aboveAppetite.slice(0, 4).map((risk) => (
              <li key={risk.id}>
                <Link href={`/risks/${risk.id}`}>{risk.code}</Link> {risk.title} · {categoryName(pack, risk.category)} · {risk.escalationStatus === "NONE" ? "not escalated" : risk.escalationStatus.toLowerCase()}
              </li>
            ))}
          </ul>
          <p>
            <Link href="/board">Open the Risk Committee pack</Link>
          </p>
        </section>
      </div>
      <div className="grid cards-3" style={{ marginTop: 14 }}>
        <section className="card">
          <h2>Declaration completion</h2>
          <ul className="list">
            {declarations.map((campaign) => {
              const approved = campaign.declarations.filter((row) => row.status === "APPROVED").length;
              return (
                <li key={campaign.id}>
                  <Link href="/declarations">{campaign.name}</Link>
                  <div className="muted">
                    {approved} of {people} approved · due {formatDate(campaign.dueDate)}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card">
          <h2>Policies coming due</h2>
          <ul className="list">
            {policiesDue.map((policy) => (
              <li key={policy.id}>
                <Link href={`/policies/${policy.id}`}>{policy.title}</Link>
                <div className="muted">Review {formatDate(policy.nextReviewDate)}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2>Your open actions</h2>
          {mine.length === 0 ? <p className="muted">Nothing is assigned to you.</p> : null}
          <ul className="list">
            {mine.map((action) => (
              <li key={action.id}>
                <Link href={`/actions/${action.id}`}>{action.code}</Link> {action.title}
                <div className="muted">Due {formatDate(action.dueDate)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
