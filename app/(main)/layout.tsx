"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SyncStatus } from "@/components/sync/SyncStatus";

const NAV = [
  { href: "/dashboard", label: "Dash" },
  { href: "/train/templates", label: "Train" },
  { href: "/food/log", label: "Food" },
  { href: "/body/photos", label: "Body" },
  { href: "/mobility", label: "Mobility" },
  { href: "/settings", label: "Settings" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-bg pb-24">
      <SyncStatus />
      {children}
      <nav className="fixed bottom-4 left-4 right-4 flex justify-around rounded-2xl border border-surface-raised bg-surface/95 py-2 backdrop-blur">
        {NAV.map((item) => {
          const active = pathname?.startsWith(`/${item.href.split("/")[1]}`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-xl px-3 py-1.5 text-xs font-medium ${
                active ? "bg-accent text-bg shadow-[0_0_12px_-2px_var(--accent)]" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
