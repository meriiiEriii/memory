import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages serves the site from /<repo-name>/, so the asset prefix must
// match when building for Pages (GH_PAGES=1). Local builds stay at "/".
const base = process.env.GH_PAGES ? "/memory/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Cloud AI endpoints are handled by server.js on port 3000.
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      // The MRL image-processing modules register themselves on window.MRL
      // when imported (no exports), so tree-shaking must not remove them.
      treeshake: false,
    },
  },
});
