const { defineConfig, devices } = require("@playwright/test");

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
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4200",
    reuseExistingServer: !process.env.CI,
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
