"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

export default function AdminNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="mt-6 space-y-2 text-sm">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded px-3 py-2 transition-colors ${
              isActive
                ? "bg-zinc-900 text-white border border-zinc-700"
                : "text-zinc-300 hover:text-white hover:bg-zinc-900"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
