import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const api = process.env.API_PROXY ?? "http://localhost:8787";

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
      injectManifest: { globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"] },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: { "/api": api },
  },
  preview: {
    port: 4173,
    proxy: { "/api": api },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: { target: "es2020", sourcemap: true },
});
