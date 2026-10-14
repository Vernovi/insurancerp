import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { requireUser } from "@/lib/auth/current";
import { getDb, schema } from "@/lib/db";
import { mfaMandatory, otpauthUri } from "@/lib/auth/totp";
import { getMfaPolicy } from "@/lib/auth/policy";
import { ROLE_LABELS, type Role } from "@/lib/defs/types";
import { loadEntities } from "@/lib/scope";
import ActionForm from "@/components/ActionForm";
import { confirmMfaSetup, disableOwnMfa, startMfaSetup } from "@/app/actions";

export default async function Account() {
  const user = await requireUser();
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, user.id));
  const ents = await loadEntities();
  const mandatory = mfaMandatory({ roles: user.roles, mfaRequired: u.mfaRequired }, await getMfaPolicy());
  const settingUp = !u.mfaEnabled && !!u.totpSecret;
  const qr = settingUp ? await QRCode.toString(otpauthUri(u.totpSecret!, u.email, process.env.APP_NAME ?? "Vernovi GRC"), { type: "svg", margin: 1, width: 176 }) : null;
  const myEntities = ents.filter((e) => user.entityIds.includes(e.id));
  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
        <p className="mt-1 text-ink-2">{user.name}, {user.title}</p>
      </header>
      <section className="rounded-md border border-line bg-surface p-5 text-sm">
        <h2 className="text-base font-semibold">Access</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          <div><dt className="text-xs font-semibold text-ink-3">Email</dt><dd>{user.email}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-3">Line of defence</dt><dd>{user.lineOfDefence ?? "Not set"}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-3">Roles</dt><dd>{user.roles.map((r) => ROLE_LABELS[r as Role] ?? r).join(", ")}</dd></div>
          <div><dt className="text-xs font-semibold text-ink-3">Entities</dt><dd>{myEntities.length ? myEntities.map((e) => e.name).join(", ") : "Group-wide (no walled entities)"}</dd></div>
        </dl>
        <p className="mt-3 text-xs text-ink-3">You see records of the entities listed here only. If none are listed, you see every entity except walled ones, and records that have no entity. Records you own or raised stay hidden when they sit outside that scope. An administrator manages your access.</p>
      </section>
      <section className="rounded-md border border-line bg-surface p-5 text-sm" aria-labelledby="mfa-h">
        <h2 id="mfa-h" className="text-base font-semibold">Two-step sign-in</h2>
        {u.mfaEnabled ? (
          <>
            <p className="mt-2"><span className="rounded bg-good-soft px-1.5 py-0.5 text-xs font-semibold text-good">On</span> You enter a code from your authenticator app each time you sign in.</p>
            {mandatory ? (
              <p className="mt-2 text-ink-3">Required for your account{user.roles.includes("admin") ? " because you are an administrator" : " by an administrator"}.</p>
            ) : (
              <form action={disableOwnMfa} className="mt-3"><button className="btn btn-danger">Turn off two-step sign-in</button></form>
            )}
          </>
        ) : settingUp ? (
          <>
            <p className="mt-2 text-ink-2">Scan this with your authenticator app, then enter the 6-digit code it shows.</p>
            <div className="mt-3 inline-flex rounded-md border border-line bg-white p-2" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: qr! }} />
            <p className="mt-2 break-all font-mono text-xs text-ink-2" data-testid="totp-secret">{u.totpSecret!.match(/.{1,4}/g)!.join(" ")}</p>
            <ActionForm action={confirmMfaSetup} className="mt-3 flex flex-wrap items-end gap-2" resetOnOk={false}>
              <label className="block"><span className="font-semibold">Code</span><input name="code" inputMode="numeric" autoComplete="one-time-code" required className="field-input mt-1 w-36 font-mono" /></label>
              <button className="btn btn-primary">Turn on</button>
            </ActionForm>
          </>
        ) : (
          <>
            <p className="mt-2 text-ink-2">{mandatory ? "Required for your account. " : ""}Protect your account with a code from an authenticator app as well as your password.</p>
            <form action={startMfaSetup} className="mt-3"><button className="btn btn-primary">Set up two-step sign-in</button></form>
          </>
        )}
      </section>
    </div>
  );
}
