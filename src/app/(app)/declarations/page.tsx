import Link from "next/link";
import { JsonForm } from "@/components/json-form";
import { PageHead, Pill } from "@/components/ui";
import { labelize } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/session";

export default async function DeclarationsPage() {
  const session = await getSession();
  const ownOnly = session?.role === "STAFF" || session?.role === "BOARD_VIEWER";
  const [campaigns, rows, own] = await Promise.all([
    prisma.declarationCampaign.findMany({
      include: { declarations: true, policies: { include: { policy: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.declaration.findMany({
      where: ownOnly && session ? { userId: session.id } : undefined,
      include: { user: true, campaign: true },
      orderBy: { campaign: { name: "asc" } },
    }),
    prisma.declaration.findMany({ where: { userId: session?.id ?? "" } }),
  ]);
  const people = await prisma.user.count();
  return (
    <div>
      <PageHead
        kicker="Conduct"
        title="Declarations"
        lede="Conflicts, gifts and hospitality, and the annual code of conduct. The code cannot be submitted until the linked policies are attested."
      >
        <a className="btn secondary" href="/api/export/declarations.csv">
          Export CSV
        </a>
      </PageHead>
      <div className="grid cards-3">
        {campaigns.map((campaign) => {
          const approved = campaign.declarations.filter((row) => row.status === "APPROVED").length;
          const started = own.find((row) => row.campaignId === campaign.id);
          return (
            <section key={campaign.id} className="card">
              <h2>{campaign.name}</h2>
              <p>
                {approved} of {people} approved · due {formatDate(campaign.dueDate)}
              </p>
              {campaign.policies.length ? (
                <p className="muted">Policies: {campaign.policies.map((row) => row.policy.title).join(", ")}</p>
              ) : null}
              {started ? (
                <Link href={`/declarations/${started.id}`}>Open yours</Link>
              ) : session && session.role !== "BOARD_VIEWER" ? (
                <JsonForm action="/api/declarations" submitLabel="Start mine">
                  <input type="hidden" name="campaignId" value={campaign.id} />
                </JsonForm>
              ) : null}
            </section>
          );
        })}
      </div>
      <div className="card table-wrap" style={{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Declaration</th>
              <th>Status</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.user.name}</td>
                <td>
                  <Link href={`/declarations/${row.id}`}>{labelize(row.type)}</Link>
                </td>
                <td>
                  <Pill value={row.status} />
                </td>
                <td>{formatDate(row.submittedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
