import Link from "next/link";
import { AttachmentForm } from "@/components/attachment-form";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";

export async function RecordPanels({
  entityType,
  entityId,
  canUpload,
}: {
  entityType: string;
  entityId: string;
  canUpload: boolean;
}) {
  const [files, events] = await Promise.all([
    prisma.attachment.findMany({
      where: { entityType, entityId },
      include: { uploader: true },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.auditEvent.findMany({
      where: { entityType, entityId },
      orderBy: { at: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="stack">
      <section className="card">
        <h2>Evidence</h2>
        {files.length === 0 ? <p className="muted">No file attached yet.</p> : null}
        <ul className="list">
          {files.map((file) => (
            <li key={file.id}>
              <Link href={`/api/attachments/${file.id}`}>{file.fileName}</Link>
              <div className="muted">
                {file.note} · {file.uploader.name} · {formatDateTime(file.uploadedAt)}
              </div>
            </li>
          ))}
        </ul>
        {canUpload ? <AttachmentForm entityType={entityType} entityId={entityId} /> : null}
      </section>
      <section className="card">
        <h2>Audit trail</h2>
        {events.length === 0 ? <p className="muted">No events yet.</p> : null}
        <ul className="list">
          {events.map((event) => (
            <li key={event.id}>
              <strong>{event.action}</strong> · {event.summary}
              <div className="muted">
                {event.actorName} · {formatDateTime(event.at)}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
