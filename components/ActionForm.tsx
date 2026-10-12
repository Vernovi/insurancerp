"use client";
import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/app/actions";

export default function ActionForm({
  action,
  children,
  className,
  resetOnOk = true,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  resetOnOk?: boolean;
}) {
  const [state, run, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok && resetOnOk) ref.current?.reset();
  }, [state, resetOnOk]);
  return (
    <form ref={ref} action={run} className={className} aria-busy={pending}>
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {state?.error && <p role="alert" className="mt-2 text-sm text-bad">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 text-sm text-good break-all">{state.ok}</p>}
    </form>
  );
}
