import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { getDb, schema } from "@/lib/db";
import { fmtDate, fmtDateTime } from "@/lib/format";
import ActionForm from "@/components/ActionForm";
import { portalMessage } from "@/app/actions";

const STATUS: Record<string, string> = { reported: "Received", triaged: "Being assessed", investigating: "Under investigation", findings: "Investigation concluding", closed: "Closed" };

export default async function PortalStatus({ searchParams }: { searchParams: Promise<{ key?: string }> }) {
  const { key } = await searchParams;
  let content: React.ReactNode = null;
  if (key) {
    const db = await getDb();
    const h = createHash("sha256").update(key.trim().toUpperCase()).digest("hex");
    const [rec] = await db.select().from(schema.records).where(and(eq(schema.records.typeKey, "case"), sql`${schema.records.data}->>'reporter_key_hash' = ${h}`));
    if (!rec) {
      content = <p role="alert" className="text-bad">That case key wasn&apos;t recognised. Check it and try again.</p>;
    } else {
      const msgs = await db.select().from(schema.comments).where(and(eq(schema.comments.recordId, rec.id), eq(schema.comments.channel, "reporter"))).orderBy(schema.comments.createdAt);
      content = (
        <div className="space-y-4">
          <p>Reported {fmtDate((rec.data as Record<string, unknown>).reported_date)}. Status: <strong>{STATUS[rec.status] ?? rec.status}</strong>.</p>
          <ul className="space-y-3">
            {msgs.map((m) => (
              <li key={m.id} className={`rounded-md p-3 text-sm ${m.authorId ? "bg-accent-soft mr-8" : "bg-canvas ml-8"}`}>
                <p className="text-xs text-ink-3">{m.authorId ? "Investigator" : "You"}, {fmtDateTime(m.createdAt)}</p>
                <p className="mt-1 whitespace-pre-line">{m.body}</p>
              </li>
            ))}
            {msgs.length === 0 && <li className="text-sm text-ink-2">No messages yet.</li>}
          </ul>
          <ActionForm action={portalMessage} className="space-y-2">
            <input type="hidden" name="key" value={key} />
            <textarea name="body" rows={3} required className="field-input" aria-label="Message to the investigator" />
            <button className="btn btn-primary">Send message</button>
          </ActionForm>
        </div>
      );
    }
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Check your case</h1>
      <form className="flex gap-2">
        <label className="sr-only" htmlFor="key">Case key</label>
        <input id="key" name="key" defaultValue={key} placeholder="XXXX-XXXX-XXXX" className="field-input" required />
        <button className="btn btn-primary">Open</button>
      </form>
      {content}
    </div>
  );
}
