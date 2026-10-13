"use client";
import { useActionState } from "react";
import { verifyMfaLogin } from "@/app/actions";

export default function MfaForm({ submitLabel }: { submitLabel: string }) {
  const [state, action, pending] = useActionState(verifyMfaLogin, undefined);
  return (
    <form action={action} className="mt-5 space-y-3">
      <label className="block">
        <span className="text-sm font-semibold">6-digit code</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required autoFocus className="field-input mt-1 font-mono text-lg tracking-widest" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Checking" : submitLabel}</button>
      <a href="/login" className="block text-center text-sm text-ink-2 hover:text-accent">Start again</a>
    </form>
  );
}
