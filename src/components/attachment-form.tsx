"use client";

import { useState } from "react";

export function AttachmentForm({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    body.set("entityType", entityType);
    body.set("entityId", entityId);
    setPending(true);
    setError(null);
    const response = await fetch("/api/attachments", { method: "POST", body });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "The file could not be stored.");
      setPending(false);
      return;
    }
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <label>
        File
        <input type="file" name="file" required data-testid="attachment-file" />
      </label>
      <label>
        Note
        <input name="note" placeholder="What this file shows" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="btn secondary" type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Attach evidence"}
      </button>
    </form>
  );
}
