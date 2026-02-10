"use client";

import { useEffect, useMemo, useState } from "react";
import type { HeadingItem } from "@/lib/markdown";
import { List, X } from "lucide-react";

export default function PostTocDrawer({
  headings,
  open,
  onClose,
  isDark,
}: {
  headings: HeadingItem[];
  open: boolean;
  onClose: () => void;
  isDark: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const items = useMemo(() => headings ?? [], [headings]);

  useEffect(() => {
    if (!open || !items.length) return;
    const elements = items
      .map((item) => document.getElementById(item.id))
      .filter(Boolean) as HTMLElement[];
    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0.1, 0.25, 0.5] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items, open]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    onClose();
  };

  if (!open || !items.length) return null;

  return (
    <div
      className={`fixed inset-0 z-[95] md:hidden ${
        isDark ? "bg-black/70" : "bg-black/30"
      }`}
      onClick={onClose}
    >
      <div
        className={`absolute right-0 top-0 h-full w-[88%] max-w-[360px] border-l app-border panel-bg p-4`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] app-muted">
            <List className="h-3 w-3" />
            On this page
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center h-7 w-8 border app-border"
            aria-label="Close table of contents"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-2 max-h-[calc(100vh-96px)] overflow-y-auto pr-1">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className={`block w-full text-left text-sm transition ${
                activeId === item.id
                  ? "text-[color:var(--accent)]"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--app-text)]"
              }`}
              style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
            >
              {item.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
