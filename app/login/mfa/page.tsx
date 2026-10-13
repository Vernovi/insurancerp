import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import QRCode from "qrcode";
import { getDb, schema } from "@/lib/db";
import { readPending, MFA_COOKIE } from "@/lib/auth/session";
import { otpauthUri } from "@/lib/auth/totp";
import MfaForm from "./MfaForm";

export const dynamic = "force-dynamic";

export default async function MfaPage() {
  const pending = await readPending((await cookies()).get(MFA_COOKIE)?.value);
  if (!pending) redirect("/login");
  const db = await getDb();
  const [u] = await db.select().from(schema.users).where(eq(schema.users.id, pending.uid));
  if (!u || u.email !== pending.em || !u.totpSecret) redirect("/login");
  const appName = process.env.APP_NAME ?? "Vernovi GRC";
  const enrol = pending.stage === "enrol";
  const qr = enrol ? await QRCode.toString(otpauthUri(u.totpSecret, u.email, appName), { type: "svg", margin: 1, width: 192 }) : null;
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-4 sm:p-10">
      <div className="w-full max-w-md rounded-md border border-line bg-surface p-6 sm:p-8">
        <h1 className="text-xl font-semibold">{enrol ? "Set up two-step sign-in" : "Enter your sign-in code"}</h1>
        {enrol ? (
          <>
            <p className="mt-2 text-sm text-ink-2">Your account needs an authenticator app (Microsoft Authenticator, Google Authenticator, 1Password or similar). Scan the code, then enter the 6-digit number it shows.</p>
            <div className="mt-4 flex justify-center rounded-md border border-line bg-white p-3" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: qr! }} />
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-ink-2">Can&apos;t scan? Enter this key instead</summary>
              <p className="mt-2 break-all rounded bg-canvas px-2 py-1 font-mono text-sm" data-testid="totp-secret">{u.totpSecret.match(/.{1,4}/g)!.join(" ")}</p>
            </details>
          </>
        ) : (
          <p className="mt-2 text-sm text-ink-2">Open your authenticator app and enter the 6-digit code for {u.email}.</p>
        )}
        <MfaForm submitLabel={enrol ? "Confirm and sign in" : "Sign in"} />
        <p className="mt-4 text-xs text-ink-3">Lost your device? Ask a platform administrator to reset your two-step sign-in.</p>
      </div>
    </main>
  );
}
