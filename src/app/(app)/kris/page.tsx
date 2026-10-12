import Link from "next/link";
import { JsonForm } from "@/components/json-form";
import { PageHead, Pill } from "@/components/ui";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { canManageRisks } from "@/lib/permissions";
import { kriRag, type KriDirection } from "@/lib/scoring";
import { getSession } from "@/lib/session";

export default async function KrisPage() {
  const session = await getSession();
  const kris = await prisma.kri.findMany({ include: { owner: true, risk: true }, orderBy: { code: "asc" } });
  const editable = session ? canManageRisks(session.role) : false;
  return (
    <div>
      <PageHead kicker="Indicators" title="Key risk indicators" lede="Red, amber and green are calculated from the thresholds. They are not typed in." />
      <div className="stack">
        {kris.map((kri) => {
          const rag = kriRag(kri.currentValue, kri.greenThreshold, kri.amberThreshold, kri.direction as KriDirection);
          return (
            <section key={kri.id} className="card">
              <div className="page-head">
                <div>
                  <h2>
                    {kri.code} {kri.name}
                  </h2>
                  <p className="muted">{kri.description}</p>
                </div>
                <Pill value={rag} />
              </div>
              <p>
                Current {kri.currentValue} {kri.unit} · green {kri.direction === "LOWER_IS_BETTER" ? "at or below" : "at or above"} {kri.greenThreshold} · amber {kri.amberThreshold} · measured {formatDate(kri.measuredAt)}
              </p>
              <p className="muted">
                {kri.owner.name}
                {kri.risk ? (
                  <>
                    {" "}
                    · <Link href={`/risks/${kri.riskId}`}>{kri.risk.code}</Link>
                  </>
                ) : null}
              </p>
              {editable ? (
                <JsonForm action={`/api/kris/${kri.id}`} method="PATCH" submitLabel="Update value">
                  <label>
                    New value
                    <input name="currentValue" type="number" step="0.1" defaultValue={kri.currentValue} />
                  </label>
                </JsonForm>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
