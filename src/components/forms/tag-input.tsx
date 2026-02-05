"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";

const chipClass =
  "inline-flex items-center gap-2 border border-[#00ff41]/40 px-2 py-1 text-[10px] uppercase tracking-[0.3em] text-[#00ff41] hover:border-[#00ff41] transition";

const normalizeTag = (value: string, maxLength: number) =>
  value.trim().replace(/\s+/g, " ").slice(0, maxLength);

type TagInputProps = {
  value: string[];
  onChange: (next: string[]) => void;
  name?: string;
  providedName?: string;
  label?: string;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  disabled?: boolean;
};

export default function TagInput({
  value,
  onChange,
  name = "tagNames",
  providedName,
  label = "Tags",
  placeholder = "Type a tag, press Enter",
  hint,
  maxLength = 64,
  disabled = false,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const normalized = useMemo(
    () => value.map((tag) => tag.toLowerCase()),
    [value],
  );
  const providedField = providedName ?? `${name}Provided`;

  useEffect(() => {
    setInput("");
  }, [value.length]);

  const addTag = (raw: string) => {
    const next = normalizeTag(raw, maxLength);
    if (!next) return;
    if (normalized.includes(next.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...value, next]);
    setInput("");
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-[0.3em] app-muted">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-2 border app-border bg-transparent px-3 py-2 text-sm focus-within:border-[var(--app-text)]">
        {value.map((tag) => (
          <span key={tag} className={chipClass}>
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-[#00ff41] hover:text-[color:var(--app-text)]"
              aria-label={`Remove ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
            <input type="hidden" name={name} value={tag} />
          </span>
        ))}
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addTag(input);
            }
            if (event.key === "Backspace" && input.length === 0 && value.length) {
              event.preventDefault();
              removeTag(value[value.length - 1]);
            }
          }}
          onBlur={() => addTag(input)}
          placeholder={placeholder}
          disabled={disabled}
          className="min-w-[160px] flex-1 bg-transparent text-sm outline-none placeholder:text-[color:var(--text-muted-strong)]"
        />
        <input type="hidden" name={providedField} value="1" />
      </div>
      {hint && <p className="text-xs app-muted">{hint}</p>}
    </div>
  );
}
