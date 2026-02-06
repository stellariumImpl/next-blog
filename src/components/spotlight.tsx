"use client";

import { useEffect } from "react";

export default function Spotlight() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("spotlight-on");
    const applyTheme = () => {
      if (root.dataset.theme === "dark") {
        root.classList.add("spotlight-dark");
      } else {
        root.classList.remove("spotlight-dark");
      }
    };
    applyTheme();
    const observer = new MutationObserver(applyTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    const handleMove = (event: MouseEvent) => {
      root.style.setProperty("--spot-x", `${event.clientX}px`);
      root.style.setProperty("--spot-y", `${event.clientY}px`);
    };
    const handleLeave = () => {
      root.style.setProperty("--spot-x", "50%");
      root.style.setProperty("--spot-y", "40%");
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("mouseleave", handleLeave);
    return () => {
      observer.disconnect();
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseleave", handleLeave);
      root.classList.remove("spotlight-on");
      root.classList.remove("spotlight-dark");
    };
  }, []);

  return null;
}
