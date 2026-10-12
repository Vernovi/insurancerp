import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { RecordPanels } from "@/components/record-panels";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { isOverdue } from "@/lib/scoring";
import { getSession } from "@/lib/session";

export default async function ActionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const action = await prisma.actionItem.findUnique({
    where: { id },
    include: { owner: true, risk: true, finding: true, requirement: true },
  });
  if (!action) notFound();
  const overdue = isOverdue(action.dueDate, action.status);
  const canUpdate = session && session.role !== "BOARD_VIEWER" && (session.role !== "STAFF" || session.id === action.ownerId);
  return (
    <div>
      <PageHead kicker={action.code} title={action.title} lede={action.description}>
        {overdue ? <span data-testid="action-overdue"><Pill value="OVERDUE">Overdue</Pill></span> : <Pill value={action.status} />}
      </PageHead>
      <div className="split">
        <section className="card">
          <p>
            Owner {action.owner.name} · due {formatDate(action.dueDate)} · priority {action.priority.toLowerCase()} · source {action.sourceType.toLowerCase()}
          </p>
          <ul className="list">
            {action.risk ? (
              <li>
                Risk <Link href={`/risks/${action.riskId}`}>{action.risk.code}</Link> {action.risk.title}
              </li>
            ) : null}
            {action.finding ? (
              <li>
                Finding <Link href="/findings">{action.finding.code}</Link> {action.finding.title}
              </li>
            ) : null}
            {action.requirement ? (
              <li>
                Requirement <Link href={`/compliance/requirements/${action.requirementId}`}>{action.requirement.code}</Link>
              </li>
            ) : null}
          </ul>
          {canUpdate ? (
            <JsonForm action={`/api/actions/${action.id}`} method="PATCH" submitLabel="Update status">
              <label>
                Status
                <select name="status" defaultValue={action.status}>
                  <option value="OPEN">Open</option>
                  <option value="IN_PROGRESS">In progress</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </label>
              <label>
                Note
                <input name="note" defaultValue="Status updated in the register." />
              </label>
            </JsonForm>
          ) : null}
        </section>
        <RecordPanels entityType="ACTION" entityId={action.id} canUpload={Boolean(canUpdate)} />
      </div>
    </div>
  );
}
