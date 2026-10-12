import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { RecordPanels } from "@/components/record-panels";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { canManageRisks } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export default async function ControlDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const control = await prisma.control.findUnique({
    where: { id },
    include: { owner: true, risks: { include: { risk: true } }, requirements: { include: { requirement: true } } },
  });
  if (!control) notFound();
  const editable = session ? canManageRisks(session.role) : false;
  return (
    <div>
      <PageHead kicker={control.code} title={control.name} lede={control.description}>
        <Pill value={control.effectiveness} />
      </PageHead>
      <div className="split">
        <div className="stack">
          <section className="card">
            <p>
              {control.type.toLowerCase()} · {control.frequency} · {control.owner.name}
            </p>
            <h2>Risks</h2>
            <ul className="list">
              {control.risks.map((link) => (
                <li key={link.riskId}>
                  <Link href={`/risks/${link.riskId}`}>{link.risk.code}</Link> {link.risk.title} · {link.risk.lineOfBusiness}
                </li>
              ))}
            </ul>
            <h2>Requirements</h2>
            <ul className="list">
              {control.requirements.map((link) => (
                <li key={link.requirementId}>
                  <Link href={`/compliance/requirements/${link.requirementId}`}>{link.requirement.code}</Link> {link.requirement.title}
                </li>
              ))}
            </ul>
            {editable ? (
              <JsonForm action={`/api/controls/${control.id}`} method="PATCH" submitLabel="Save effectiveness">
                <label>
                  Effectiveness
                  <select name="effectiveness" defaultValue={control.effectiveness}>
                    <option value="EFFECTIVE">Effective</option>
                    <option value="PARTIALLY_EFFECTIVE">Partially effective</option>
                    <option value="INEFFECTIVE">Ineffective</option>
                    <option value="NOT_TESTED">Not tested</option>
                  </select>
                </label>
              </JsonForm>
            ) : null}
          </section>
        </div>
        <RecordPanels entityType="CONTROL" entityId={control.id} canUpload={editable} />
      </div>
    </div>
  );
}
