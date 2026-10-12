"use client";

import { useState } from "react";

export function LoginForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      setError(data.error ?? "Sign-in failed.");
      setPending(false);
      return;
    }
    window.location.href = next && next.startsWith("/") ? next : "/";
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <label>
        Work email
        <input name="email" type="email" required data-testid="login-email" autoComplete="username" />
      </label>
      <label>
        Password
        <input name="password" type="password" required data-testid="login-password" autoComplete="current-password" />
      </label>
      {error ? (
        <p className="form-error" data-testid="login-error">
          {error}
        </p>
      ) : null}
      <button className="btn" type="submit" disabled={pending} data-testid="login-submit">
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
