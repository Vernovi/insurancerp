"use client";
import { useActionState } from "react";
import { login } from "@/app/actions";

export default function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="text-sm font-semibold">Email</span>
        <input name="email" type="email" autoComplete="username" required className="field-input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-semibold">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="field-input mt-1" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-bad">{state.error}</p>}
      <button className="btn btn-primary w-full justify-center" disabled={pending}>{pending ? "Signing in" : "Sign in"}</button>
    </form>
  );
}
