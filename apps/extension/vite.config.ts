import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import path from "node:path";

import manifest from "./src/manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3200,
    strictPort: true,
    hmr: {
      port: 3201,
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      // Keep content-script chunks self-contained; CRXJS handles entry wiring.
      input: {},
    },
  },
});
