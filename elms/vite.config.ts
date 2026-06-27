import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

declare const process: { env: Record<string, string | undefined> };

// SINGLE_FILE=1 produces one self-contained index.html (everything inlined),
// which can be opened directly from disk (file://) or hosted anywhere.
const singleFile = process.env.SINGLE_FILE === "1";

export default defineConfig({
  base: "./",
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  server: {
    port: 5174,
    host: true,
  },
  build: {
    outDir: singleFile ? "standalone" : "dist",
    sourcemap: false,
  },
});
