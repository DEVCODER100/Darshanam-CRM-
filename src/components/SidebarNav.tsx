"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  ["/dashboard", "Dashboard"],
  ["/customers", "Customers"],
  ["/bookings", "Bookings"],
  ["/stages", "Stages"],
  ["/calendar", "Calendar"],
  ["/reports", "Reports"],
  ["/audit", "Audit"],
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {ITEMS.map(([href, label]) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={`relative rounded-md px-3 py-2 text-sm transition ${
              active
                ? "bg-surface/10 font-medium text-white"
                : "text-white/65 hover:bg-surface/5 hover:text-white"
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-full border-l-2 border-brass" />
            )}
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
