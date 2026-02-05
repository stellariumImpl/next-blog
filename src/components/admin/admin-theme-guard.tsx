"use client";

import { useEffect, useRef } from "react";

export default function AdminThemeGuard() {
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    previous.current = root.dataset.theme ?? null;
    root.dataset.theme = "dark";
    root.style.colorScheme = "dark";
    return () => {
      if (previous.current) {
        root.dataset.theme = previous.current;
      } else {
        delete root.dataset.theme;
      }
      root.style.colorScheme = "";
    };
  }, []);

  return null;
}
