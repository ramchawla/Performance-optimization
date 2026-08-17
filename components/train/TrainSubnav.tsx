"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/train/templates", label: "Templates" },
  { href: "/train/history", label: "History" },
  { href: "/train/cardio", label: "Cardio" },
];

/** Sub-tab pills for the Train section, mirroring FoodSubnav. */
export function TrainSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-2xl border border-surface-raised bg-surface p-1" aria-label="Train views">
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
