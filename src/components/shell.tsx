"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROLE_LABEL, type Role } from "@/lib/domain";

const GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard" },
      { href: "/board", label: "Risk Committee" },
    ],
  },
  {
    label: "Risk",
    items: [
      { href: "/risks", label: "Risk register" },
      { href: "/risks/heatmap", label: "Heat map" },
      { href: "/appetite", label: "Appetite" },
      { href: "/kris", label: "KRIs" },
      { href: "/controls", label: "Controls" },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/policies", label: "Policies" },
      { href: "/attestations", label: "Attestation" },
      { href: "/compliance", label: "Frameworks" },
      { href: "/actions", label: "Actions" },
      { href: "/findings", label: "Findings" },
      { href: "/declarations", label: "Declarations" },
    ],
  },
  {
    label: "People",
    items: [
      { href: "/performance", label: "Performance" },
      { href: "/audit", label: "Audit trail" },
      { href: "/people", label: "People" },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/risks") return pathname === "/risks" || /^\/risks\/(?!heatmap$)[^/]+/.test(pathname) || pathname === "/risks/new";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({
  user,
  children,
}: {
  user: { name: string; email: string; role: Role };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="shell" data-testid="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">IR</div>
          <div>
            <strong>InsuranceRP</strong>
            <small>Vernovi</small>
          </div>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.label} className="nav" aria-label={group.label}>
            <div className="nav-label">{group.label}</div>
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className={isActive(pathname, item.href) ? "active" : ""} data-testid={`nav-${item.href.replaceAll("/", "") || "home"}`}>
                {item.label}
              </Link>
            ))}
          </nav>
        ))}
        <div className="who">
          <strong>{user.name}</strong>
          <span>{ROLE_LABEL[user.role]}</span>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <div className="company">
            <strong>Harbourline Assurance Plc</strong>
            <div>Multi-line · motor, property, marine, energy, health, life</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button className="btn secondary" type="submit">
              Sign out
            </button>
          </form>
        </div>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
