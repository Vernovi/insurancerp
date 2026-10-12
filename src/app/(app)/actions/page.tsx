import Link from "next/link";
import { Filters, PageHead, Pill } from "@/components/ui";
import { JsonForm } from "@/components/json-form";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canManageCompliance, canManageRisks } from "@/lib/permissions";
import { isOverdue } from "@/lib/scoring";
import { getSession } from "@/lib/session";

export default async function ActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ overdue?: string; mine?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  const [actions, users, risks] = await Promise.all([
    prisma.actionItem.findMany({ include: { owner: true, risk: true, finding: true }, orderBy: { dueDate: "asc" } }),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.risk.findMany({ orderBy: { code: "asc" } }),
  ]);
  const rows = actions.filter((action) => {
    if (params.mine === "1" && action.ownerId !== session?.id) return false;
    if (params.overdue === "1" && !isOverdue(action.dueDate, action.status)) return false;
    return true;
  });
  const canAdd = session ? canManageRisks(session.role) || canManageCompliance(session.role) : false;
  return (
    <div>
      <PageHead kicker="Remediation" title="Actions" lede="Work linked to risks, findings and compliance gaps. Overdue is calculated from the due date.">
        <a className="btn secondary" href="/api/export/actions.csv">
          Export CSV
        </a>
      </PageHead>
      <Filters
        items={[
          { href: "/actions", label: "All", on: !params.overdue && !params.mine },
          { href: "/actions?overdue=1", label: "Overdue", on: params.overdue === "1" },
          { href: "/actions?mine=1", label: "Mine", on: params.mine === "1" },
        ]}
      />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Action</th>
              <th>Source</th>
              <th>Owner</th>
              <th>Due</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((action) => {
              const overdue = isOverdue(action.dueDate, action.status);
              return (
                <tr key={action.id}>
                  <td>
                    <Link href={`/actions/${action.id}`}>{action.code}</Link>
                  </td>
                  <td>{action.title}</td>
                  <td>
                    {action.risk ? <Link href={`/risks/${action.riskId}`}>{action.risk.code}</Link> : action.sourceType.toLowerCase()}
                    {action.finding ? ` · ${action.finding.code}` : ""}
                  </td>
                  <td>{action.owner.name}</td>
                  <td>{formatDate(action.dueDate)}</td>
                  <td>{overdue ? <span data-testid="action-overdue"><Pill value="OVERDUE">Overdue</Pill></span> : <Pill value={action.status} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canAdd ? (
        <section className="card" style={{ marginTop: 14 }}>
          <h2>Open an action</h2>
          <JsonForm action="/api/actions" submitLabel="Create action" successHref="/actions">
            <div className="form-grid">
              <label className="wide">
                Title
                <input name="title" required />
              </label>
              <label className="wide">
                Description
                <textarea name="description" required />
              </label>
              <label>
                Source
                <select name="sourceType" defaultValue="RISK">
                  <option value="RISK">Risk</option>
                  <option value="FINDING">Finding</option>
                  <option value="COMPLIANCE_GAP">Compliance gap</option>
                  <option value="AUDIT">Audit</option>
                  <option value="KRI">KRI</option>
                </select>
              </label>
              <label>
                Risk
                <select name="riskId">
                  <option value="">None</option>
                  {risks.map((risk) => (
                    <option key={risk.id} value={risk.id}>
                      {risk.code}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Owner
                <select name="ownerId">
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due
                <input name="dueDate" type="date" defaultValue="2026-11-30" />
              </label>
              <label>
                Priority
                <select name="priority" defaultValue="MEDIUM">
                  <option>HIGH</option>
                  <option>MEDIUM</option>
                  <option>LOW</option>
                </select>
              </label>
            </div>
          </JsonForm>
        </section>
      ) : null}
    </div>
  );
}
