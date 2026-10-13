/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  worker: { format: "es" },
  build: { chunkSizeWarningLimit: 1200 },
  test: { include: ["src/**/*.test.ts"], environment: "node", testTimeout: 60000 },
});
