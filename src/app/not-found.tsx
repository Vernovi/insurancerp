import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <h1>That record is not in the register.</h1>
      <p>
        <Link href="/">Back to the dashboard</Link>
      </p>
    </main>
  );
}
