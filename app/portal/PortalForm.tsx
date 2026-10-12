"use client";
import { useActionState } from "react";
import { portalSubmit } from "@/app/actions";

export default function PortalForm() {
  const [state, run, pending] = useActionState(portalSubmit, undefined);
  if (state?.ok && state.ok !== "Thank you.") {
    return (
      <div className="rounded-md border border-good bg-good-soft p-5">
        <h2 className="text-lg font-semibold text-good">Your report has been received</h2>
        <p className="mt-2">Write down this case key. It is the only way to check progress or reply to the investigator, and we can&apos;t recover it for you.</p>
        <p className="mt-3 text-2xl font-semibold tracking-wider">{state.ok}</p>
        <p className="mt-3 text-sm">We aim to acknowledge reports within 7 days. <a href="/portal/status" className="underline">Check your case</a>.</p>
      </div>
    );
  }
  return (
    <form action={run} className="space-y-4">
      <label className="block">
        <span className="text-sm font-semibold">What is it about?</span>
        <select name="category" className="field-input mt-1">
          <option>Fraud or theft</option>
          <option>Bribery or a conflict of interest</option>
          <option>Unfair treatment of a customer</option>
          <option>Money laundering</option>
          <option>Health and safety</option>
          <option>Harassment or discrimination</option>
          <option>Something else</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Short summary</span>
        <input name="subject" maxLength={200} className="field-input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">What happened?</span>
        <textarea name="description" rows={8} required minLength={20} className="field-input mt-1" />
        <span className="mt-1 block text-xs text-ink-3">Include when and where, who was involved, and how you know. Leave out anything that would identify you if you want to stay anonymous.</span>
      </label>
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Sending" : "Send report"}</button>
    </form>
  );
}
