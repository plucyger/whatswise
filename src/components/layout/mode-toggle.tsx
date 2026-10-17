"use client";

import { useSyncExternalStore } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";

import { useTheme } from "@/hooks/use-theme";
import type { ModeId } from "@/lib/themes";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const MODE_OPTIONS: ReadonlyArray<{
  id: ModeId;
  label: string;
  icon: typeof Sun;
}> = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

const noopSubscribe = () => () => {};

/**
 * True once we're rendering on the client. The saved mode lives in
 * localStorage, so anything that renders it has to wait for hydration
 * or the server HTML (always the default) won't match the client.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/**
 * Header button for switching Light / Dark / System. The icon shows the
 * mode that's actually applied; the menu marks the saved choice.
 */
export function ModeToggle({ className }: { className?: string }) {
  const { mode, resolvedMode, setMode } = useTheme();
  const hydrated = useHydrated();
  const Icon = hydrated && resolvedMode === "light" ? Sun : Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Change color mode"
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-popup-open:bg-muted data-popup-open:text-foreground",
          className,
        )}
      >
        <Icon className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="min-w-36">
        {MODE_OPTIONS.map((opt) => (
          <DropdownMenuItem key={opt.id} onClick={() => setMode(opt.id)}>
            <opt.icon className="size-4" />
            {opt.label}
            {hydrated && mode === opt.id ? (
              <Check className="ml-auto size-4 text-primary" />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
