import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "mobile-marketplace.spec.ts",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    browserName: "chromium",
    channel: process.env.CI ? undefined : "chrome",
  },
  webServer: {
    command: "corepack pnpm --filter @giyahero/mobile dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      VITE_SUPABASE_URL: "https://staging.example.test",
      VITE_SUPABASE_ANON_KEY: "test-key",
      VITE_WEB_ORIGIN: "https://stage.giyahero.test",
      VITE_AUTH_CALLBACK_URL:
        "https://stage.giyahero.test/mobile/auth/callback",
      VITE_BROWSER_PREVIEW: "true",
    },
  },
});
