"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  sendAnalyticsEvent,
  setAnalyticsContext,
} from "@/lib/analytics-client";

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const MAX_DURATION_MS = 6 * 60 * 60 * 1000; // 6 hours

const safeNow = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

const getStoredNumber = (key: string) => {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

const setStoredNumber = (key: string, value: number) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, String(value));
};

const getStoredString = (key: string) => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
};

const setStoredString = (key: string, value: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, value);
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
};

const getSessionId = () => {
  const now = Date.now();
  const lastSeen = getStoredNumber("analytics_last_seen");
  let sessionId = getStoredString("analytics_session_id");
  if (!sessionId || !lastSeen || now - lastSeen > SESSION_TTL_MS) {
    sessionId = createId();
    setStoredString("analytics_session_id", sessionId);
  }
  setStoredNumber("analytics_last_seen", now);
  return sessionId;
};

const safeLabel = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.slice(0, 140);
};

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pageRef = useRef<{
    pageId: string;
    sessionId: string;
    path: string;
    startTime: number;
    sentEnd: boolean;
  } | null>(null);
  const lastPathRef = useRef<string | null>(null);

  const locationKey = useMemo(() => {
    const query = searchParams?.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const flushDuration = () => {
    const current = pageRef.current;
    if (!current || current.sentEnd) return;
    current.sentEnd = true;
    const durationMs = Math.min(
      Math.max(Math.round(safeNow() - current.startTime), 0),
      MAX_DURATION_MS
    );
    sendAnalyticsEvent({
      type: "page_duration",
      sessionId: current.sessionId,
      pageId: current.pageId,
      path: current.path,
      durationMs,
    });
  };

  const emitClick = (target: HTMLElement) => {
    const current = pageRef.current;
    if (!current) return;
    if (target.closest("[data-analytics='false']")) return;
    const clickable =
      target.closest("a,button,[data-analytics-label]") ?? target;
    if (!clickable) return;
    if (
      clickable instanceof HTMLInputElement ||
      clickable instanceof HTMLTextAreaElement ||
      clickable instanceof HTMLSelectElement
    ) {
      return;
    }
    if (clickable instanceof HTMLElement && clickable.isContentEditable) return;

    const labelAttr =
      clickable.getAttribute("data-analytics-label") ||
      clickable.getAttribute("aria-label");
    const text = clickable.textContent ?? "";
    const label = safeLabel(labelAttr ?? text);
    if (!label) return;

    const href =
      clickable instanceof HTMLAnchorElement ? clickable.href : null;
    const targetTag = clickable.tagName.toLowerCase();

    sendAnalyticsEvent({
      type: "click",
      sessionId: current.sessionId,
      pageId: current.pageId,
      path: current.path,
      label,
      target: targetTag,
      href,
    });
  };

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) {
      return;
    }

    if (pageRef.current) {
      flushDuration();
    }

    const sessionId = getSessionId();
    const pageId = createId();
    const path = locationKey || "/";
    const referrer = lastPathRef.current ?? document.referrer ?? "";

    pageRef.current = {
      pageId,
      sessionId,
      path,
      startTime: safeNow(),
      sentEnd: false,
    };
    setAnalyticsContext({ sessionId, pageId, path });

    sendAnalyticsEvent({
      type: "page_view",
      sessionId,
      pageId,
      path,
      referrer,
    });

    lastPathRef.current = path;

    return () => {
      flushDuration();
    };
  }, [locationKey, pathname]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushDuration();
      }
    };
    const handlePageHide = () => {
      flushDuration();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      emitClick(target);
    };
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname]);

  return null;
}
