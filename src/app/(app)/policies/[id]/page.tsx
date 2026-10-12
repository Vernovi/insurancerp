import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { RecordPanels } from "@/components/record-panels";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canManagePolicies } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export default async function PolicyDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const policy = await prisma.policy.findUnique({
    where: { id },
    include: {
      owner: true,
      versions: { include: { author: true, approver: true }, orderBy: { createdAt: "desc" } },
      requirements: { include: { requirement: true } },
      declarationLinks: { include: { campaign: true } },
      attestations: true,
    },
  });
  if (!policy) notFound();
  const editable = session ? canManagePolicies(session.role) : false;
  const attested = policy.attestations.filter((row) => row.status === "ATTESTED").length;
  return (
    <div>
      <PageHead kicker={policy.code} title={policy.title} lede={policy.summary}>
        <Pill value={policy.status} />
      </PageHead>
      <div className="split">
        <div className="stack">
          <section className="card">
            <p>
              Owner {policy.owner.name} · next review {formatDate(policy.nextReviewDate)} · last review {formatDate(policy.lastReviewDate)}
            </p>
            <p>
              Attestation {attested} of {policy.attestations.length} complete.{" "}
              <Link href="/attestations">Open the attestation register</Link>
            </p>
            {policy.declarationLinks.length ? (
              <p>
                Linked to{" "}
                {policy.declarationLinks.map((link) => (
                  <Link key={link.campaignId} href="/declarations">
                    {link.campaign.name}
                  </Link>
                ))}
              </p>
            ) : (
              <p className="muted">This policy is not part of the annual conduct declaration.</p>
            )}
          </section>
          <section className="card">
            <h2>Versions</h2>
            {policy.versions.map((version) => (
              <article key={version.id} data-testid="policy-version" style={{ marginBottom: 16 }}>
                <h3>
                  Version {version.versionLabel} <Pill value={version.status} />
                </h3>
                <p className="muted">
                  {version.author.name}
                  {version.approver ? ` · approved by ${version.approver.name} ${formatDate(version.approvedAt)}` : ""}
                </p>
                <p>{version.changeNotes}</p>
                <p className="prose">{version.content}</p>
                {editable && (version.status === "DRAFT" || version.status === "SUBMITTED") ? (
                  <JsonForm action={`/api/policies/${policy.id}/decision`} submitLabel={version.status === "DRAFT" ? "Submit for approval" : "Approve"}>
                    <input type="hidden" name="versionId" value={version.id} />
                    <input type="hidden" name="decision" value={version.status === "DRAFT" ? "SUBMIT" : "APPROVE"} />
                    <label>
                      Note
                      <input name="notes" defaultValue="Reviewed for the trial." />
                    </label>
                  </JsonForm>
                ) : null}
              </article>
            ))}
            {editable ? (
              <JsonForm action={`/api/policies/${policy.id}/versions`} submitLabel="Save draft version">
                <div className="form-grid">
                  <label>
                    Version
                    <input name="versionLabel" placeholder="2.2" />
                  </label>
                  <label>
                    What changed
                    <input name="changeNotes" />
                  </label>
                  <label className="wide">
                    Text
                    <textarea name="content" />
                  </label>
                </div>
              </JsonForm>
            ) : null}
          </section>
          <section className="card">
            <h2>Mapped requirements</h2>
            <ul className="list">
              {policy.requirements.map((link) => (
                <li key={link.requirementId}>
                  <Link href={`/compliance/requirements/${link.requirementId}`}>{link.requirement.code}</Link> {link.requirement.title}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <RecordPanels entityType="POLICY" entityId={policy.id} canUpload={editable} />
      </div>
    </div>
  );
}
