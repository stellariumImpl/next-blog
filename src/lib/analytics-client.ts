export type AnalyticsContext = {
  sessionId: string;
  pageId: string;
  path: string;
};

declare global {
  interface Window {
    __analyticsContext?: AnalyticsContext;
  }
}

export const setAnalyticsContext = (context: AnalyticsContext) => {
  if (typeof window === "undefined") return;
  window.__analyticsContext = context;
};

export const getAnalyticsContext = () => {
  if (typeof window === "undefined") return null;
  return window.__analyticsContext ?? null;
};

export const sendAnalyticsEvent = (event: Record<string, unknown>) => {
  const body = JSON.stringify({ events: [event] });
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    const ok = navigator.sendBeacon(
      "/api/analytics",
      new Blob([body], { type: "application/json" })
    );
    if (ok) return;
  }
  void fetch("/api/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
};

export const trackCustomEvent = ({
  eventType,
  label,
  target,
  href,
  path,
}: {
  eventType: string;
  label?: string | null;
  target?: string | null;
  href?: string | null;
  path?: string;
}) => {
  const context = getAnalyticsContext();
  if (!context) return;
  sendAnalyticsEvent({
    type: "event",
    sessionId: context.sessionId,
    pageId: context.pageId,
    path: path ?? context.path,
    eventType,
    label: label ?? null,
    target: target ?? null,
    href: href ?? null,
  });
};
