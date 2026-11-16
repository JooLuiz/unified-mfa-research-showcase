const { defineConfig, devices } = require("@playwright/test");

if (process.env.npm_lifecycle_event === "e2e:coverage") {
  process.env.E2E_COVERAGE = "1";
}

const e2eCoverage = process.env.E2E_COVERAGE === "1";
const appPorts = [
  4200, 4500, 4600, 4301, 4302, 4303, 4304, 4305, 4306, 4307, 4308, 4309, 4310,
  4311, 4312, 4313, 4314, 4315,
];

/**
 * Keeps scripts served by the shells and micro frontends.
 *
 * @param {string | undefined} url Script URL reported by Chromium.
 * @returns {boolean} True when the script belongs to an app dev server.
 */
function isAppScript(url) {
  if (!url) {
    return false;
  }
  const ignoredFragments = [
    "webpack-dev-server",
    "sockjs",
    "hot-update",
    "remoteEntry.js",
  ];
  if (ignoredFragments.some((fragment) => url.includes(fragment))) {
    return false;
  }
  return appPorts.some(
    (port) =>
      url.startsWith(`http://localhost:${port}/`) ||
      url.startsWith(`http://127.0.0.1:${port}/`),
  );
}

/**
 * Keeps original sources under an app or package src directory.
 *
 * @param {string | undefined} sourcePath Path Monocart resolved from the source map.
 * @returns {boolean} True when the file is application or shared-package source.
 */
function isAppSource(sourcePath) {
  if (!sourcePath || sourcePath.includes("node_modules")) {
    return false;
  }
  return /(?:^|[/\\])src[/\\]/.test(sourcePath);
}

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
                outputDir: "coverage/e2e/v8",
                reports: [["v8"], ["console-summary"]],
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
