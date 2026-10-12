"use client";

import { useState } from "react";

export function JsonForm({
  action,
  method = "POST",
  submitLabel,
  children,
  successHref,
}: {
  action: string;
  method?: "POST" | "PATCH";
  submitLabel: string;
  children: React.ReactNode;
  successHref?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = Object.fromEntries(new FormData(form).entries());
    setPending(true);
    setError(null);
    const response = await fetch(action, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(raw),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "The form could not be saved.");
      setPending(false);
      return;
    }
    if (successHref) window.location.href = successHref;
    else window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      {children}
      {error ? <p className="form-error">{error}</p> : null}
      <div>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
