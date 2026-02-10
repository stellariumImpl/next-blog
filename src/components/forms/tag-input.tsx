"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { liteClient } from "algoliasearch/lite";

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
  const [matches, setMatches] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounceRef = useRef<number | null>(null);
  const normalized = useMemo(
    () => value.map((tag) => tag.toLowerCase()),
    [value],
  );
  const providedField = providedName ?? `${name}Provided`;

  const algoliaAppId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? "";
  const algoliaSearchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? "";
  const algoliaIndexName = process.env.NEXT_PUBLIC_ALGOLIA_TAGS_INDEX ?? "tags";
  const algoliaEnabled = Boolean(
    algoliaAppId && algoliaSearchKey && algoliaIndexName,
  );
  const algoliaClient = useMemo(() => {
    if (!algoliaEnabled) return null;
    return liteClient(algoliaAppId, algoliaSearchKey);
  }, [algoliaAppId, algoliaEnabled, algoliaSearchKey]);

  const candidates = useMemo(() => {
    const seen = new Set<string>();
    return matches.filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return !normalized.includes(key);
    });
  }, [matches, normalized]);

  const suggestion = useMemo(() => {
    const needle = input.trim().toLowerCase();
    if (!needle) return "";
    const next = candidates.find(
      (tag) =>
        tag.toLowerCase().startsWith(needle) &&
        !normalized.includes(tag.toLowerCase()),
    );
    return next ?? "";
  }, [candidates, input, normalized]);

  const dropdownOpen = useMemo(() => {
    if (!input.trim()) return false;
    if (candidates.length > 1) return true;
    if (candidates.length === 1 && !suggestion) return true;
    return false;
  }, [candidates.length, input, suggestion]);

  useEffect(() => {
    setInput("");
  }, [value.length]);

  useEffect(() => {
    if (!algoliaEnabled || !algoliaClient) return;
    const query = input.trim();
    if (!query) {
      setMatches([]);
      setActiveIndex(0);
      return;
    }

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(async () => {
      try {
        const results = (await algoliaClient.search<{
          name?: string;
        }>({
          requests: [
            {
              indexName: algoliaIndexName,
              query,
              hitsPerPage: 8,
              attributesToRetrieve: ["name", "slug"],
            },
          ],
        })) as { results?: Array<{ hits?: Array<{ name?: string }> }> };
        const hits = results.results?.[0]?.hits ?? [];
        const names = hits
          .map((hit) => String(hit.name ?? ""))
          .filter(Boolean);
        setMatches(names);
        setActiveIndex(0);
      } catch {
        setMatches([]);
        setActiveIndex(0);
      }
    }, 260);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [algoliaClient, algoliaEnabled, algoliaIndexName, input]);

  const addTag = (raw: string) => {
    const next = normalizeTag(raw, maxLength);
    if (!next) return;
    if (normalized.includes(next.toLowerCase())) {
      setInput("");
      return;
    }
    onChange([...value, next]);
    setInput("");
    setMatches([]);
    setActiveIndex(0);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((item) => item !== tag));
  };

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-[0.3em] app-muted">
        {label}
      </label>
      <div className="relative flex flex-wrap items-center gap-2 border app-border bg-transparent px-3 py-2 text-sm focus-within:border-[var(--app-text)]">
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
        <div className="relative min-w-[160px] flex-1">
          {suggestion && (
            <div className="pointer-events-none absolute inset-0 flex items-center text-sm text-[color:var(--text-muted-strong)]">
              <span className="invisible">{input}</span>
              <span>{suggestion.slice(input.length)}</span>
            </div>
          )}
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && candidates.length > 0) {
                event.preventDefault();
                setActiveIndex((prev) => (prev + 1) % candidates.length);
                return;
              }
              if (event.key === "ArrowUp" && candidates.length > 0) {
                event.preventDefault();
                setActiveIndex((prev) =>
                  prev === 0 ? candidates.length - 1 : prev - 1,
                );
                return;
              }
              if (event.key === "Tab") {
                if (suggestion) {
                  event.preventDefault();
                  addTag(suggestion);
                  return;
                }
                if (dropdownOpen && candidates[activeIndex]) {
                  event.preventDefault();
                  addTag(candidates[activeIndex]);
                  return;
                }
              }
              if (event.key === "Enter") {
                event.preventDefault();
                if (dropdownOpen && candidates[activeIndex]) {
                  addTag(candidates[activeIndex]);
                } else {
                  addTag(input);
                }
              }
              if (
                event.key === "Backspace" &&
                input.length === 0 &&
                value.length
              ) {
                event.preventDefault();
                removeTag(value[value.length - 1]);
              }
            }}
            onBlur={() => {
              if (!dropdownOpen && input.trim()) {
                addTag(input);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className="relative z-10 w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--text-muted-strong)]"
          />
          {dropdownOpen && candidates.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 border app-border bg-[color:var(--panel-bg)]/95 backdrop-blur-sm shadow-lg">
              {candidates.map((tag, index) => (
                <button
                  key={`${tag}-${index}`}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    addTag(tag);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-[10px] uppercase tracking-[0.3em] ${
                    index === activeIndex
                      ? "bg-[#00ff41]/10 text-[#00ff41]"
                      : "text-[color:var(--text-muted-strong)] hover:text-[#00ff41]"
                  }`}
                >
                  <span>{tag}</span>
                  {index === activeIndex && (
                    <span className="text-[9px] uppercase tracking-[0.3em] text-[#00ff41]">
                      Enter/Tab
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="hidden" name={providedField} value="1" />
      </div>
      {hint && <p className="text-xs app-muted">{hint}</p>}
    </div>
  );
}
