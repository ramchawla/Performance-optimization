"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/food/log", label: "Log" },
  { href: "/food/search", label: "Library" },
  { href: "/food/recipes", label: "Recipes" },
];

/** Sub-tab pills for the three food pages — mirrors the kinetic mockup's
 * subnav so Library/Recipes are reachable without typing a URL. */
export function FoodSubnav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 rounded-2xl border border-surface-raised bg-surface p-1" aria-label="Food views">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
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
