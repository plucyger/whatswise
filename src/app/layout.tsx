import type { Metadata, Viewport } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemedToaster } from "@/components/layout/themed-toaster";
import { ThemeProvider } from "@/hooks/use-theme";
import {
  ACCENT_IDS,
  ACCENT_STORAGE_KEY,
  DEFAULT_ACCENT,
  DEFAULT_MODE,
  LEGACY_ACCENTS,
  MODE_IDS,
  MODE_STORAGE_KEY,
} from "@/lib/themes";

// Poppins isn't a variable font, so next/font needs the weights spelled
// out. 400–700 covers every font-{normal,medium,semibold,bold} in use.
const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "wacrm",
    template: "%s — wacrm",
  },
  description: "Self-hostable CRM template for WhatsApp.",
  robots: {
    index: false,
    follow: false,
  },
  icons: {
    icon: [{ url: "/icon" }],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export const viewport: Viewport = {
  // Mirrors --background in each mode (oklch → sRGB hex).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eaf5f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e191b" },
  ],
  colorScheme: "dark light",
};

// Inline boot script — runs before React hydrates so the user's
// chosen mode + accent are on the <html> element before first paint.
// Without this every page load would flash dark-teal for a frame
// before the React tree mounts and applies the saved preference.
//
// Kept dependency-free (no imports, no JSX) — must be a string the
// browser can run as a single <script>. Valid ids are sourced from
// the constants in lib/themes so adding an accent can't silently
// break the boot path.
const THEME_BOOT_SCRIPT = `
(function(){
  var root = document.documentElement;
  var mode = ${JSON.stringify(DEFAULT_MODE)};
  var accent = ${JSON.stringify(DEFAULT_ACCENT)};
  try {
    var MODES = ${JSON.stringify(MODE_IDS)};
    var ACCENTS = ${JSON.stringify(ACCENT_IDS)};
    var LEGACY = ${JSON.stringify(LEGACY_ACCENTS)};
    var savedMode = localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)});
    if (MODES.indexOf(savedMode) !== -1) mode = savedMode;
    var savedAccent = localStorage.getItem(${JSON.stringify(ACCENT_STORAGE_KEY)});
    if (ACCENTS.indexOf(savedAccent) !== -1) accent = savedAccent;
    else if (savedAccent && LEGACY.hasOwnProperty(savedAccent)) accent = LEGACY[savedAccent];
  } catch (_e) {}
  var dark = mode === "dark" ||
    (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", dark);
  root.dataset.accent = accent;
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-accent={DEFAULT_ACCENT}
      className={`${poppins.variable} ${geistMono.variable} dark h-full antialiased`}
      // The `theme-boot` script below rewrites the `dark` class and
      // `data-accent` on <html> from localStorage before React hydrates,
      // so for any non-default choice the client DOM intentionally
      // differs from the server render. suppressHydrationWarning
      // silences the expected mismatch — it only applies to this
      // element's own attributes, so genuine mismatches in children
      // still surface.
      suppressHydrationWarning
    >
      <head>
        <Script
          id="theme-boot"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
