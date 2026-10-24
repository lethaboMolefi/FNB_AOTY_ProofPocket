import type { Config } from "tailwindcss";

// Every colour is a CSS variable so a dark theme can be added later.
const v = (name: string) => `var(--${name})`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        /* ProofPocket legacy tokens */
        bg: v("bg"), surface: v("surface"), "surface-2": v("surface-2"), line: v("line"),
        ink: v("ink"), muted: v("muted"),
        accent: v("accent"), "accent-ink": v("accent-ink"), "accent-soft": v("accent-soft"),
        good: v("good"), "good-soft": v("good-soft"),
        warn: v("warn"), "warn-soft": v("warn-soft"),
        bad: v("bad"), "bad-soft": v("bad-soft"),
        /* shadcn/ui tokens (oklch values — used directly, no hsl() wrapper) */
        border: v("border"),
        input: v("input"),
        ring: v("ring"),
        background: v("background"),
        foreground: v("foreground"),
        primary: { DEFAULT: v("primary"), foreground: v("primary-foreground") },
        secondary: { DEFAULT: v("secondary"), foreground: v("secondary-foreground") },
        destructive: { DEFAULT: v("destructive"), foreground: v("destructive-foreground") },
        "muted-foreground": v("muted-foreground"),
        "shadcn-accent": { DEFAULT: v("shadcn-accent"), foreground: v("shadcn-accent-foreground") },
        popover: { DEFAULT: v("popover"), foreground: v("popover-foreground") },
        card: { DEFAULT: v("card"), foreground: v("card-foreground") },
      },
      fontFamily: {
        display: ["Bricolage Grotesque", "Segoe UI", "system-ui", "sans-serif"],
        body: ["IBM Plex Sans", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        card: "10px",
        lg: v("radius"),
        md: v("radius"),
        sm: "calc(var(--radius) - 4px)",
      },
      screens: { desktop: "820px" },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
