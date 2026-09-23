"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/verify", label: "New Verification" },
  { href: "/history", label: "Verification History" },
  { href: "/references", label: "Reference Documents" },
  { href: "/settings", label: "Settings" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">DV</div>
          <div>
            <h1>DocVerify</h1>
            <p>Document matching</p>
          </div>
        </div>
        {LINKS.map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`nav-link ${active ? "active" : ""}`}>
              {l.label}
            </Link>
          );
        })}
        <div className="sidebar-foot">
          Verification engine is a replaceable heuristic PDF adapter. Connect production OCR/vision in{" "}
          <code>lib/verification-engine.ts</code>.
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
