import type { Config } from "tailwindcss";

// Every colour is a CSS variable (src/styles/tokens.css) so a dark theme can be added later.
const v = (name: string) => `var(--${name})`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"), surface: v("surface"), "surface-2": v("surface-2"), line: v("line"),
        ink: v("ink"), muted: v("muted"),
        accent: v("accent"), "accent-ink": v("accent-ink"), "accent-soft": v("accent-soft"),
        good: v("good"), "good-soft": v("good-soft"),
        warn: v("warn"), "warn-soft": v("warn-soft"),
        bad: v("bad"), "bad-soft": v("bad-soft"),
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "Segoe UI", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: { card: "10px" },
      screens: { desktop: "820px" },
    },
  },
  plugins: [],
} satisfies Config;
