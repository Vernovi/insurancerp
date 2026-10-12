import Link from "next/link";
import { PageHead } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

const HREF: Record<string, (id: string) => string> = {
  RISK: (id) => `/risks/${id}`,
  POLICY: (id) => `/policies/${id}`,
  CONTROL: (id) => `/controls/${id}`,
  ACTION: (id) => `/actions/${id}`,
  DECLARATION: (id) => `/declarations/${id}`,
  REQUIREMENT: (id) => `/compliance/requirements/${id}`,
  OBJECTIVE: (id) => `/performance/${id}`,
};

export default async function AuditPage() {
  const events = await prisma.auditEvent.findMany({ orderBy: { at: "desc" }, take: 200 });
  return (
    <div>
      <PageHead kicker="History" title="Audit trail" lede="Sign-in, edits, approvals, escalation, attestation, uploads and exports." />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Record</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const href = event.entityId && HREF[event.entityType] ? HREF[event.entityType](event.entityId) : null;
              return (
                <tr key={event.id}>
                  <td>{formatDateTime(event.at)}</td>
                  <td>
                    {event.actorName}
                    <div className="muted">{event.actorRole}</div>
                  </td>
                  <td>{event.action}</td>
                  <td>{href ? <Link href={href}>{event.entityType}</Link> : event.entityType}</td>
                  <td>{event.summary}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
