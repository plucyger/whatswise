"use client";

import { Check } from "lucide-react";

import { MODE_OPTIONS, useHydrated } from "@/components/layout/mode-toggle";
import { useTheme } from "@/hooks/use-theme";
import { ACCENTS, type AccentMeta } from "@/lib/themes";
import { cn } from "@/lib/utils";

/**
 * Appearance panel — color mode + accent picker.
 *
 * Click an option → applies + persists immediately. No save button:
 * both are a class / attribute swap on <html>, there's nothing to
 * roll back. The active option carries a check chip + a primary-tinted
 * border so the current pick is obvious.
 *
 * Persistence: localStorage only (device-scoped). The boot script in
 * layout.tsx replays the choice before first paint on subsequent
 * loads.
 */
export function AppearancePanel() {
  const { mode, setMode, accent, setAccent, resolvedMode } = useTheme();
  // Saved choices live in localStorage, so the server render can't
  // know them — hold the "active" markers until we're on the client.
  const hydrated = useHydrated();

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Mode</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Light, dark, or follow your device&apos;s setting. Saved to
            this device.
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="Color mode"
          className="grid max-w-md grid-cols-3 gap-2"
        >
          {MODE_OPTIONS.map((opt) => {
            const active = hydrated && mode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(opt.id)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg border bg-card px-3 py-3 text-sm font-medium shadow-card transition-colors",
                  active
                    ? "border-primary/60 text-primary ring-2 ring-primary/40"
                    : "border-border text-muted-foreground hover:border-foreground/15 hover:bg-muted hover:text-foreground",
                )}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Accent color
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The color used for buttons, active navigation, and badges.
            Every accent is tuned for both light and dark mode. Saved to
            this device.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCENTS.map((a) => (
            <AccentCard
              key={a.id}
              accent={a}
              swatch={
                hydrated && resolvedMode === "light"
                  ? a.swatch.light
                  : a.swatch.dark
              }
              isActive={hydrated && a.id === accent}
              onPick={() => setAccent(a.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function AccentCard({
  accent,
  swatch,
  isActive,
  onPick,
}: {
  accent: AccentMeta;
  swatch: string;
  isActive: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isActive}
      aria-label={`Use ${accent.name} accent`}
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card p-4 text-left shadow-card transition-colors",
        isActive
          ? "border-primary/60 ring-2 ring-primary/40"
          : "border-border hover:border-foreground/15 hover:bg-muted/40",
      )}
    >
      <div className="flex items-center justify-between">
        <span
          aria-hidden
          className="h-8 w-8 shrink-0 rounded-full"
          style={{
            background: swatch,
            boxShadow: "inset 0 0 0 1px oklch(0.5 0 0 / 0.15)",
          }}
        />
        {isActive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            <Check className="h-3 w-3" />
            Active
          </span>
        )}
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground">
          {accent.name}
        </div>
        <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {accent.tagline}
        </div>
      </div>
      {/* Light + dark swatch strip so you can see both variants. */}
      <div className="mt-1 flex h-2 overflow-hidden rounded-full" aria-hidden>
        <span className="flex-1" style={{ background: accent.swatch.light }} />
        <span className="flex-1" style={{ background: accent.swatch.dark }} />
      </div>
    </button>
  );
}
