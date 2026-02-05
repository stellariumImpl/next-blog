import Link from "next/link";
import { Home, Music3 } from "lucide-react";

export default function SiteFooter() {
  return (
    <footer className="fixed bottom-0 w-full z-40 border-t app-border panel-bg backdrop-blur-md">
      <div className="max-w-screen-2xl mx-auto h-10 px-6 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] app-muted">
        <Link
          href="/"
          className="flex items-center gap-2 font-bold hover:text-[color:var(--app-text)] transition-colors"
        >
          <Home className="h-3.5 w-3.5" />
          <span>Home</span>
        </Link>

        <div className="flex items-center gap-2 text-[9px] font-bold tracking-[0.35em]">
          <Music3 className="h-3.5 w-3.5" />
          <span>Audio Dock</span>
        </div>
      </div>
    </footer>
  );
}
