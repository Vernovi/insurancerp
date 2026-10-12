export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-line px-6 py-4">
        <p className="font-semibold">{process.env.APP_NAME ?? "Vernovi GRC"}: speak up safely</p>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-10">{children}</main>
    </div>
  );
}
