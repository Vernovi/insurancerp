"use client";
import { useActionState, useState } from "react";
import { transitionAction } from "@/app/actions";

export interface TransitionOption {
  key: string;
  label: string;
  blocked: string | null;
  commentRequired: boolean;
  primary: boolean;
}

export default function TransitionBar({ id, options }: { id: number; options: TransitionOption[] }) {
  const [state, run, pending] = useActionState(transitionAction, undefined);
  const [chosen, setChosen] = useState<string | null>(null);
  const available = options.filter((o) => !o.blocked);
  const blocked = options.filter((o) => o.blocked);
  const sel = options.find((o) => o.key === chosen);
  if (options.length === 0) return null;
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <h2 className="text-sm font-semibold">Next steps</h2>
      {available.length === 0 && <p className="mt-1 text-sm text-ink-2">Nothing for you to do at this stage.</p>}
      <form action={run} className="mt-2">
        <input type="hidden" name="id" value={id} />
        <div className="flex flex-wrap gap-2">
          {available.map((o) => (
            <button
              key={o.key}
              type={o.commentRequired ? "button" : "submit"}
              name={o.commentRequired ? undefined : "key"}
              value={o.commentRequired ? undefined : o.key}
              formNoValidate={!o.commentRequired}
              onClick={() => setChosen(o.key)}
              disabled={pending}
              className={`btn ${o.primary ? "btn-primary" : ["return", "reject", "cancel", "withdraw", "withdraw_draft"].includes(o.key) ? "btn-danger" : "btn-secondary"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {sel && sel.commentRequired && (
          <div className="mt-3">
            <label htmlFor="comment" className="text-sm font-semibold">
              Reason for &ldquo;{sel.label}&rdquo; (required)
            </label>
            <textarea id="comment" name="comment" rows={2} className="field-input mt-1" required />
            <button className="btn btn-primary mt-2" name="key" value={sel.key} disabled={pending}>
              Confirm: {sel.label}
            </button>
          </div>
        )}
      </form>
      {state?.error && <p role="alert" className="mt-2 text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 text-sm text-good">{state.ok}</p>}
      {blocked.length > 0 && (
        <details className="mt-3 text-sm text-ink-2">
          <summary className="cursor-pointer">Why can't I do the other steps?</summary>
          <ul className="mt-1 list-disc pl-5">
            {blocked.map((b) => (
              <li key={b.key}>{b.blocked}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
