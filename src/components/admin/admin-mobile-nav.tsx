"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import AdminNav from "@/components/admin/admin-nav";

type NavItem = { href: string; label: string };

export default function AdminMobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const original = document.body.style.overflow;
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  return (
    <div className="md:hidden -mx-8 -mt-8">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-950/90 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 border border-zinc-800 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-zinc-300"
          aria-label="Open admin navigation"
        >
          <Menu className="h-3 w-3" />
          Menu
        </button>
        <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-400">
          Admin Console
        </div>
        <Link
          href="/"
          className="border border-zinc-800 px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-zinc-300"
        >
          Home
        </Link>
      </div>

      <div
        className={`fixed inset-0 z-50 transition ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        <div
          ref={drawerRef}
          className={`absolute left-0 top-0 h-full w-72 max-w-[80%] border-r border-zinc-800 bg-zinc-950/95 p-6 transition-transform ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-[0.3em] text-zinc-400">
              Admin Console
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="border border-zinc-800 p-2 text-zinc-300"
              aria-label="Close admin navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <AdminNav items={items} />
        </div>
      </div>
    </div>
  );
}
