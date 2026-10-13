/** Honest statement of where the trial runs. Keep in step with NFR-01 in the PRD. */
export const HOSTING_NOTE =
  "Trial hosted in the UK (London) on fictional data. Nigeria data residency and the NDPA cross-border transfer basis are settled before go-live.";

export default function HostingNote({ className = "" }: { className?: string }) {
  return <p className={className}>{HOSTING_NOTE}</p>;
}
