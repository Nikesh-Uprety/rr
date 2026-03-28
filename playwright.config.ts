import { defineConfig } from "@playwright/test";
import path from "node:path";

const PORT = Number(process.env.PORT ?? 5001);
const baseURL = `http://127.0.0.1:${PORT}`;
const authFile = path.join(import.meta.dirname, "tests/e2e/.auth/admin.json");
const useExistingServer = process.env.PLAYWRIGHT_USE_EXISTING === "1";
const browserName = process.env.PLAYWRIGHT_BROWSER === "chromium" ? "chromium" : "firefox";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html"], ["list"]] : "list",
  use: {
    baseURL,
    browserName,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: useExistingServer
    ? undefined
    : {
        command: "npm run dev",
        url: `${baseURL}/`,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          PORT: String(PORT),
          NODE_ENV: "development",
        },
        timeout: 120_000,
      },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "storefront",
      testMatch: /storefront\.spec\.ts/,
    },
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        storageState: authFile,
      },
    },
    {
      name: "admin-onboarding",
      testMatch: /admin-onboarding\.spec\.ts/,
    },
    {
      name: "admin-smoke",
      testMatch: /admin-smoke\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        storageState: authFile,
      },
    },
  ],
});
