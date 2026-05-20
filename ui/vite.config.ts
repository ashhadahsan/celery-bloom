import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "../celery_bloom/static",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": "http://localhost:5556",
      "/ws": { target: "ws://localhost:5556", ws: true },
    },
  },
});
