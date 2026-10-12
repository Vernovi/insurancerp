import Link from "next/link";
import PortalForm from "./PortalForm";

export default function Portal() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Report a concern anonymously</h1>
        <p className="mt-2 leading-relaxed text-ink-2">
          Use this form to report fraud, bribery, misconduct, unfair treatment of customers or any other wrongdoing. We don&apos;t record your name, email, IP address or device. You&apos;ll get a case key to check progress and talk to the investigator without revealing who you are.
        </p>
        <p className="mt-2 text-sm text-ink-2">Already reported something? <Link href="/portal/status" className="text-accent underline">Check your case</Link>.</p>
      </div>
      <PortalForm />
    </div>
  );
}
