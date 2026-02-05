"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteTransition() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeyRef = useRef("");

  useEffect(() => {
    const key = `${pathname}?${searchParams?.toString() ?? ""}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    setActive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActive(false);
    }, 260);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pathname, searchParams]);

  return (
    <div
      aria-hidden
      className={`route-transition ${active ? "route-transition-active" : ""}`}
    />
  );
}
