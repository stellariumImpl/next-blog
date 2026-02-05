import { create } from "zustand";
import { useEffect } from "react";

export type Theme = "dark" | "light";

type UIState = {
  theme: Theme;
  hydrated: boolean;
  searchOpen: boolean;
  systemMsg: string;
  navPending: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  hydrateTheme: (theme: Theme) => void;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  setNavPending: (pending: boolean) => void;
  flashSystemMsg: (msg: string, ttlMs?: number) => void;
  clearSystemMsg: () => void;
};

let systemMsgTimer: ReturnType<typeof setTimeout> | null = null;

const getInitialTheme = (): Theme => {
  if (typeof document === "undefined") return "dark";
  const dataTheme = document.documentElement.dataset.theme;
  return dataTheme === "light" ? "light" : "dark";
};

const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.cookie = `theme=${theme}; path=/; max-age=31536000`;
};

export const useUIStore = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  hydrated: typeof document !== "undefined",
  searchOpen: false,
  systemMsg: "",
  navPending: false,
  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme, hydrated: true });
  },
  toggleTheme: () => {
    const next = get().theme === "dark" ? "light" : "dark";
    applyTheme(next);
    set({ theme: next, hydrated: true });
  },
  hydrateTheme: (theme) => {
    if (get().hydrated) return;
    applyTheme(theme);
    set({ theme, hydrated: true });
  },
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setNavPending: (pending) => set({ navPending: pending }),
  flashSystemMsg: (msg, ttlMs = 3000) => {
    if (systemMsgTimer) {
      clearTimeout(systemMsgTimer);
    }
    set({ systemMsg: msg });
    systemMsgTimer = setTimeout(() => {
      set({ systemMsg: "" });
    }, ttlMs);
  },
  clearSystemMsg: () => set({ systemMsg: "" }),
}));

export function useEffectiveTheme(initialTheme: Theme) {
  const theme = useUIStore((state) => state.theme);
  const hydrated = useUIStore((state) => state.hydrated);
  const hydrateTheme = useUIStore((state) => state.hydrateTheme);

  useEffect(() => {
    hydrateTheme(initialTheme);
  }, [hydrateTheme, initialTheme]);

  return hydrated ? theme : initialTheme;
}
