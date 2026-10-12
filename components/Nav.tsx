"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface NavItem { href: string; label: string; count?: number; match?: string[] }
export interface NavGroup { label: string; items: NavItem[] }

export default function Nav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const active = (i: NavItem) => (i.href === "/" ? path === "/" : path === i.href || path.startsWith(i.href + "/") || (i.match ?? []).some((m) => path.startsWith(m)));
  return (
    <nav aria-label="Main" className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-3 text-xs font-semibold text-white/45">{g.label}</p>
          <ul className="mt-1 space-y-0.5">
            {g.items.map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={active(i) ? "page" : undefined}
                  className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm ${active(i) ? "bg-white/12 text-white font-semibold" : "text-white/75 hover:bg-white/6 hover:text-white"}`}
                >
                  <span>{i.label}</span>
                  {i.count ? <span className="rounded bg-bad px-1.5 text-xs font-semibold text-white">{i.count}</span> : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
