import Link from "next/link";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function PoliciesPage() {
  const policies = await prisma.policy.findMany({
    include: { owner: true, versions: true },
    orderBy: { code: "asc" },
  });
  return (
    <div>
      <PageHead kicker="Policy library" title="Policies" lede="Versions, approval and the next review date. Attestation sits with the annual code of conduct." />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Policy</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Versions</th>
              <th>Next review</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.id}>
                <td>
                  <Link href={`/policies/${policy.id}`}>{policy.code}</Link>
                </td>
                <td>{policy.title}</td>
                <td>{policy.owner.name}</td>
                <td>
                  <Pill value={policy.status} />
                </td>
                <td>{policy.versions.length}</td>
                <td>{formatDate(policy.nextReviewDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
