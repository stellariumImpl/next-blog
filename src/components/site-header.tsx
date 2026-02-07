"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { liteClient } from "algoliasearch/lite";
import {
  Archive,
  Moon,
  Search,
  Sun,
  Tag,
  Terminal,
  Zap,
  ArrowRight,
  Filter,
  X,
  Loader2,
} from "lucide-react";
import UserMenu, { type Viewer } from "@/components/auth/user-menu";
import { useEffectiveTheme, useUIStore } from "@/store/ui";
import { useFeedFilterStore } from "@/store/feed-filter";
import { trackCustomEvent } from "@/lib/analytics-client";

export default function SiteHeader({
  viewer,
  active,
  refreshOnToggle = false,
  searchItems = [],
  initialTheme,
}: {
  viewer: Viewer | null;
  active?: "archive" | "tags";
  refreshOnToggle?: boolean;
  searchItems?: {
    id: string;
    slug: string;
    title: string;
    excerpt?: string;
    tags?: string[];
    publishedAt?: string;
  }[];
  initialTheme: "dark" | "light";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const theme = useEffectiveTheme(initialTheme);
  const isDark = theme === "dark";
  const systemMsg = useUIStore((state) => state.systemMsg);
  const searchOpen = useUIStore((state) => state.searchOpen);
  const openSearch = useUIStore((state) => state.openSearch);
  const setSearchOpen = useUIStore((state) => state.setSearchOpen);
  const toggleTheme = useUIStore((state) => state.toggleTheme);
  const flashSystemMsg = useUIStore((state) => state.flashSystemMsg);
  const selectedTags = useFeedFilterStore((state) => state.selectedTags);
  const setSelectedTags = useFeedFilterStore((state) => state.setSelectedTags);
  const match = useFeedFilterStore((state) => state.match);
  const toggleTag = useFeedFilterStore((state) => state.toggleTag);
  const removeTag = useFeedFilterStore((state) => state.removeTag);
  const clearTags = useFeedFilterStore((state) => state.clearTags);
  const setMatch = useFeedFilterStore((state) => state.setMatch);
  const tagLookup = useFeedFilterStore((state) => state.tagLookup);
  const setTagLookup = useFeedFilterStore((state) => state.setTagLookup);
  const [filterOpen, setFilterOpen] = useState(false);
  const [allTags, setAllTags] = useState<{ name: string; slug: string }[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [loadingTags, setLoadingTags] = useState(false);
  const [tagError, setTagError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  type AlgoliaHit = {
    objectID: string;
    slug: string;
    title: string;
    excerpt?: string | null;
    tags?: string[];
    publishedAt?: string | null;
    _highlightResult?: {
      title?: { value: string };
      excerpt?: { value: string };
      content?: { value: string };
      tags?: { value: string }[];
    };
    _snippetResult?: {
      excerpt?: { value: string };
      content?: { value: string };
    };
  };
  const [searchResults, setSearchResults] = useState<AlgoliaHit[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const lastTrackedSearchRef = useRef<{ query: string; at: number } | null>(null);
  const borderColor = isDark ? "border-zinc-800" : "border-zinc-300";
  const navBg = isDark ? "bg-black/90" : "bg-white/90";
  const navText = isDark ? "text-zinc-400" : "text-zinc-700";
  const mutedText = isDark ? "text-zinc-700" : "text-zinc-500";
  const underline =
    "after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-full after:scale-x-0 after:origin-left after:transition-transform";
  const linkBase = `relative flex items-center space-x-2 border-b border-transparent transition-colors ${underline}`;
  const hoverClasses = isDark
    ? "hover:text-white hover:after:scale-x-100 hover:after:bg-[#00ff41]"
    : "hover:text-zinc-900 hover:after:scale-x-100 hover:after:bg-zinc-400";
  const linkActive = isDark
    ? "text-[#00ff41] after:scale-x-100 after:bg-[#00ff41]"
    : "text-zinc-900 after:scale-x-100 after:bg-zinc-600";
  const searchClasses = `${linkBase} ${hoverClasses}`;
  const filterClasses = `${linkBase} ${hoverClasses}`;
  const archiveClasses = `${linkBase} ${
    active === "archive" ? linkActive : ""
  } ${hoverClasses}`;
  const tagClasses = `${linkBase} ${
    active === "tags" ? linkActive : ""
  } ${hoverClasses}`;
  const homeParams = new URLSearchParams();
  if (selectedTags.length > 0) {
    homeParams.set("tags", selectedTags.join(","));
    if (selectedTags.length > 1 && match === "all") {
      homeParams.set("match", "all");
    }
  }
  const homeHref = homeParams.toString() ? `/?${homeParams.toString()}` : "/";

  const handleToggle = () => {
    toggleTheme();
    flashSystemMsg(
      `SYSTEM_PROTOCOL: ${isDark ? "LIGHT" : "DARK"}_MODE_ENGAGED`,
    );
    if (refreshOnToggle) {
      router.refresh();
    }
  };

  const handleSearch = () => {
    openSearch();
  };
  const showFilter = pathname === "/";
  const algoliaAppId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID ?? "";
  const algoliaSearchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY ?? "";
  const algoliaIndexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX ?? "posts";
  const algoliaEnabled = Boolean(
    algoliaAppId && algoliaSearchKey && algoliaIndexName,
  );
  const algoliaClient = useMemo(() => {
    if (!algoliaEnabled) return null;
    return liteClient(algoliaAppId, algoliaSearchKey);
  }, [algoliaAppId, algoliaSearchKey, algoliaEnabled]);

  const sanitizeHighlight = (value: string) =>
    value
      .replace(/<(?!\/?em\b)[^>]+>/g, "")
      .replace(/<em>/g, '<mark class="algolia-highlight">')
      .replace(/<\/em>/g, "</mark>");

  const formatSearchDate = (value?: string | null) => {
    if (!value) return null;
    if (/\d{4}\.\d{2}\.\d{2}/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${parsed.getFullYear()}.${pad(parsed.getMonth() + 1)}.${pad(
      parsed.getDate(),
    )}`;
  };

  const loadAllTags = async () => {
    if (loadingTags) return;
    setLoadingTags(true);
    setTagError("");
    setAllTags([]);
    try {
      const response = await fetch(`/api/tags?ts=${Date.now()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load tags.");
      }
      const data = (await response.json()) as {
        tags: { name: string; slug: string }[];
      };
      const tags = data.tags ?? [];
      setAllTags(tags);
      setTagLookup(tags);
      if (selectedTags.length > 0) {
        const allowed = new Set(tags.map((tag) => tag.slug));
        const nextSelected = selectedTags.filter((slug) => allowed.has(slug));
        if (nextSelected.length !== selectedTags.length) {
          setSelectedTags(nextSelected);
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Tag library unavailable.";
      setTagError(message);
    } finally {
      setLoadingTags(false);
    }
  };

  useEffect(() => {
    if (filterOpen) {
      setTagSearch("");
      setTagError("");
      setAllTags([]);
      loadAllTags();
    } else {
      setTagSearch("");
      setTagError("");
      setAllTags([]);
    }
  }, [filterOpen]);

  useEffect(() => {
    setSearchOpen(false);
    setFilterOpen(false);
  }, [pathname, setSearchOpen]);

  useEffect(() => {
    if (!showFilter && filterOpen) {
      setFilterOpen(false);
    }
  }, [showFilter, filterOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFilterOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [filterOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    setSearchQuery("");
    setSearchResults([]);
    setSearchError("");
    lastTrackedSearchRef.current = null;
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    if (!algoliaEnabled) {
      setSearchError("Algolia is not configured.");
      return;
    }
    const query = searchQuery.trim();
    if (query.length === 0) {
      setSearchResults([]);
      setSearchError("");
      return;
    }

    const handle = window.setTimeout(async () => {
      if (!algoliaClient) return;
      setSearchLoading(true);
      setSearchError("");
      try {
        const results = (await algoliaClient.search<AlgoliaHit>({
          requests: [
            {
              indexName: algoliaIndexName,
              query,
              hitsPerPage: 8,
              attributesToRetrieve: [
                "title",
                "slug",
                "excerpt",
                "content",
                "tags",
                "publishedAt",
              ],
              attributesToHighlight: ["title", "excerpt", "content", "tags"],
              attributesToSnippet: ["excerpt:20", "content:28"],
              snippetEllipsisText: "…",
            },
          ],
        })) as {
          results?: Array<{
            hits?: AlgoliaHit[];
          }>;
        };
        const hits = results.results?.[0]?.hits ?? [];
        setSearchResults(hits);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Search unavailable.";
        setSearchError(message);
      } finally {
        setSearchLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(handle);
  }, [
    searchQuery,
    searchOpen,
    algoliaEnabled,
    algoliaClient,
    algoliaIndexName,
  ]);

  const trackSearch = (query: string, hits: number, source: string) => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) return;
    const now = Date.now();
    const last = lastTrackedSearchRef.current;
    if (last && last.query === normalized && now - last.at < 5 * 60 * 1000) {
      return;
    }
    lastTrackedSearchRef.current = { query: normalized, at: now };
    trackCustomEvent({
      eventType: "SEARCH",
      label: query.slice(0, 140),
      target: `hits:${hits}`,
      href: source,
    });
  };

  const forceHardNav = pathname === "/submit";
  const NavLink = forceHardNav ? "a" : Link;

  return (
    <>
      <nav
        className={`fixed top-0 w-full z-50 border-b ${borderColor} ${navBg} ${navText} backdrop-blur-md`}
      >
        <div className="max-w-screen-2xl mx-auto px-4 h-12 flex items-center justify-between text-[10px] uppercase font-bold tracking-tight">
          <div className="flex items-center space-x-4 md:space-x-6 shrink-0">
            <NavLink
              href={homeHref}
              className="flex items-center space-x-2 bg-zinc-900 text-white px-2 py-1 border border-zinc-700"
            >
              <Zap className="w-3 h-3 text-[#00ff41]" />
              <span className="hidden md:inline">CORE_DUMP</span>
            </NavLink>
            {systemMsg && (
              <span className="text-red-500 animate-pulse hidden md:inline">
                [{systemMsg}]
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3 md:gap-6">
            <NavLink href="/archive" className={archiveClasses}>
              <Archive className="w-3 h-3" />
              <span className="hidden md:inline">ARCHIVE</span>
            </NavLink>
            <NavLink href="/tags" className={tagClasses}>
              <Tag className="w-3 h-3" />
              <span className="hidden md:inline">TAGS</span>
            </NavLink>
            {/* {showFilter && (
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className={filterClasses}
              >
                <Filter className="w-3 h-3" />
                <span className="hidden md:inline">
                  FILTER
                  {selectedTags.length > 0 ? ` (${selectedTags.length})` : ""}
                </span>
              </button>
            )} */}

            <span className={`${mutedText} opacity-70 hidden md:inline`}>
              |
            </span>

            <button onClick={handleSearch} className={searchClasses}>
              <Search className="w-3 h-3" />
              <span className="hidden md:inline">SEARCH_DB</span>
            </button>

            <button
              onClick={handleToggle}
              className={`flex items-center space-x-2 px-2 py-1 h-6 border ${borderColor} transition-all ${
                isDark ? "hover:bg-zinc-800" : "hover:bg-zinc-200"
              }`}
            >
              {isDark ? (
                <Moon className="w-3 h-3" />
              ) : (
                <Sun className="w-3 h-3" />
              )}
              <span className="hidden sm:inline">
                {isDark ? "DARK" : "LIGHT"}
              </span>
            </button>

            <UserMenu viewer={viewer} hardNavigate={forceHardNav} />
          </div>
        </div>
      </nav>

      {searchOpen && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center p-6 backdrop-blur-xl animate-in fade-in duration-300 ${
            isDark ? "bg-black/95" : "bg-[color:var(--app-bg)]/95"
          }`}
          onClick={() => setSearchOpen(false)}
        >
          <div
            className={`w-full max-w-2xl max-h-[80vh] overflow-hidden border p-10 shadow-[0_0_80px_rgba(0,0,0,0.15)] ${
              isDark
                ? "border-[#00ff41]/20 bg-zinc-950 shadow-[0_0_100px_rgba(0,255,65,0.05)]"
                : "border-[color:var(--panel-border)] bg-[color:var(--card-bg)]"
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`flex items-center border-b pb-4 mb-8 ${
                isDark
                  ? "border-[#00ff41]/50"
                  : "border-[color:var(--panel-border)]"
              }`}
            >
              <Terminal
                className={`w-6 h-6 mr-4 ${
                  isDark ? "text-[#00ff41]" : "text-[color:var(--accent)]"
                }`}
              />
              <input
                ref={searchInputRef}
                autoFocus
                placeholder="QUERY_THE_VOID..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className={`bg-transparent flex-grow min-w-0 outline-none text-xl md:text-3xl font-black uppercase ${
                  isDark
                    ? "text-[#00ff41] placeholder:text-zinc-800"
                    : "text-[color:var(--app-text)] placeholder:text-[color:var(--text-muted)]"
                }`}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                  }
                  if (event.key === "Enter") {
                    event.preventDefault();
                    trackSearch(searchQuery, searchResults.length, "enter");
                  }
                }}
              />
              <div
                className={`text-[10px] hidden md:inline ${isDark ? "text-zinc-700" : "text-[color:var(--text-muted)]"}`}
              >
                ESC_TO_ABORT
              </div>
            </div>
            <div className="space-y-4">
              <span
                className={`text-[9px] block mb-4 tracking-[0.4em] ${isDark ? "text-zinc-600" : "text-[color:var(--text-muted)]"}`}
              >
                SEARCH_ENGINE_CONNECTED: ALGOLIA_V3
              </span>
              {searchLoading && (
                <div className="flex items-center gap-2 text-xs app-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </div>
              )}
              {searchError && (
                <div className="text-xs text-red-500">{searchError}</div>
              )}
              <div className="max-h-[52vh] overflow-y-auto pr-2 space-y-4">
                {(searchQuery.trim().length === 0
                  ? searchItems.map((item) => ({
                      ...item,
                      highlightTitle: undefined,
                      highlightExcerpt: undefined,
                      highlightContent: undefined,
                      highlightTags: undefined as string[] | undefined,
                    }))
                  : searchResults.map((hit) => ({
                      id: hit.objectID,
                      slug: hit.slug,
                      title: hit.title,
                      excerpt: hit.excerpt ?? undefined,
                      tags: hit.tags ?? [],
                      publishedAt: hit.publishedAt ?? undefined,
                      highlightTitle: hit._highlightResult?.title?.value,
                      highlightExcerpt:
                        hit._snippetResult?.excerpt?.value ??
                        hit._highlightResult?.excerpt?.value,
                      highlightContent:
                        hit._snippetResult?.content?.value ??
                        hit._highlightResult?.content?.value,
                      highlightTags: hit._highlightResult?.tags
                        ? hit._highlightResult?.tags.map((tag) => tag.value)
                        : undefined,
                    }))
                ).map((item) => {
                  const highlightTitle = item.highlightTitle
                    ? sanitizeHighlight(item.highlightTitle)
                    : null;
                  const highlightExcerpt = item.highlightExcerpt
                    ? sanitizeHighlight(item.highlightExcerpt)
                    : null;
                  const highlightContent = item.highlightContent
                    ? sanitizeHighlight(item.highlightContent)
                    : null;
                  const highlightTags = item.highlightTags?.map((tag) =>
                    sanitizeHighlight(tag),
                  );
                  const tags = highlightTags ?? item.tags ?? [];
                  const published = formatSearchDate(item.publishedAt);
                  const fallbackSnippet =
                    highlightContent ||
                    item.excerpt ||
                    "No excerpt available yet.";

                  return (
                    <Link
                      key={item.id}
                      href={`/posts/${item.slug}`}
                      onClick={() => {
                        trackSearch(searchQuery, searchResults.length, `result:${item.slug}`);
                        setSearchOpen(false);
                      }}
                      className={`group flex flex-col gap-3 p-4 cursor-pointer transition-all border ${
                        isDark
                          ? "border-transparent hover:border-[#00ff41]/20 hover:bg-[#00ff41]/10"
                          : "border-[color:var(--panel-border)] hover:border-[color:var(--accent)]/40 hover:bg-[color:var(--panel-bg)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div
                          className={`text-sm uppercase font-bold ${
                            isDark
                              ? "text-zinc-200 group-hover:text-white"
                              : "text-[color:var(--app-text)]"
                          }`}
                        >
                          <span className="mr-2">/</span>
                          {highlightTitle ? (
                            <span
                              className="algolia-highlight"
                              dangerouslySetInnerHTML={{
                                __html: highlightTitle,
                              }}
                            />
                          ) : (
                            item.title
                          )}
                        </div>
                        <ArrowRight
                          className={`w-3 h-3 opacity-0 group-hover:opacity-100 ${
                            isDark
                              ? "text-[#00ff41]"
                              : "text-[color:var(--accent)]"
                          }`}
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <div
                          className={`text-xs leading-relaxed ${
                            isDark
                              ? "text-zinc-500"
                              : "text-[color:var(--text-muted-strong)]"
                          }`}
                        >
                          {highlightExcerpt || highlightContent ? (
                            <span
                              className="algolia-highlight"
                              dangerouslySetInnerHTML={{
                                __html:
                                  highlightExcerpt ?? highlightContent ?? "",
                              }}
                            />
                          ) : (
                            fallbackSnippet
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.3em]">
                          {tags.length > 0 ? (
                            tags.map((tag, index) => (
                              <span
                                key={`${item.id}-tag-${index}`}
                                className={`px-2 py-1 border ${
                                  isDark
                                    ? "border-[#00ff41]/40 text-[#00ff41]"
                                    : "border-[color:var(--accent)]/50 text-[color:var(--accent)]"
                                }`}
                                dangerouslySetInnerHTML={{ __html: tag }}
                              />
                            ))
                          ) : (
                            <span
                              className={
                                isDark
                                  ? "text-zinc-600"
                                  : "text-[color:var(--text-muted)]"
                              }
                            >
                              No tags
                            </span>
                          )}
                          {published && (
                            <span
                              className={
                                isDark
                                  ? "text-zinc-600"
                                  : "text-[color:var(--text-muted)]"
                              }
                            >
                              · {published}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {searchQuery.trim().length === 0 &&
                  searchItems.length === 0 && (
                    <div
                      className={`text-xs ${isDark ? "text-zinc-600" : "text-[color:var(--text-muted)]"}`}
                    >
                      No results available yet.
                    </div>
                  )}
                {searchQuery.trim().length > 0 &&
                  !searchLoading &&
                  searchResults.length === 0 &&
                  !searchError && (
                    <div
                      className={`text-xs ${isDark ? "text-zinc-600" : "text-[color:var(--text-muted)]"}`}
                    >
                      No matches found.
                    </div>
                  )}
              </div>
            </div>
            <button
              onClick={() => setSearchOpen(false)}
              className={`mt-12 text-[10px] underline font-black uppercase ${
                isDark
                  ? "text-zinc-700 hover:text-white"
                  : "text-[color:var(--text-muted)] hover:text-[color:var(--app-text)]"
              }`}
            >
              Terminate_Session
            </button>
          </div>
        </div>
      )}

      {/* {showFilter && filterOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setFilterOpen(false)}
        >
          <div
            className="w-full max-w-3xl border app-border card-bg p-8 mt-10 shadow-[0_0_80px_rgba(0,255,65,0.08)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.4em] app-muted">
                <Filter className="h-4 w-4 text-[#00ff41]" />
                Tag filters
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="text-[10px] uppercase tracking-[0.3em] app-muted hover:text-[color:var(--app-text)]"
              >
                Close
              </button>
            </div>

            <div className="mt-6 space-y-5">
              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
                  Active filters
                </div>
                {selectedTags.length === 0 ? (
                  <div className="text-xs app-muted">No filters applied.</div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedTags.map((slug) => (
                      <button
                        key={slug}
                        type="button"
                        onClick={() => removeTag(slug)}
                        className="flex items-center gap-2 border border-[#00ff41]/40 px-2 py-1 text-[9px] uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                      >
                        {tagLookup[slug] ?? slug}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={clearTags}
                      className="text-[9px] uppercase tracking-[0.3em] border app-border px-2 py-1 app-muted hover:text-[#00ff41] transition"
                    >
                      Clear all
                    </button>
                  </div>
                )}
                {selectedTags.length > 1 && (
                  <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em]">
                    <button
                      type="button"
                      onClick={() => setMatch("any")}
                      className={`border px-2 py-1 transition ${
                        match === "any"
                          ? "border-[#00ff41] text-[#00ff41]"
                          : "app-border app-muted"
                      }`}
                    >
                      Match Any
                    </button>
                    <button
                      type="button"
                      onClick={() => setMatch("all")}
                      className={`border px-2 py-1 transition ${
                        match === "all"
                          ? "border-[#00ff41] text-[#00ff41]"
                          : "app-border app-muted"
                      }`}
                    >
                      Match All
                    </button>
                  </div>
                )}
              </div>

              <div className="border-t app-border pt-5 space-y-3">
                <div className="text-[10px] uppercase tracking-[0.3em] app-muted">
                  Tag library
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={tagSearch}
                    onChange={(event) => setTagSearch(event.target.value)}
                    placeholder="Search tags..."
                    className="flex-1 bg-transparent border app-border px-3 py-2 text-xs uppercase tracking-[0.3em] app-muted outline-none focus:border-[#00ff41]"
                  />
                </div>
                {loadingTags && (
                  <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] app-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading tags
                  </div>
                )}
                {tagError && (
                  <div className="text-xs uppercase tracking-[0.3em] text-red-400">
                    {tagError}
                  </div>
                )}
                {!loadingTags && !tagError && (
                  <div className="flex flex-wrap gap-2 max-h-56 overflow-auto pr-1">
                    {(tagSearch
                      ? allTags.filter((tag) =>
                          `${tag.name} ${tag.slug}`
                            .toLowerCase()
                            .includes(tagSearch.toLowerCase()),
                        )
                      : allTags
                    ).map((tag) => {
                      const isActive = selectedTags.includes(tag.slug);
                      return (
                        <button
                          key={tag.slug}
                          type="button"
                          onClick={() => toggleTag(tag.slug, tag.name)}
                          className={`text-[10px] uppercase tracking-[0.3em] border px-2 py-1 transition ${
                            isActive
                              ? "border-[#00ff41] text-[#00ff41] bg-[#00ff41]/10"
                              : "border-[#00ff41]/30 text-[#00ff41] hover:bg-[#00ff41] hover:text-black"
                          }`}
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                    {!tagSearch && allTags.length === 0 && (
                      <div className="text-xs app-muted">
                        No tags available.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )} */}
    </>
  );
}
