"use client";

import { useEffect, useMemo, useState } from "react";
import type { HeadingItem } from "@/lib/markdown";
import { List } from "lucide-react";

export default function PostToc({ headings }: { headings: HeadingItem[] }) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const items = useMemo(() => headings ?? [], [headings]);

  useEffect(() => {
    if (!items.length) return;
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
  }, [items]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!items.length) return null;

  return (
    <>
      <div className="xl:hidden border app-border panel-bg p-4">
        <details>
          <summary className="flex cursor-pointer items-center gap-2 text-xs uppercase tracking-[0.3em] app-muted">
            <List className="h-3 w-3" />
            On this page
          </summary>
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollTo(item.id)}
                className={`block text-left text-sm transition ${
                  activeId === item.id
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--text-muted)]"
                }`}
                style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
              >
                {item.text}
              </button>
            ))}
          </div>
        </details>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-24 border-l app-border pl-6">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.4em] app-muted">
            <List className="h-3 w-3" />
            On this page
          </div>
          <div className="mt-4 space-y-2">
            {items.map((item) => {
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  className={`group relative flex w-full items-center gap-2 text-left text-sm transition ${
                    active
                      ? "text-[color:var(--accent)]"
                      : "text-[color:var(--text-muted)] hover:text-[color:var(--app-text)]"
                  }`}
                  style={{ paddingLeft: `${(item.level - 2) * 12}px` }}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full border transition ${
                      active
                        ? "border-[color:var(--accent)] bg-[color:var(--accent)] shadow-[0_0_8px_var(--accent)]"
                        : "border-[color:var(--border)] bg-transparent group-hover:border-[color:var(--accent)]"
                    }`}
                  />
                  <span className="truncate">{item.text}</span>
                  <span
                    className={`absolute -left-6 top-1/2 h-8 w-[2px] -translate-y-1/2 transition ${
                      active
                        ? "bg-[color:var(--accent)] shadow-[0_0_12px_var(--accent)]"
                        : "bg-transparent"
                    }`}
                  />
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
