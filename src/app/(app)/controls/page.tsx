import Link from "next/link";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";

export default async function ControlsPage() {
  const controls = await prisma.control.findMany({ include: { owner: true, risks: true }, orderBy: { code: "asc" } });
  return (
    <div>
      <PageHead kicker="Assurance" title="Controls" lede="Preventive, detective and corrective controls linked to risks and to compliance elements." />
      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Control</th>
              <th>Type</th>
              <th>Owner</th>
              <th>Effectiveness</th>
              <th>Risks</th>
              <th>Last tested</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => (
              <tr key={control.id}>
                <td>
                  <Link href={`/controls/${control.id}`}>{control.code}</Link>
                </td>
                <td>{control.name}</td>
                <td>{control.type.toLowerCase()}</td>
                <td>{control.owner.name}</td>
                <td>
                  <Pill value={control.effectiveness} />
                </td>
                <td>{control.risks.length}</td>
                <td>{formatDate(control.lastTestedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
