"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpRight,
  MessageSquare,
  AlertTriangle,
  Eye,
  Heart,
  Calendar,
  History,
  Tag,
  Inbox,
  Loader2,
  Filter,
} from "lucide-react";
import EmptyState from "@/components/ui/empty-state";
import StatusPill from "@/components/ui/status-pill";
import TimeStamp from "@/components/ui/time-stamp";
import { type Viewer } from "@/components/auth/user-menu";
import SiteHeader from "@/components/site-header";
import { useEffectiveTheme, useUIStore } from "@/store/ui";
import type { FeedCursor } from "@/lib/feed";
import { useFeedFilterStore } from "@/store/feed-filter";

export type HomePost = {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  createdAt: string;
  publishedAt?: string | null;
  updatedAt: string;
  edited: boolean;
  status: "published" | "pending" | "rejected";
  isMine?: boolean;
  tags: { name: string; slug: string }[];
  stats: { views: number; likes: number; comments: number };
};

export default function HomeView({
  posts,
  viewer,
  stats,
  featuredTags,
  initialCursor,
  initialTagSlugs = [],
  initialMatch = "any",
  initialTheme = "dark",
  initialFrom,
  initialTo,
  debug,
}: {
  posts: HomePost[];
  viewer: Viewer | null;
  stats: { posts: number; comments: number; tags: number };
  featuredTags: { name: string; slug: string }[];
  initialCursor?: FeedCursor | null;
  initialTagSlugs?: string[];
  initialMatch?: "any" | "all";
  initialTheme?: "dark" | "light";
  initialFrom?: string;
  initialTo?: string;
  debug?: { db: string; serverPosts: number; statsPosts: number };
}) {
  const PAGE_SIZE = 9;
  const pathname = usePathname();
  const [systemLoad, setSystemLoad] = useState("0.42");
  const theme = useEffectiveTheme(initialTheme);
  const flashSystemMsg = useUIStore((state) => state.flashSystemMsg);
  const [feedPosts, setFeedPosts] = useState<HomePost[]>(posts);
  const [cursor, setCursor] = useState<FeedCursor | null>(
    initialCursor ?? null,
  );
  const [hasMore, setHasMore] = useState(Boolean(initialCursor));
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingFilter, setLoadingFilter] = useState(false);
  const [error, setError] = useState("");
  const [dateFrom, setDateFrom] = useState(initialFrom ?? "");
  const [dateTo, setDateTo] = useState(initialTo ?? "");
  const [lastFetch, setLastFetch] = useState<{
    count: number;
    at: string;
    params: string;
  } | null>(null);
  const selectedTags = useFeedFilterStore((state) => state.selectedTags);
  const match = useFeedFilterStore((state) => state.match);
  const setSelectedTags = useFeedFilterStore((state) => state.setSelectedTags);
  const setMatch = useFeedFilterStore((state) => state.setMatch);
  const toggleTag = useFeedFilterStore((state) => state.toggleTag);
  const removeTag = useFeedFilterStore((state) => state.removeTag);
  const clearTags = useFeedFilterStore((state) => state.clearTags);
  const tagLookup = useFeedFilterStore((state) => state.tagLookup);
  const setTagLookup = useFeedFilterStore((state) => state.setTagLookup);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const initialFilterRef = useRef<string | null>(null);

  const notify = (msg: string) => {
    flashSystemMsg(msg);
  };

  useEffect(() => {
    const loadInterval = setInterval(
      () => setSystemLoad((Math.random() * 0.8 + 0.1).toFixed(2)),
      5000,
    );

    return () => {
      clearInterval(loadInterval);
    };
  }, []);

  const isDark = theme === "dark";

  useEffect(() => {
    const sorted = [...initialTagSlugs].sort();
    const matchKey = sorted.length > 1 ? initialMatch : "any";
    const nextKey = `feed:${sorted.join(",")}|${matchKey}`;
    if (initialFilterRef.current === nextKey) return;
    initialFilterRef.current = nextKey;
    setSelectedTags(initialTagSlugs);
    setMatch(initialMatch);
  }, [initialTagSlugs, initialMatch, setSelectedTags, setMatch]);

  useEffect(() => {
    setDateFrom(initialFrom ?? "");
    setDateTo(initialTo ?? "");
  }, [initialFrom, initialTo]);

  useEffect(() => {
    setFeedPosts(posts);
    setCursor(initialCursor ?? null);
    setHasMore(Boolean(initialCursor));
  }, [posts, initialCursor]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selectedTags.length > 0) {
      params.set("tags", selectedTags.join(","));
      if (selectedTags.length > 1 && match === "all") {
        params.set("match", "all");
      }
    }
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const query = params.toString();
    const nextUrl = query ? `${pathname}?${query}` : pathname;
    const current = `${window.location.pathname}${window.location.search}`;
    if (nextUrl !== current) {
      window.history.replaceState(null, "", nextUrl);
    }
  }, [selectedTags, match, pathname]);

  const searchItems = useMemo(
    () =>
      feedPosts.map((post) => ({
        id: post.id,
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt ?? undefined,
        tags: post.tags.map((tag) => tag.name),
        publishedAt: post.publishedAt ?? post.createdAt,
      })),
    [feedPosts],
  );

  const fetchFeed = async (options: { reset?: boolean } = {}) => {
    const reset = options.reset ?? false;
    if (reset) {
      setLoadingFilter(true);
      setLoadingMore(false);
    } else {
      if (!hasMore || loadingMore || loadingFilter) return;
      setLoadingMore(true);
    }
    setError("");

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    if (selectedTags.length > 0) {
      params.set("tags", selectedTags.join(","));
      params.set("match", match);
    }
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (!reset && cursor?.date && cursor?.id) {
      params.set("cursorDate", cursor.date);
      params.set("cursorId", cursor.id);
    }

    try {
      const response = await fetch(`/api/posts/feed?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Failed to load feed.");
      }
      const data = (await response.json()) as {
        posts: HomePost[];
        nextCursor: FeedCursor | null;
      };
      if (requestId !== requestIdRef.current) return;
      if (reset) {
        setFeedPosts(data.posts);
      } else {
        setFeedPosts((prev) => [...prev, ...data.posts]);
      }
      setLastFetch({
        count: data.posts.length,
        at: new Date().toLocaleTimeString(),
        params: params.toString(),
      });
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const message = err instanceof Error ? err.message : "Feed unavailable.";
      setError(message);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoadingFilter(false);
        setLoadingMore(false);
      }
    }
  };

  const autoRefreshRef = useRef(false);

  useEffect(() => {
    if (stats.posts === 0) {
      const hadPublished = feedPosts.some(
        (post) => post.status === "published",
      );
      if (hadPublished) {
        setFeedPosts((prev) =>
          prev.filter((post) => post.status !== "published"),
        );
        setCursor(null);
        setHasMore(false);
      }
      return;
    }
    if (autoRefreshRef.current) return;
    if (selectedTags.length > 0) return;
    const publishedCount = feedPosts.filter(
      (post) => post.status === "published",
    ).length;
    if (stats.posts > publishedCount) {
      autoRefreshRef.current = true;
      fetchFeed({ reset: true });
    }
  }, [stats.posts, selectedTags.length, feedPosts]);

  // tag library lives in the global header filter

  useEffect(() => {
    fetchFeed({ reset: true });
  }, [selectedTags, match, dateFrom, dateTo]);

  const formatLocalDate = (value: Date) => {
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
      value.getDate(),
    )}`;
  };

  const handleFromChange = (value: string) => {
    setDateFrom(value);
    if (dateTo && value && value > dateTo) {
      setDateTo(value);
    }
  };

  const handleToChange = (value: string) => {
    setDateTo(value);
    if (dateFrom && value && value < dateFrom) {
      setDateFrom(value);
    }
  };

  const presetRange = (days: number) => {
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    setDateFrom(formatLocalDate(start));
    setDateTo(formatLocalDate(today));
  };

  const presetYear = () => {
    const today = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    setDateFrom(formatLocalDate(start));
    setDateTo(formatLocalDate(today));
  };

  const clearRange = () => {
    setDateFrom("");
    setDateTo("");
  };

  useEffect(() => {
    if (!sentinelRef.current) return;
    const node = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchFeed();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, hasMore, selectedTags, match]);

  useEffect(() => {
    if (featuredTags.length > 0) {
      setTagLookup(featuredTags);
    }
  }, [featuredTags, setTagLookup]);

  const tagLabels = useMemo(() => {
    const map = new Map<string, string>();
    Object.entries(tagLookup).forEach(([slug, name]) => map.set(slug, name));
    featuredTags.forEach((tag) => map.set(tag.slug, tag.name));
    return map;
  }, [featuredTags, tagLookup]);
  const bgColor = isDark ? "bg-black" : "bg-[#f6f1e7]";
  const textColor = isDark ? "text-[#00ff41]" : "text-zinc-900";
  const cardBg = isDark ? "bg-black" : "bg-white";
  const borderColor = isDark ? "border-zinc-800" : "border-zinc-300";
  const mutedText = isDark ? "text-zinc-500" : "text-zinc-700";
  const mutedTextStrong = isDark ? "text-zinc-400" : "text-zinc-600";
  const mutedLabel = isDark ? "text-zinc-600" : "text-zinc-700";
  const panelBg = isDark ? "bg-zinc-900/5" : "bg-white";
  const panelBorder = isDark ? "border-zinc-800/50" : "border-zinc-200";
  const statCardBg = isDark ? "bg-zinc-950/60" : "bg-white";
  const statCardText = isDark ? "text-white" : "text-zinc-900";

  return (
    <div
      className={`min-h-screen ${bgColor} ${textColor} selection:bg-[#00ff41] selection:text-black transition-colors duration-150`}
    >
      {isDark && (
        <div className="fixed inset-0 pointer-events-none z-[100] opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_2px,3px_100%]"></div>
      )}

      <SiteHeader
        viewer={viewer}
        initialTheme={initialTheme}
        refreshOnToggle={false}
        searchItems={searchItems}
      />

      <header className="pt-32 pb-16 px-6 max-w-screen-2xl mx-auto overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
          <div className="lg:col-span-8">
            <div
              className={`flex items-center space-x-2 text-[9px] ${mutedText} mb-2 font-bold italic`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>SECURE_SHELL_ESTABLISHED: ENCRYPTION_AES_256</span>
            </div>
            <h1
              className={`text-6xl md:text-[8rem] font-black tracking-tighter leading-[0.85] uppercase ${
                isDark ? "text-white" : "text-zinc-900"
              }`}
            >
              DIGITAL
              <br />
              <span className={isDark ? "text-[#00ff41]/50" : "text-zinc-300"}>
                ARCHIVE
              </span>
            </h1>
          </div>
          <div
            className={`lg:col-span-4 hidden lg:block border ${borderColor} p-4 ${panelBg} transition-all`}
          >
            <div
              className={`text-[10px] ${mutedLabel} mb-3 uppercase tracking-widest flex justify-between`}
            >
              <span>System_Latency</span>
              <span className="text-[#00ff41]">{systemLoad}s</span>
            </div>
            <div className="space-y-1.5 opacity-50">
              <div className="h-1 bg-zinc-800 w-full rounded-full overflow-hidden">
                <div className="h-full bg-[#00ff41] w-[60%] animate-pulse"></div>
              </div>
              <div className="h-1 bg-zinc-800 w-full rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 w-[40%]"></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`w-full h-2 ${isDark ? "bg-zinc-900" : "bg-zinc-200"} my-8 opacity-20`}
      ></div>

      <section className="max-w-screen-2xl mx-auto px-6 pb-6">
        {/* {process.env.NODE_ENV === "development" && debug && (
          <div className="mb-4 text-[10px] uppercase tracking-[0.3em] app-muted">
            DEV · DB {debug.db} · SSR {debug.serverPosts} · Published{" "}
            {debug.statsPosts} · Client {feedPosts.length}
            {lastFetch
              ? ` · API ${lastFetch.count} @ ${lastFetch.at} (${lastFetch.params || "no params"})`
              : " · API pending"}
          </div>
        )} */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className={`border ${borderColor} ${statCardBg} p-4`}>
            <div
              className={`text-[9px] uppercase tracking-[0.3em] ${mutedText}`}
            >
              Published Posts
            </div>
            <div className={`mt-2 text-2xl font-black ${statCardText}`}>
              {stats.posts}
            </div>
          </div>
          <div className={`border ${borderColor} ${statCardBg} p-4`}>
            <div
              className={`text-[9px] uppercase tracking-[0.3em] ${mutedText}`}
            >
              Approved Comments
            </div>
            <div className={`mt-2 text-2xl font-black ${statCardText}`}>
              {stats.comments}
            </div>
          </div>
          <div className={`border ${borderColor} ${statCardBg} p-4`}>
            <div
              className={`text-[9px] uppercase tracking-[0.3em] ${mutedText}`}
            >
              Active Tags
            </div>
            <div className={`mt-2 text-2xl font-black ${statCardText}`}>
              {stats.tags}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              className={`flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] ${mutedText}`}
            >
              <Filter className="h-3 w-3" />
              Filter by tag
            </div>
            <div className="flex items-center gap-2">
              {selectedTags.length > 1 && (
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-[0.3em]">
                  <button
                    type="button"
                    onClick={() => setMatch("any")}
                    className={`border px-2 py-1 transition ${
                      match === "any"
                        ? "border-[#00ff41] text-[#00ff41]"
                        : `${panelBorder} ${mutedText}`
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
                        : `${panelBorder} ${mutedText}`
                    }`}
                  >
                    Match All
                  </button>
                </div>
              )}
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-[10px] uppercase tracking-[0.3em] text-[#00ff41] border border-[#00ff41]/40 px-2 py-1 hover:bg-[#00ff41] hover:text-black transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {featuredTags.length === 0 ? (
              <span
                className={`text-xs ${mutedText} uppercase tracking-[0.3em]`}
              >
                No tags approved yet
              </span>
            ) : (
              featuredTags.map((tag) => {
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
              })
            )}
          </div>

          {selectedTags.length > 0 && (
            <>
              <div
                className={`text-[10px] uppercase tracking-[0.3em] ${mutedText}`}
              >
                Filtering:{" "}
                {selectedTags
                  .map((slug) => tagLabels.get(slug) ?? slug)
                  .join(", ")}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedTags.map((slug) => (
                  <button
                    key={slug}
                    type="button"
                    onClick={() => removeTag(slug)}
                    className="text-[9px] uppercase tracking-[0.3em] border border-[#00ff41]/40 px-2 py-1 text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                  >
                    {tagLabels.get(slug) ?? slug} ×
                  </button>
                ))}
                <button
                  type="button"
                  onClick={clearTags}
                  className={`text-[9px] uppercase tracking-[0.3em] border ${panelBorder} px-2 py-1 ${mutedText} hover:text-[#00ff41] transition`}
                >
                  Clear all
                </button>
              </div>
            </>
          )}
          {(dateFrom || dateTo) && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={clearRange}
                className="text-[9px] uppercase tracking-[0.3em] border border-[#00ff41]/40 px-2 py-1 text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
              >
                Range {dateFrom || "Any"} → {dateTo || "Any"} ×
              </button>
            </div>
          )}
        </div>
      </section>

      <main className="max-w-screen-2xl mx-auto px-6 py-12">
        <div className={`border ${borderColor} ${cardBg} overflow-hidden`}>
          <div
            className={`px-4 py-2 ${panelBg} border-b ${borderColor} text-[10px] font-bold flex flex-wrap gap-3 justify-between items-center uppercase ${mutedText} tracking-widest`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <span>Archive Range</span>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => handleFromChange(event.target.value)}
                  className="border app-border bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.3em] app-muted focus:border-[var(--app-text)] outline-none"
                />
                <span className="text-[10px] app-muted">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => handleToChange(event.target.value)}
                  className="border app-border bg-transparent px-2 py-1 text-[10px] uppercase tracking-[0.3em] app-muted focus:border-[var(--app-text)] outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => presetRange(7)}
                  className="border app-border px-2 py-1 text-[9px] uppercase tracking-[0.3em] hover:border-[#00ff41] transition"
                >
                  7D
                </button>
                <button
                  type="button"
                  onClick={() => presetRange(30)}
                  className="border app-border px-2 py-1 text-[9px] uppercase tracking-[0.3em] hover:border-[#00ff41] transition"
                >
                  30D
                </button>
                <button
                  type="button"
                  onClick={presetYear}
                  className="border app-border px-2 py-1 text-[9px] uppercase tracking-[0.3em] hover:border-[#00ff41] transition"
                >
                  12M
                </button>
                <button
                  type="button"
                  onClick={clearRange}
                  className="border app-border px-2 py-1 text-[9px] uppercase tracking-[0.3em] hover:border-[#00ff41] transition"
                >
                  All
                </button>
              </div>
            </div>
            <div className="flex space-x-2">
              <span className="w-2 h-2 bg-zinc-800 rounded-full"></span>
              <span className="w-2 h-2 bg-zinc-800 rounded-full"></span>
              <span className="w-2 h-2 bg-[#00ff41] rounded-full"></span>
            </div>
          </div>

          {feedPosts.length === 0 ? (
            <div className="p-10">
              <EmptyState
                icon={<Inbox className="h-5 w-5" />}
                title={
                  selectedTags.length > 0
                    ? "No posts match your filters"
                    : "No published posts yet"
                }
                description={
                  selectedTags.length > 0
                    ? "Try removing a tag or switch the match mode."
                    : "When articles are approved, they will appear here in the global stream."
                }
                action={
                  selectedTags.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearTags}
                      className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                    >
                      Clear filters
                    </button>
                  ) : viewer ? (
                    <Link
                      href="/submit"
                      className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                    >
                      Submit the first post
                    </Link>
                  ) : (
                    <Link
                      href="/sign-in"
                      className="border border-[#00ff41]/40 px-4 py-2 text-xs uppercase tracking-[0.3em] text-[#00ff41] hover:bg-[#00ff41] hover:text-black transition"
                    >
                      Sign in to submit
                    </Link>
                  )
                }
              />
            </div>
          ) : (
            feedPosts.map((post) => (
              <div
                key={post.id}
                className={`group relative border-b ${borderColor} hover:bg-[#00ff41]/5 transition-all duration-300`}
              >
                <div className="flex flex-col md:flex-row py-12 px-8">
                  <div
                    className={`md:w-32 text-[10px] ${mutedText} font-black mb-4 md:mb-0 group-hover:text-[#00ff41] transition-colors`}
                  >
                    [{post.id.slice(0, 6).toUpperCase()}]
                  </div>
                  <div className="flex-grow">
                    <Link
                      href={`/posts/${post.slug}`}
                      className={`block text-2xl md:text-4xl font-black transition-all uppercase mb-4 cursor-pointer ${
                        isDark
                          ? "text-zinc-300 group-hover:text-white"
                          : "text-zinc-700 group-hover:text-black"
                      }`}
                    >
                      {post.title}
                    </Link>

                    {post.status !== "published" && post.isMine && (
                      <div className="mb-4">
                        <StatusPill
                          status={post.status}
                          label={
                            post.status === "pending"
                              ? "Pending Review"
                              : "Rejected"
                          }
                        />
                      </div>
                    )}

                    <div
                      className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 p-4 border ${panelBorder} ${panelBg}`}
                    >
                      <div className="flex flex-col space-y-1">
                        <span
                          className={`text-[8px] ${mutedLabel} uppercase font-bold tracking-widest flex items-center`}
                        >
                          <Calendar className="w-2.5 h-2.5 mr-1" />{" "}
                          {post.status === "published"
                            ? "Published"
                            : "Submitted"}
                        </span>
                        <TimeStamp
                          value={
                            post.status === "published"
                              ? post.publishedAt ?? post.createdAt
                              : post.createdAt
                          }
                          className={`text-[10px] ${mutedTextStrong} font-bold`}
                        />
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span
                          className={`text-[8px] ${mutedLabel} uppercase font-bold tracking-widest flex items-center`}
                        >
                          <History className="w-2.5 h-2.5 mr-1" /> Updated
                        </span>
                        <TimeStamp
                          value={post.updatedAt}
                          className={`text-[10px] ${mutedTextStrong} font-bold`}
                        />
                      </div>
                      <div className="flex flex-col space-y-1">
                        <span
                          className={`text-[8px] ${mutedLabel} uppercase font-bold tracking-widest flex items-center`}
                        >
                          <Tag className="w-2.5 h-2.5 mr-1" /> Tags
                        </span>
                        <div className="flex gap-1 flex-wrap">
                          {post.tags.length === 0 ? (
                            <span className={`text-[9px] ${mutedText}`}>
                              No tags
                            </span>
                          ) : (
                            post.tags.map((t) => (
                              <Link
                                key={t.slug}
                                href={`/tags/${t.slug}`}
                                className={`text-[9px] px-1 border ${
                                  isDark
                                    ? "text-[#00ff41] border-[#00ff41]/40 bg-[#00ff41]/10"
                                    : "text-[color:var(--accent)] border-[color:var(--accent)]/60 bg-[color:var(--accent)]/15"
                                }`}
                              >
                                {t.name}
                              </Link>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1 items-end justify-center">
                        <div
                          className={`flex space-x-3 text-[10px] font-bold ${mutedText}`}
                        >
                          <span className="flex items-center">
                            <Eye className="w-3 h-3 mr-1" /> {post.stats.views}
                          </span>
                          <span className="flex items-center">
                            <Heart className="w-3 h-3 mr-1" />{" "}
                            {post.stats.likes}
                          </span>
                          <span className="flex items-center">
                            <MessageSquare className="w-3 h-3 mr-1" />{" "}
                            {post.stats.comments}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p
                      className={`text-[11px] leading-relaxed uppercase font-bold mb-8 ${mutedText} ${
                        isDark
                          ? "group-hover:text-zinc-400"
                          : "group-hover:text-zinc-600"
                      }`}
                    >
                      // {post.excerpt || "No excerpt available yet."}
                    </p>

                    <div className="flex items-center space-x-6">
                      <Link
                        href={`/posts/${post.slug}`}
                        className="text-[10px] font-bold text-[#00ff41] border border-[#00ff41]/30 px-3 py-1 hover:bg-[#00ff41] hover:text-black transition-all flex items-center"
                      >
                        <ArrowUpRight className="w-3 h-3 mr-2" />
                        Read Article
                      </Link>
                      <Link
                        href={`/posts/${post.slug}#comments`}
                        className={`text-[10px] ${mutedText} hover:text-white flex items-center font-bold transition-colors`}
                      >
                        <MessageSquare className="w-3 h-3 mr-2" /> View
                        Discussion
                      </Link>
                    </div>
                  </div>
                  <Link
                    href={`/posts/${post.slug}`}
                    className="mt-8 md:mt-0 text-zinc-800 group-hover:text-[#00ff41] transition-colors"
                    aria-label={`Open ${post.title}`}
                  >
                    <ArrowUpRight className="w-8 h-6" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="mt-6 text-xs text-red-400 uppercase tracking-[0.3em]">
            {error}
          </div>
        )}

        {loadingFilter && (
          <div className="mt-6 flex items-center gap-2 text-xs uppercase tracking-[0.3em] app-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Updating feed
          </div>
        )}

        <div ref={sentinelRef} className="h-8" />

        {loadingMore && (
          <div
            className={`mt-4 border ${borderColor} ${cardBg} overflow-hidden animate-pulse`}
          >
            {Array.from({ length: 2 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className={`border-b ${borderColor} p-8`}
              >
                <div className="flex flex-col gap-3">
                  <div className="h-3 w-24 bg-[color:var(--panel-border)] opacity-60"></div>
                  <div className="h-6 w-2/3 bg-[color:var(--panel-border)] opacity-60"></div>
                  <div className="h-3 w-full bg-[color:var(--panel-border)] opacity-40"></div>
                  <div className="h-3 w-5/6 bg-[color:var(--panel-border)] opacity-40"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasMore && feedPosts.length > 0 && (
          <div className="mt-4 text-[10px] uppercase tracking-[0.3em] app-muted">
            End of feed
          </div>
        )}
      </main>

    </div>
  );
}
