"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useUIStore } from "@/store/ui";

export default function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const navPending = useUIStore((state) => state.navPending);
  const setNavPending = useUIStore((state) => state.setNavPending);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNavPending(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [pathname, searchParams?.toString(), setNavPending]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.getAttribute("target") === "_blank") return;
      if (anchor.dataset.navPending === "false") return;

      let url: URL;
      try {
        url = href.startsWith("http")
          ? new URL(href)
          : new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      setNavPending(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setNavPending(false);
      }, 4000);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [setNavPending]);

  useEffect(() => {
    const handler = (event: SubmitEvent) => {
      if (event.defaultPrevented) return;
      const form = event.target as HTMLFormElement | null;
      if (!form) return;
      if (form.dataset.navPending === "false") return;
      setNavPending(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setNavPending(false);
      }, 2500);
    };

    document.addEventListener("submit", handler, true);
    return () => document.removeEventListener("submit", handler, true);
  }, [setNavPending]);

  if (!navPending) return null;

  return (
    <div className="fixed top-0 left-0 z-[90] h-[2px] w-full bg-[color:var(--accent)] animate-pulse" />
  );
}
