"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/sleep", label: "Sleep" },
  { href: "/readiness", label: "Readiness" },
];

/** Sub-tab pills for the Recovery section, mirroring TrainSubnav. */
export function RecoverySubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-2xl border border-surface-raised bg-surface p-1" aria-label="Recovery views">
      {TABS.map((tab) => {
        const active = pathname?.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 rounded-xl py-2 text-center text-xs font-semibold transition-colors duration-200 ${
              active ? "bg-surface-raised text-accent" : "text-muted hover:text-fg"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
