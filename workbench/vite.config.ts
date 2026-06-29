import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone Workbench dev server. `/api/*` is proxied to the GS backend and
// the `/api` prefix stripped, so `/api/lpa/...` hits `/lpa/...` on :8000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true, rewrite: (p) => p.replace(/^\/api/, "") },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});
