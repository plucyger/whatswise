"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  MODE_STORAGE_KEY,
  isModeId,
  normalizeAccent,
  type AccentId,
  type ModeId,
  type ResolvedMode,
} from "@/lib/themes";

/**
 * ThemeProvider — wraps the whole app, owns the appearance state:
 * color mode (light / dark / system) and accent.
 *
 * The boot script in `src/app/layout.tsx` has already applied the
 * `dark` class and `data-accent` to <html> before React hydrates, so
 * by the time this Provider mounts the page is already painted in
 * the right colors. We read what's there and keep it in sync.
 *
 * Persistence is localStorage only (device-scoped) — your phone may
 * deserve a different mode than your laptop.
 */

interface ThemeContextValue {
  /** The user's choice, including "system". */
  mode: ModeId;
  /** What's actually applied right now. */
  resolvedMode: ResolvedMode;
  setMode: (next: ModeId) => void;
  accent: AccentId;
  setAccent: (next: AccentId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DARK_QUERY = "(prefers-color-scheme: dark)";

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // localStorage can throw in private-browsing / sandboxed contexts.
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Same private-browsing edge case; in-memory state still updates.
  }
}

function systemMode(): ResolvedMode {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function resolve(mode: ModeId): ResolvedMode {
  return mode === "system" ? systemMode() : mode;
}

function applyMode(resolved: ResolvedMode) {
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

function applyAccent(accent: AccentId) {
  document.documentElement.dataset.accent = accent;
}

function readInitialMode(): ModeId {
  if (typeof window === "undefined") return DEFAULT_MODE;
  const stored = readStorage(MODE_STORAGE_KEY);
  return isModeId(stored) ? stored : DEFAULT_MODE;
}

function readInitialAccent(): AccentId {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  // Whatever the boot script applied is the truth.
  const fromAttr = document.documentElement.dataset.accent;
  return normalizeAccent(fromAttr ?? readStorage(ACCENT_STORAGE_KEY));
}

function readInitialResolved(): ResolvedMode {
  if (typeof window === "undefined") return "dark";
  return document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ModeId>(readInitialMode);
  const [resolvedMode, setResolvedMode] =
    useState<ResolvedMode>(readInitialResolved);
  const [accent, setAccentState] = useState<AccentId>(readInitialAccent);

  const setMode = useCallback((next: ModeId) => {
    const resolved = resolve(next);
    setModeState(next);
    setResolvedMode(resolved);
    applyMode(resolved);
    writeStorage(MODE_STORAGE_KEY, next);
  }, []);

  const setAccent = useCallback((next: AccentId) => {
    setAccentState(next);
    applyAccent(next);
    writeStorage(ACCENT_STORAGE_KEY, next);
  }, []);

  // In "system" mode, follow the OS as it flips (e.g. sunset schedule).
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia(DARK_QUERY);
    const onChange = () => {
      const resolved = systemMode();
      setResolvedMode(resolved);
      applyMode(resolved);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  // Sync from other tabs — change the mode or accent in tab A and
  // tab B catches up without a refresh.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === MODE_STORAGE_KEY && isModeId(e.newValue)) {
        const resolved = resolve(e.newValue);
        setModeState(e.newValue);
        setResolvedMode(resolved);
        applyMode(resolved);
      } else if (e.key === ACCENT_STORAGE_KEY) {
        const next = normalizeAccent(e.newValue);
        setAccentState(next);
        applyAccent(next);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return (
    <ThemeContext.Provider
      value={{ mode, resolvedMode, setMode, accent, setAccent }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for components rendered outside the provider — return
    // no-op setters so callers don't crash. The boot script still
    // applied the right attributes, so visually the page is fine.
    return {
      mode: DEFAULT_MODE,
      resolvedMode: "dark",
      setMode: () => {},
      accent: DEFAULT_ACCENT,
      setAccent: () => {},
    };
  }
  return ctx;
}
