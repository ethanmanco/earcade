import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// Relative base so the build works on a GitHub Pages project site
// (ethanmanco.github.io/earcade) without hard-coding the repo name.
export default defineConfig({
  base: "./",
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Earcade",
        short_name: "Earcade",
        description: "8-bit ear and theory trainer: intervals, chords, scale degrees and the fretboard in quick daily rounds.",
        theme_color: "#05050f",
        background_color: "#05050f",
        display: "standalone",
        orientation: "portrait",
        icons: [{ src: "favicon.svg", sizes: "any", type: "image/svg+xml" }],
      },
      workbox: {
        // Cache the app, the font and every note sample, so it plays offline.
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,mp3}"],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
    }),
  ],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
