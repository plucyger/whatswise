/**
 * Single source of truth for the appearance catalog: color mode
 * (light / dark / system) and accent color.
 *
 * The CSS variables themselves live in `src/app/globals.css` —
 * `:root` (light), `.dark` (dark) and one `html[data-accent="..."]`
 * block per non-default accent. This module only carries the
 * metadata the UI (settings picker, header toggle, no-flash boot
 * script) needs.
 *
 * Adding a new accent is a two-step change:
 *   1. Append an `html[data-accent="<id>"]` block in globals.css with
 *      the four `--accent-l / -lf / -d / -df` tokens.
 *   2. Add an entry below. The order here drives the picker grid.
 */

// ---- Mode ---------------------------------------------------------

export const MODE_IDS = ["light", "dark", "system"] as const;

export type ModeId = (typeof MODE_IDS)[number];

/** What actually ends up on <html> once "system" is resolved. */
export type ResolvedMode = "light" | "dark";

export const DEFAULT_MODE: ModeId = "dark";

export const MODE_STORAGE_KEY = "wacrm.mode";

export function isModeId(value: unknown): value is ModeId {
  return (
    typeof value === "string" &&
    (MODE_IDS as ReadonlyArray<string>).includes(value)
  );
}

// ---- Accent -------------------------------------------------------

export const ACCENT_IDS = [
  "teal",
  "ocean",
  "fern",
  "saffron",
  "plum",
  "berry",
] as const;

export type AccentId = (typeof ACCENT_IDS)[number];

export const DEFAULT_ACCENT: AccentId = "teal";

/**
 * Kept as `wacrm.theme` so existing installs keep their pick: the
 * accents replaced the old five dark-only themes one-for-one (see
 * LEGACY_ACCENTS), and reading the old key lets us migrate silently.
 */
export const ACCENT_STORAGE_KEY = "wacrm.theme";

/** Old theme id → the new accent that replaced it. */
export const LEGACY_ACCENTS: Readonly<Record<string, AccentId>> = {
  violet: "plum",
  emerald: "fern",
  cobalt: "ocean",
  amber: "saffron",
  rose: "berry",
};

export interface AccentMeta {
  id: AccentId;
  name: string;
  tagline: string;
  /**
   * Static swatch colors for the picker chip, one per mode. Hard-coded
   * so the picker doesn't need a getComputedStyle round trip. Must
   * mirror the accent's primary in globals.css.
   */
  swatch: { light: string; dark: string };
}

export const ACCENTS: ReadonlyArray<AccentMeta> = [
  {
    id: "teal",
    name: "Teal",
    tagline: "The default — calm, soft, and easy on the eyes.",
    swatch: { light: "oklch(0.532 0.1 195)", dark: "oklch(0.75 0.115 190)" },
  },
  {
    id: "ocean",
    name: "Ocean",
    tagline: "Clean B2B blue — steady and product-y.",
    swatch: { light: "oklch(0.52 0.13 250)", dark: "oklch(0.75 0.115 245)" },
  },
  {
    id: "fern",
    name: "Fern",
    tagline: "Growth-coded green that nods at messaging.",
    swatch: { light: "oklch(0.52 0.12 160)", dark: "oklch(0.76 0.14 160)" },
  },
  {
    id: "saffron",
    name: "Saffron",
    tagline: "Warm and friendly — good for SMB teams.",
    swatch: { light: "oklch(0.54 0.115 65)", dark: "oklch(0.8 0.13 75)" },
  },
  {
    id: "plum",
    name: "Plum",
    tagline: "Confident and slightly playful.",
    swatch: { light: "oklch(0.52 0.15 310)", dark: "oklch(0.76 0.12 310)" },
  },
  {
    id: "berry",
    name: "Berry",
    tagline: "Bold and modern — D2C, creators, lifestyle.",
    swatch: { light: "oklch(0.53 0.17 355)", dark: "oklch(0.76 0.13 355)" },
  },
];

export function isAccentId(value: unknown): value is AccentId {
  return (
    typeof value === "string" &&
    (ACCENT_IDS as ReadonlyArray<string>).includes(value)
  );
}

/** Accepts a stored value (current or legacy id) and returns a valid accent. */
export function normalizeAccent(value: unknown): AccentId {
  if (isAccentId(value)) return value;
  if (typeof value === "string" && value in LEGACY_ACCENTS) {
    return LEGACY_ACCENTS[value];
  }
  return DEFAULT_ACCENT;
}
