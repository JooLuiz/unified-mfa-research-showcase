/**
 * Playwright fixtures for the shared end-to-end suite.
 *
 * Role: exposes test, expect, and launchBrowser. During e2e:coverage, starts Chromium
 * JS coverage on every page and hands the V8 entries to monocart-reporter.
 * Not in this file: merging ranges, applying source maps, filtering, or writing the report.
 * Key dependencies: @playwright/test page.coverage; monocart-reporter addCoverageReport.
 * See also: e2e/coverage-dev-server.js, playwright.config.js, README.md
 */

const { test: base, expect, chromium } = require("@playwright/test");

const coverageEnabled = process.env.E2E_COVERAGE === "1";
const instrumentedBrowsers = new WeakSet();
const instrumentedContexts = new WeakSet();
const coveredPages = new WeakSet();
const submittedPages = new WeakSet();

let addCoverageReportPromise;

/**
 * Loads monocart-reporter's addCoverageReport once.
 *
 * Monocart Coverage Reports 3 is ESM-only, so this CommonJS file imports it dynamically.
 *
 * @returns {Promise<Function>} addCoverageReport(entries, testInfo).
 */
function loadAddCoverageReport() {
  if (!addCoverageReportPromise) {
    addCoverageReportPromise = import("monocart-reporter").then(
      (reporter) => reporter.addCoverageReport,
    );
  }
  return addCoverageReportPromise;
}

/**
 * Stops JS coverage for one page and submits the entries once.
 *
 * @param {import("@playwright/test").Page} page Page that already started JS coverage.
 * @returns {Promise<void>}
 * Side effects: writes the page's V8 entries into the Monocart coverage cache.
 */
async function deliverPage(page) {
  if (!coveredPages.has(page) || submittedPages.has(page)) {
    return;
  }
  submittedPages.add(page);

  let entries = [];
  try {
    entries = await page.coverage.stopJSCoverage();
  } catch (error) {
    return;
  }

  if (entries.length === 0) {
    return;
  }

  const addCoverageReport = await loadAddCoverageReport();
  await addCoverageReport(entries, test.info());
}

/**
 * Submits coverage for every page still open in a browser context.
 *
 * @param {import("@playwright/test").BrowserContext} context Context whose pages should be flushed.
 * @returns {Promise<void>}
 */
async function flushContext(context) {
  const openPages = context.pages();
  for (const page of openPages) {
    await deliverPage(page);
  }
}

/**
 * Starts JS coverage before the caller can navigate the page.
 *
 * resetOnNavigation stays false because the suite performs full page loads and
 * moves between the ecommerce, social, and admin origins.
 *
 * @param {import("@playwright/test").Page} page Newly created page.
 * @returns {Promise<import("@playwright/test").Page>} The same page.
 * Side effects: enables Chromium precise JS coverage and flushes it on page.close.
 */
async function coverPage(page) {
  if (coveredPages.has(page)) {
    return page;
  }
  coveredPages.add(page);
  await page.coverage.startJSCoverage({ resetOnNavigation: false });

  const originalClose = page.close.bind(page);
  page.close = async function close(options) {
    await deliverPage(page);
    await originalClose(options);
  };

  return page;
}

/**
 * Records pages created later on this context and flushes them when it closes.
 *
 * @param {import("@playwright/test").BrowserContext} context Browser context to instrument.
 * @returns {import("@playwright/test").BrowserContext} The same context.
 */
function instrumentContext(context) {
  if (instrumentedContexts.has(context)) {
    return context;
  }
  instrumentedContexts.add(context);

  const originalNewPage = context.newPage.bind(context);
  context.newPage = async function newPage(options) {
    const page = await originalNewPage(options);
    await coverPage(page);
    return page;
  };

  const originalClose = context.close.bind(context);
  context.close = async function close(options) {
    await flushContext(context);
    await originalClose(options);
  };

  return context;
}

/**
 * Records contexts created from this browser so their pages are covered.
 *
 * @param {import("@playwright/test").Browser} browser Browser to instrument.
 * @returns {import("@playwright/test").Browser} The same browser.
 */
function instrumentBrowser(browser) {
  if (instrumentedBrowsers.has(browser)) {
    return browser;
  }
  instrumentedBrowsers.add(browser);

  const originalNewContext = browser.newContext.bind(browser);
  browser.newContext = async function newContext(options) {
    const context = await originalNewContext(options);
    return instrumentContext(context);
  };

  return browser;
}

/**
 * Flushes coverage when a separately launched browser closes.
 *
 * @param {import("@playwright/test").Browser} browser Browser returned by chromium.launch.
 * @returns {void}
 */
function flushBrowserOnClose(browser) {
  const originalClose = browser.close.bind(browser);
  browser.close = async function close(options) {
    const contexts = browser.contexts();
    for (const context of contexts) {
      await flushContext(context);
    }
    await originalClose(options);
  };
}

const fixtures = {
  /**
   * Launches a separate Chromium process.
   *
   * Specs that open another shopper browser depend on a second process so a
   * signed-in tab does not exhaust Chrome's per-host connection cap. Options are
   * forwarded to chromium.launch, and the return value is that Browser.
   */
  launchBrowser: async ({}, use) => {
    if (!coverageEnabled) {
      await use((options) => chromium.launch(options));
      return;
    }

    const browsers = [];
    await use(async (options) => {
      const browser = instrumentBrowser(await chromium.launch(options));
      flushBrowserOnClose(browser);
      browsers.push(browser);
      return browser;
    });

    for (const browser of browsers) {
      if (browser.isConnected()) {
        await browser.close();
      }
    }
  },
};

if (coverageEnabled) {
  fixtures.browser = [
    async ({ browser }, use) => {
      instrumentBrowser(browser);
      await use(browser);
    },
    { scope: "worker" },
  ];
  fixtures.context = async ({ context }, use) => {
    await use(context);
    await flushContext(context);
  };
}

const test = base.extend(fixtures);

module.exports = { test, expect };
