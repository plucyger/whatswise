"use client";

import { Toaster } from "sonner";

import { useTheme } from "@/hooks/use-theme";
import { useHydrated } from "@/components/layout/mode-toggle";

/**
 * Sonner toaster that follows the active mode. Colors come from the
 * popover tokens so toasts match menus and dialogs in both modes and
 * pick up accent changes without a reload.
 */
export function ThemedToaster() {
  const { resolvedMode } = useTheme();
  const hydrated = useHydrated();
  return (
    <Toaster
      theme={hydrated ? resolvedMode : "dark"}
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--popover)",
          border: "1px solid var(--border)",
          color: "var(--popover-foreground)",
          boxShadow: "var(--card-shadow)",
        },
      }}
    />
  );
}
