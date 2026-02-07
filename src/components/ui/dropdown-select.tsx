"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type DropdownOption = {
  label: string;
  value: string;
};

type DropdownSelectProps = {
  name: string;
  options: DropdownOption[];
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  itemClassName?: string;
};

export default function DropdownSelect({
  name,
  options,
  defaultValue,
  placeholder = "Select",
  className,
  buttonClassName,
  menuClassName,
  itemClassName,
}: DropdownSelectProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const initial = useMemo(() => {
    const match = options.find((option) => option.value === defaultValue);
    return match ?? options[0] ?? null;
  }, [options, defaultValue]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DropdownOption | null>(initial);

  useEffect(() => {
    setSelected(initial);
  }, [initial]);

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

  return (
    <div ref={menuRef} className={`relative ${className ?? ""}`}>
      <input type="hidden" name={name} value={selected?.value ?? ""} />
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between border border-zinc-800 bg-transparent px-3 py-2 text-xs uppercase tracking-[0.3em] text-zinc-400 outline-none focus:border-[color:var(--accent)] ${buttonClassName ?? ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0 text-zinc-500" />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute left-0 mt-2 w-full border border-zinc-800 bg-zinc-950/95 text-xs uppercase tracking-[0.3em] text-zinc-400 shadow-lg backdrop-blur ${menuClassName ?? ""}`}
        >
          {options.map((option) => {
            const active = selected?.value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSelected(option);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-[color:var(--panel-bg)] ${active ? "text-[color:var(--accent)]" : ""} ${itemClassName ?? ""}`}
              >
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
