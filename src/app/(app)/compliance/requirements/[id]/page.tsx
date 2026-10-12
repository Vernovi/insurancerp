import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canManageCompliance } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export default async function RequirementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const requirement = await prisma.requirement.findUnique({
    where: { id },
    include: {
      framework: true,
      controls: { include: { control: true } },
      policies: { include: { policy: true } },
      assessments: { include: { assessor: true }, orderBy: { assessedAt: "desc" } },
      evidence: { include: { uploader: true }, orderBy: { uploadedAt: "desc" } },
    },
  });
  if (!requirement) notFound();
  const editable = session ? canManageCompliance(session.role) : false;
  return (
    <div>
      <PageHead kicker={`${requirement.framework.name} · ${requirement.code}`} title={requirement.title}>
        {requirement.assessments[0] ? <Pill value={requirement.assessments[0].status} /> : <Pill value="NOT_ASSESSED" />}
      </PageHead>
      <div className="split">
        <div className="stack">
          <section className="card prose">
            <p data-testid="requirement-text">{requirement.text}</p>
            <p data-testid="requirement-citation">
              <a href={requirement.framework.sourceUrl}>{requirement.citation}</a>
            </p>
          </section>
          <section className="card">
            <h2>Mapped controls and policies</h2>
            <ul className="list">
              {requirement.controls.map((link) => (
                <li key={link.controlId}>
                  <Link href={`/controls/${link.controlId}`}>{link.control.code}</Link> {link.control.name}
                </li>
              ))}
              {requirement.policies.map((link) => (
                <li key={link.policyId}>
                  <Link href={`/policies/${link.policyId}`}>{link.policy.code}</Link> {link.policy.title}
                </li>
              ))}
            </ul>
          </section>
          <section className="card">
            <h2>Evidence</h2>
            <ul className="list">
              {requirement.evidence.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong> — {item.description} ({item.reference}) · {item.uploader.name}
                </li>
              ))}
            </ul>
            {editable ? (
              <JsonForm action="/api/evidence" submitLabel="Add evidence">
                <input type="hidden" name="requirementId" value={requirement.id} />
                <label>
                  Title
                  <input name="title" />
                </label>
                <label>
                  Description
                  <textarea name="description" />
                </label>
                <label>
                  Reference
                  <input name="reference" placeholder="Policy, minute or file name" />
                </label>
              </JsonForm>
            ) : null}
          </section>
        </div>
        <section className="card">
          <h2>Assessments</h2>
          <ul className="list">
            {requirement.assessments.map((assessment) => (
              <li key={assessment.id}>
                {assessment.period} · <Pill value={assessment.status} /> · {assessment.assessor.name} · {formatDate(assessment.assessedAt)}
                <div>{assessment.notes}</div>
              </li>
            ))}
          </ul>
          {editable ? (
            <JsonForm action="/api/assessments" submitLabel="Save assessment">
              <input type="hidden" name="requirementId" value={requirement.id} />
              <label>
                Period
                <input name="period" defaultValue="2026-Q4" />
              </label>
              <label>
                Status
                <select name="status" defaultValue="PARTIAL">
                  <option value="COMPLIANT">Compliant</option>
                  <option value="PARTIAL">Partial</option>
                  <option value="NON_COMPLIANT">Non-compliant</option>
                  <option value="NOT_ASSESSED">Not assessed</option>
                </select>
              </label>
              <label>
                Notes
                <textarea name="notes" defaultValue="Updated in the trial walkthrough." />
              </label>
            </JsonForm>
          ) : null}
        </section>
      </div>
    </div>
  );
}
