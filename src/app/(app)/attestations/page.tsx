import Link from "next/link";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getSession } from "@/lib/session";

export default async function AttestationsPage() {
  const session = await getSession();
  const rows = await prisma.policyAttestation.findMany({
    where: session?.role === "STAFF" ? { userId: session.id } : undefined,
    include: { user: true, policy: true, declaration: true, campaign: true },
    orderBy: [{ policyId: "asc" }, { user: { name: "asc" } }],
  });
  const done = rows.filter((row) => row.status === "ATTESTED").length;
  return (
    <div>
      <PageHead
        kicker="Staff attestation"
        title="Policy attestation"
        lede={`${done} of ${rows.length} shown rows are attested. The code, security and privacy policies are tied to the annual conduct declaration.`}
      />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              <th>Policy</th>
              <th>Due</th>
              <th>Status</th>
              <th>Declaration</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.user.name}</td>
                <td>
                  <Link href={`/policies/${row.policyId}`}>{row.policy.title}</Link>
                </td>
                <td>{formatDate(row.campaign.dueDate)}</td>
                <td>
                  <Pill value={row.status} />
                </td>
                <td>
                  {row.declaration ? <Link href={`/declarations/${row.declarationId}`}>{row.declaration.status.toLowerCase()}</Link> : "Not linked"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
