import Link from "next/link";
import { midSentence } from "@/lib/format";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { getRecordForUser, canEdit } from "@/lib/engine/records";
import { loadUsers, loadOrgUnits } from "@/lib/lookups";
import RecordForm from "@/components/RecordForm";
import { getScope } from "@/lib/scope";
import { updateRecordAction } from "@/app/actions";

export default async function EditRecord({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const found = await getRecordForUser(user, Number(id));
  if (!found) notFound();
  const { record: r, def } = found;
  if (!canEdit(user, def, r)) {
    return <p className="rounded-md bg-warn-soft p-4 text-warn">You can view this record but not edit it. The owner or the {midSentence(def.label)} team can.</p>;
  }
  const [users, units, scope] = await Promise.all([loadUsers(), loadOrgUnits(), getScope(user)]);
  return (
    <div className="space-y-5">
      <header>
        <Link href={`/records/${r.id}`} className="text-sm text-ink-3 hover:text-accent">{r.ref}</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {midSentence(def.label)}</h1>
      </header>
      <RecordForm
        def={def}
        action={updateRecordAction}
        recordId={r.id}
        users={users.filter((u) => u.active || u.id === r.ownerId).map((u) => ({ id: u.id, name: u.name }))}
        units={units.map((u) => ({ id: u.id, name: u.name }))}
        entities={scope.visible.map((e) => ({ id: e.id, name: e.name }))}
        values={{ title: r.title, ownerId: r.ownerId, orgUnitId: r.orgUnitId, entityId: r.entityId, data: r.data as Record<string, unknown> }}
        submitLabel="Save changes"
        defaultOwner={user.id}
        allowUnassigned={user.entityIds.length === 0}
      />
    </div>
  );
}
