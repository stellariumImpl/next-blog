"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export type Viewer = {
  email: string;
  role: "admin" | "user";
  name?: string | null;
  image?: string | null;
};

export default function UserMenu({
  viewer,
}: {
  viewer: Viewer | null;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonClasses =
    "flex items-center gap-2 border px-3 py-1 text-[10px] uppercase tracking-[0.3em] transition h-6 app-border text-[color:var(--app-text)] hover:bg-[color:var(--app-text)] hover:text-[color:var(--app-bg)]";
  const menuClasses =
    "absolute right-0 mt-3 w-48 border text-[10px] uppercase tracking-[0.3em] shadow-lg app-border card-bg text-[color:var(--app-text)]";
  const itemClasses =
    "flex items-center px-3 py-2 transition text-[color:var(--text-muted)] hover:text-[color:var(--app-text)] hover:bg-[color:var(--panel-bg)]";

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSignOut = async () => {
    setLoading(true);
    await authClient.signOut();
    window.location.href = "/";
  };

  if (!viewer) {
    return (
      <Link href="/sign-in" className={`${buttonClasses} justify-center`}>
        Sign In
      </Link>
    );
  }

  const displayName = viewer.name || viewer.email;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={buttonClasses}
      >
        <span className="max-w-[120px] truncate">{displayName}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <div className={menuClasses}>
          <Link
            href="/submit"
           
            className={itemClasses}
            onClick={() => setOpen(false)}
          >
            Submit Article
          </Link>
          <Link
            href="/account"
           
            className={itemClasses}
            onClick={() => setOpen(false)}
          >
            Account
          </Link>
          {viewer.role === "admin" && (
            <Link
              href="/admin"
             
              className={itemClasses}
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          )}
          <button
            type="button"
            disabled={loading}
            onClick={handleSignOut}
            className={`${itemClasses} w-full disabled:opacity-60`}
          >
            {loading ? "Signing out" : "Sign Out"}
          </button>
        </div>
      )}
    </div>
  );
}
