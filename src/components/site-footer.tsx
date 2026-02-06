"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Copy, Home, Music3 } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { useAudioStore } from "@/store/audio";

type RuntimeInfo = {
  ping: string;
  ip: string;
  browser: string;
  os: string;
};

const DEFAULT_INFO: RuntimeInfo = {
  ping: "--ms",
  ip: "0.0.0.0",
  browser: "Unknown",
  os: "Unknown",
};

const parseBrowser = (ua: string) => {
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  if (ua.includes("Firefox/")) return "Firefox";
  return "Unknown";
};

const parseOS = (ua: string) => {
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iPhone") || ua.includes("iPad")) return "iOS";
  if (ua.includes("Linux")) return "Linux";
  return "Unknown";
};

export default function SiteFooter() {
  const [info, setInfo] = useState<RuntimeInfo>(DEFAULT_INFO);
  const [copied, setCopied] = useState(false);
  const flashSystemMsg = useUIStore((state) => state.flashSystemMsg);
  const openAudioDock = useAudioStore((state) => state.open);
  const browserInfo = useMemo(() => {
    if (typeof navigator === "undefined") return DEFAULT_INFO;
    const ua = navigator.userAgent;
    return {
      ...DEFAULT_INFO,
      browser: parseBrowser(ua),
      os: parseOS(ua),
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const update = async () => {
      try {
        const pingStart = performance.now();
        await fetch("/api/ping", { cache: "no-store" });
        const pingMs = Math.round(performance.now() - pingStart);

        const ipRes = await fetch("/api/ip", { cache: "no-store" });
        const ipJson = await ipRes.json();

        if (!mounted) return;
        setInfo((prev) => ({
          ...prev,
          ping: `${pingMs}ms`,
          ip: ipJson?.ip ?? prev.ip,
          browser: browserInfo.browser,
          os: browserInfo.os,
        }));
      } catch {
        if (!mounted) return;
        setInfo((prev) => ({
          ...prev,
          browser: browserInfo.browser,
          os: browserInfo.os,
        }));
      }
    };

    update();
    const interval = setInterval(update, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [browserInfo.browser, browserInfo.os]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <footer className="fixed bottom-0 w-full z-40 border-t app-border panel-bg backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto h-10 px-6 flex items-center gap-6 overflow-x-auto whitespace-nowrap text-[10px] uppercase tracking-[0.3em] app-muted [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex items-center gap-4 min-w-max">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold hover:text-[color:var(--app-text)] transition-colors"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Home</span>
          </Link>

          <span className="h-4 w-px bg-[color:var(--border)]" />

          <div className="flex items-center gap-4 text-[9px] font-bold tracking-[0.35em]">
            <span className="text-[color:var(--accent)]">{info.ping}</span>
            <span>{info.ip}</span>
            <span>{info.browser}</span>
            <span>{info.os}</span>
          </div>

          <span className="h-4 w-px bg-[color:var(--border)]" />

          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              setCopied(true);
              flashSystemMsg("LINK_COPIED_TO_CLIPBOARD");
            }}
            className="flex items-center gap-2 font-bold hover:text-[color:var(--app-text)] transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>{copied ? "Copied" : "Copy Link"}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={openAudioDock}
          className="flex items-center gap-2 text-[9px] font-bold tracking-[0.35em] hover:text-[color:var(--app-text)] transition-colors min-w-max md:ml-auto"
        >
          <Music3 className="h-3.5 w-3.5" />
          <span>Audio Dock</span>
        </button>
      </div>
    </footer>
  );
}
