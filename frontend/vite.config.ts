import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Builds straight into src/agent-api/public so the existing
// `cp -r src/agent-api/public/. dist/agent-api/public/` build step picks up
// the compiled assets unchanged.
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, "../src/agent-api/public"),
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/tools": "http://localhost:8787",
      "/businesses": "http://localhost:8787",
      "/platforms": "http://localhost:8787",
      "/auth": "http://localhost:8787",
    },
  },
});
