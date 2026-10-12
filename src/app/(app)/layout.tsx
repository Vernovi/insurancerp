import { redirect } from "next/navigation";
import { Shell } from "@/components/shell";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Shell user={session}>{children}</Shell>;
}
