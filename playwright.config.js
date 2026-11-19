const { defineConfig, devices } = require("@playwright/test");
const {
  V8_DIR_E2E,
  isAppScript,
  isAppSource,
} = require("./scripts/coverage/coverageFilters");

if (process.env.npm_lifecycle_event === "e2e:coverage") {
  process.env.E2E_COVERAGE = "1";
}

const e2eCoverage = process.env.E2E_COVERAGE === "1";

module.exports = defineConfig({
  testDir: "./e2e",
  globalSetup: require.resolve("./e2e/global-setup.js"),
  globalTeardown: require.resolve("./e2e/global-teardown.js"),
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  ...(e2eCoverage
    ? {
        reporter: [
          ["list"],
          [
            "monocart-reporter",
            {
              name: "E2E coverage",
              outputFile: "coverage/e2e/index.html",
              coverage: {
                outputDir: V8_DIR_E2E,
                reports: [["v8"], ["console-summary"], ["raw", { outputDir: "raw" }]],
                entryFilter: (entry) => isAppScript(entry.url),
                sourceFilter: (sourcePath) => isAppSource(sourcePath),
              },
            },
          ],
        ],
      }
    : {}),
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4200",
    reuseExistingServer: !process.env.CI && !e2eCoverage,
    timeout: 180_000,
  },
  projects: [
    {
      name: "ecommerce",
      testMatch: /ecommerce\/.*\.spec\.js/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4200" },
    },
    {
      name: "social",
      testMatch: /social\/.*\.spec\.js/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4500" },
    },
    {
      name: "admin",
      testMatch: /admin\/.*\.spec\.js/,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:4600" },
    },
  ],
});
