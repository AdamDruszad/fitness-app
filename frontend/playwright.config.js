import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 3,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5204",
    browserName: "chromium",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  projects: [
    { name: "small-phone-dark", use: { viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true, colorScheme: "dark" } },
    { name: "phone-light", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, colorScheme: "light" } },
    { name: "tablet-dark", use: { viewport: { width: 768, height: 1024 }, colorScheme: "dark" } },
    { name: "desktop-dark", use: { viewport: { width: 1440, height: 900 }, colorScheme: "dark" } },
    { name: "desktop-light", use: { viewport: { width: 1440, height: 900 }, colorScheme: "light" } },
  ],
  webServer: {
    command: "npm run preview:test",
    url: "http://127.0.0.1:5204",
    reuseExistingServer: false,
    env: { VITE_API_URL: "http://localhost:8000" },
  },
});
