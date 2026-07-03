import Link from "next/link";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/train/templates", label: "Train" },
  { href: "/food/log", label: "Food" },
  { href: "/body/photos", label: "Body" },
  { href: "/mobility", label: "Mobility" },
  { href: "/settings", label: "Settings" },
];

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16">
      {children}
      <nav className="fixed bottom-0 left-0 right-0 flex justify-around border-t border-neutral-200 bg-white py-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="px-2 py-1 text-xs text-neutral-600"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
