import Link from "next/link";
import { PageHead, Pill } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { canExportBoard } from "@/lib/permissions";
import { getSession } from "@/lib/session";
import { categoryName, getBoardPack } from "@/server/board";

export default async function BoardPage() {
  const session = await getSession();
  const pack = await getBoardPack();
  const canExport = session ? canExportBoard(session.role) : false;
  return (
    <div>
      <PageHead
        kicker="Board Risk Committee"
        title="Committee pack"
        lede={`${pack.company}. ${pack.profile}. Position on ${formatDate(pack.generatedAt)}.`}
      >
        {canExport ? (
          <>
            <a className="btn" href="/api/export/board.pdf" data-testid="export-pdf">
              PDF pack
            </a>
            <a className="btn secondary" href="/api/export/board.xlsx" data-testid="export-xlsx">
              Excel pack
            </a>
          </>
        ) : null}
      </PageHead>
      <div className="grid stats">
        <div className="card stat">
          <span>Top risks shown</span>
          <b>{pack.topRisks.length}</b>
        </div>
        <div className="card stat">
          <span>Above appetite</span>
          <b>{pack.aboveAppetite.length}</b>
        </div>
        <div className="card stat">
          <span>Open actions</span>
          <b>{pack.openActions.length}</b>
        </div>
        <div className="card stat" data-testid="board-compliance">
          <span>Compliance score</span>
          <b>{pack.complianceScore ?? "—"}%</b>
        </div>
      </div>
      <section className="card" style={{ marginTop: 14 }} data-testid="board-top">
        <h2>Top 10 risks</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Risk</th>
                <th>Line</th>
                <th>Category</th>
                <th>Residual</th>
                <th>Appetite</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {pack.topRisks.map((risk, index) => (
                <tr key={risk.id}>
                  <td>{index + 1}</td>
                  <td>
                    <Link href={`/risks/${risk.id}`}>{risk.code}</Link> {risk.title}
                  </td>
                  <td>{risk.lineOfBusiness}</td>
                  <td>{categoryName(pack, risk.category)}</td>
                  <td>{risk.residualScore}</td>
                  <td>
                    <Pill value={risk.appetite} />
                  </td>
                  <td>{risk.owner.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card" style={{ marginTop: 14 }} data-testid="board-above">
        <h2>Risks above appetite</h2>
        <ul className="list">
          {pack.aboveAppetite.map((risk) => (
            <li key={risk.id}>
              <Link href={`/risks/${risk.id}`}>{risk.code}</Link> {risk.title} · residual {risk.residualScore} / limit {risk.appetiteLimit} · {risk.lineOfBusiness} · escalation {risk.escalationStatus.toLowerCase()}
            </li>
          ))}
        </ul>
      </section>
      <div className="grid cards-2" style={{ marginTop: 14 }}>
        <section className="card">
          <h2>Open actions</h2>
          <p className="muted">{pack.overdueCount} overdue</p>
          <ul className="list">
            {pack.openActions.slice(0, 8).map((action) => (
              <li key={action.id}>
                <Link href={`/actions/${action.id}`}>{action.code}</Link> {action.title} · due {formatDate(action.dueDate)} {action.overdue ? "· overdue" : ""}
              </li>
            ))}
          </ul>
        </section>
        <section className="card" data-testid="board-findings">
          <h2>Audit findings</h2>
          <ul className="list">
            {pack.findings.map((finding) => (
              <li key={finding.id}>
                <Link href="/findings">{finding.code}</Link> {finding.title} · {finding.severity.toLowerCase()} · {finding.owner.name}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Compliance by framework</h2>
        <ul className="list">
          {pack.frameworkScores.map((framework) => (
            <li key={framework.id}>
              <Link href={`/compliance/${framework.id}`}>{framework.name}</Link> · {framework.percent === null ? "not assessed" : `${framework.percent}%`} · {framework.assessed} of {framework.total} assessed
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
