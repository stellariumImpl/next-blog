"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, User } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export type Viewer = {
  email: string;
  role: "admin" | "user";
  name?: string | null;
  image?: string | null;
};

export default function UserMenu({
  viewer,
  hardNavigate = false,
}: {
  viewer: Viewer | null;
  hardNavigate?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonClasses =
    "flex items-center gap-1 md:gap-2 border px-2 md:px-3 py-1 text-[10px] uppercase tracking-[0.3em] transition h-6 app-border text-[color:var(--app-text)] hover:bg-[color:var(--app-text)] hover:text-[color:var(--app-bg)]";
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
    const SignInLink = hardNavigate ? "a" : Link;
    return (
      <SignInLink
        href="/sign-in"
        className={`${buttonClasses} justify-center`}
        aria-label="Sign In"
      >
        <User className="h-3 w-3 md:hidden" />
        <span className="hidden md:inline">Sign In</span>
      </SignInLink>
    );
  }

  const displayName = viewer.name || viewer.email;

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={buttonClasses}
        aria-label="User menu"
      >
        <User className="h-3 w-3 md:hidden" />
        <span className="hidden md:inline max-w-[120px] truncate">
          {displayName}
        </span>
        <ChevronDown className="h-3 w-3 hidden md:inline" />
      </button>

      {open && (
        <div className={menuClasses}>
          {hardNavigate ? (
            <a href="/submit" className={itemClasses} onClick={() => setOpen(false)}>
              Submit Article
            </a>
          ) : (
            <Link href="/submit" className={itemClasses} onClick={() => setOpen(false)}>
              Submit Article
            </Link>
          )}
          {hardNavigate ? (
            <a href="/account" className={itemClasses} onClick={() => setOpen(false)}>
              Account
            </a>
          ) : (
            <Link href="/account" className={itemClasses} onClick={() => setOpen(false)}>
              Account
            </Link>
          )}
          {viewer.role === "admin" &&
            (hardNavigate ? (
              <a href="/admin" className={itemClasses} onClick={() => setOpen(false)}>
                Admin
              </a>
            ) : (
              <Link href="/admin" className={itemClasses} onClick={() => setOpen(false)}>
                Admin
              </Link>
            ))}
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
