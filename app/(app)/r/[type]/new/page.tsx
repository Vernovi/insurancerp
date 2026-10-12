import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { getTypeDef } from "@/lib/engine/registry";
import { canCreate } from "@/lib/engine/permissions";
import { getRecordForUser } from "@/lib/engine/records";
import { loadUsers, loadOrgUnits } from "@/lib/lookups";
import RecordForm from "@/components/RecordForm";
import { createRecordAction } from "@/app/actions";
import { today } from "@/lib/engine/pure";

export default async function NewRecord({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ link?: string; kind?: string }> }) {
  const user = await requireUser();
  const { type } = await params;
  const sp = await searchParams;
  const def = await getTypeDef(type);
  if (!def) notFound();
  if (!canCreate(user, def)) {
    return <p className="rounded-md bg-warn-soft p-4 text-warn">Your role can&apos;t create {def.plural.toLowerCase()}. Ask an administrator if you need access.</p>;
  }
  let linkTo: { id: number; kind: string; label: string } | undefined;
  const defaults: Record<string, unknown> = {};
  if (sp.link) {
    const parent = await getRecordForUser(user, Number(sp.link));
    if (parent) {
      linkTo = { id: parent.record.id, kind: sp.kind ?? "related", label: `${parent.record.ref} ${parent.record.title}` };
      const sourceMap: Record<string, string> = { risk: "Risk", control_test: "Control test", finding: parent.record.data && (parent.record.data as Record<string, unknown>).source === "Internal audit" ? "Internal audit finding" : "Control test", case: "Case", policy_exception: "Policy exception", reg_change: "Regulatory change", meeting: "Board decision", bc_exercise: "BCM exercise", third_party: "Third party" };
      if (type === "action" && sourceMap[parent.def.key]) defaults.source = sourceMap[parent.def.key];
      if (type === "risk" && parent.def.key === "policy_exception") defaults.category = "Compliance and conduct";
      if (type === "finding" && parent.def.key === "engagement") defaults.source = "Internal audit";
    }
  }
  if (type === "case") defaults.reported_date = today();
  const [users, units] = await Promise.all([loadUsers(), loadOrgUnits()]);
  return (
    <div className="space-y-5">
      <header>
        <Link href={`/r/${def.key}`} className="text-sm text-ink-3 hover:text-accent">{def.plural}</Link>
        <h1 className="text-2xl font-semibold tracking-tight">New {def.label.toLowerCase()}</h1>
        {def.description && <p className="mt-1 max-w-2xl text-ink-2">{def.description}</p>}
      </header>
      <RecordForm
        def={def}
        action={createRecordAction}
        users={users.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }))}
        units={units.map((u) => ({ id: u.id, name: u.name }))}
        values={{ title: "", ownerId: user.id, orgUnitId: user.orgUnitId, data: defaults }}
        linkTo={linkTo}
        submitLabel={`Create ${def.label.toLowerCase()}`}
        defaultOwner={user.id}
      />
    </div>
  );
}
