import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonForm } from "@/components/json-form";
import { PageHead, Pill } from "@/components/ui";
import { labelize } from "@/lib/domain";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canReviewDeclarations } from "@/lib/permissions";
import { getSession } from "@/lib/session";

export default async function DeclarationDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  const declaration = await prisma.declaration.findUnique({
    where: { id },
    include: {
      user: true,
      reviewer: true,
      campaign: { include: { policies: { include: { policy: true } } } },
      attestations: { include: { policy: true } },
    },
  });
  if (!declaration) notFound();
  const payload = JSON.parse(declaration.payload || "{}") as Record<string, string>;
  const linked = declaration.campaign.policies;
  const userAttestations = linked.length
    ? await prisma.policyAttestation.findMany({
        where: { userId: declaration.userId, policyId: { in: linked.map((row) => row.policyId) } },
        include: { policy: true },
      })
    : [];
  const owner = session?.id === declaration.userId;
  const reviewer = session ? canReviewDeclarations(session.role) : false;
  return (
    <div>
      <PageHead kicker={declaration.user.name} title={labelize(declaration.type)} lede={declaration.campaign.name}>
        <Pill value={declaration.status} />
      </PageHead>
      {linked.length ? (
        <section className="card" data-testid="declaration-policies">
          <h2>Policies covered by this declaration</h2>
          <p className="muted">Attest each policy, then submit. The declaration stores the link.</p>
          <ul className="list">
            {userAttestations.map((row) => (
              <li key={row.id}>
                <Link href={`/policies/${row.policyId}`}>{row.policy.title}</Link> · <Pill value={row.status} />
                {owner && row.status !== "ATTESTED" ? (
                  <JsonForm action={`/api/attestations/${row.id}`} submitLabel="Attest">
                    <input type="hidden" name="confirm" value="yes" />
                  </JsonForm>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="card" style={{ marginTop: 14 }}>
        <h2>Submission</h2>
        {declaration.submittedAt ? <p className="muted">Submitted {formatDate(declaration.submittedAt)}</p> : null}
        {declaration.reviewNotes ? (
          <p>
            Review by {declaration.reviewer?.name}: {declaration.reviewNotes}
          </p>
        ) : null}
        {owner && declaration.status !== "APPROVED" ? (
          <JsonForm action={`/api/declarations/${declaration.id}`} method="PATCH" submitLabel="Submit declaration">
            {declaration.type === "CONFLICT_OF_INTEREST" ? (
              <>
                <label>
                  Do you have a conflict?
                  <select name="hasConflict" defaultValue={payload.hasConflict ?? "no"}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label>
                  Related party
                  <input name="relatedParty" defaultValue={payload.relatedParty ?? ""} />
                </label>
                <label>
                  Details
                  <textarea name="details" defaultValue={payload.details ?? ""} />
                </label>
              </>
            ) : null}
            {declaration.type === "GIFTS_HOSPITALITY" ? (
              <>
                <label>
                  Anything to declare?
                  <select name="receivedAny" defaultValue={payload.receivedAny ?? "no"}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label>
                  Donor
                  <input name="donor" defaultValue={payload.donor ?? ""} />
                </label>
                <label>
                  Description
                  <input name="description" defaultValue={payload.description ?? ""} />
                </label>
                <label>
                  Estimated value
                  <input name="estimatedValue" defaultValue={payload.estimatedValue ?? ""} />
                </label>
                <label>
                  Date
                  <input name="dateGiven" defaultValue={payload.dateGiven ?? ""} />
                </label>
              </>
            ) : null}
            {declaration.type === "CODE_OF_CONDUCT" ? (
              <>
                <label>
                  I have read the code of conduct
                  <select name="acknowledge" defaultValue={payload.acknowledge === "yes" ? "yes" : "no"}>
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </label>
                <label>
                  Comment
                  <textarea name="comment" defaultValue={payload.comment ?? ""} />
                </label>
              </>
            ) : null}
          </JsonForm>
        ) : (
          <pre className="prose">{JSON.stringify(payload, null, 2)}</pre>
        )}
        {reviewer && declaration.status === "SUBMITTED" ? (
          <JsonForm action={`/api/declarations/${declaration.id}`} submitLabel="Record review">
            <label>
              Decision
              <select name="decision">
                <option value="APPROVE">Approve</option>
                <option value="RETURN">Return</option>
              </select>
            </label>
            <label>
              Note
              <input name="notes" defaultValue="Reviewed against the policy." />
            </label>
          </JsonForm>
        ) : null}
      </section>
    </div>
  );
}
