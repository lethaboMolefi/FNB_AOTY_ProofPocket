import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const api = process.env.API_PROXY ?? "http://localhost:8787";

/**
 * Firebase Hosting's security headers (firebase.json), so `vite preview` (end-to-end tests, the CI ZAP scan)
 * runs under the same CSP as the hosted site. Over plain-http localhost, HSTS and the https upgrade are left out.
 */
function hostingHeaders(): Record<string, string> {
  const fb = JSON.parse(readFileSync(new URL("../../firebase.json", import.meta.url), "utf8")) as { hosting: { headers: { source: string; headers: { key: string; value: string }[] }[] }[] };
  const all = fb.hosting[0]!.headers.find((h) => h.source === "**")!.headers;
  return Object.fromEntries(all.filter((h) => h.key !== "Strict-Transport-Security")
    .map((h) => [h.key, h.key === "Content-Security-Policy" ? h.value.replace(/;\s*upgrade-insecure-requests/, "") : h.value]));
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        name: "ProofPocket",
        short_name: "ProofPocket",
        description: "Keep books, get paid and build proof that funders and buyers trust.",
        lang: "en-ZA",
        // "/" sends each person to their own portal once signed in.
        start_url: "/?source=pwa",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#FFFFFF",
        background_color: "#FFFFFF",
        categories: ["business", "finance", "productivity"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,webmanifest,woff2}"] },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": api },
  },
  preview: {
    port: 4173,
    headers: hostingHeaders(),
    proxy: { "/api": api },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  build: { target: "es2020", sourcemap: true },
});
