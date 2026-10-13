import { defineConfig } from "@playwright/test";

// Usa o Microsoft Edge instalado (canal "msedge") para não baixar navegadores; em CI, defina PW_CHANNEL=chromium.
const canal = process.env.PW_CHANNEL ?? "msedge";

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", channel: canal === "chromium" ? undefined : canal, colorScheme: "light" },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
