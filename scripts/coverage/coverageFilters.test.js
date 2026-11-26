/**
 * Verifies which sources the combined coverage report keeps and how webpack names become repo paths.
 * Role: Locks the src filter and the webpack-to-repo path rewrite.
 * Not in this file: Collecting V8 ranges or writing the coverage report.
 * Key dependencies: node:test; scripts/coverage/coverageFilters.js.
 * See also: scripts/coverage/coverageFilters.js; scripts/coverage/combineCoverage.js.
 */

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");
const { isAppSource, toRepoSourcePath } = require("./coverageFilters.js");

test("isAppSource keeps app and package sources, including TypeScript and CSS", () => {
  assert.equal(isAppSource("apps/admin-shell/src/events/eventBus.js"), true);
  assert.equal(isAppSource("packages/shell-events/src/shellEventsContracts.js"), true);
  assert.equal(isAppSource("apps/checkout/src/checkout-summary.ts"), true);
  assert.equal(isAppSource("apps/account/src/styles.css"), true);
});

test("isAppSource rejects tests, declarations, dependencies, and dist output", () => {
  assert.equal(isAppSource("apps/admin-shell/src/events/eventBus.test.js"), false);
  assert.equal(isAppSource("packages/shell-events/src/index.d.ts"), false);
  assert.equal(isAppSource("apps/checkout/src/styles.d.js"), false);
  assert.equal(
    isAppSource("apps/account/node_modules/vue/src/index.js"),
    false,
  );
  assert.equal(isAppSource("apps/account/dist/main.js"), false);
});

test("isAppSource rejects type-only files, Angular bootstrap, and standalone preview entries", () => {
  assert.equal(isAppSource("apps/product-details-page/src/product-details.types.ts"), false);
  assert.equal(isAppSource("apps/product-showcase/src/showcase-types.ts"), false);
  assert.equal(isAppSource("apps/product-details-page/src/polyfills.ts"), false);
  assert.equal(isAppSource("apps/checkout/src/bootstrap-app.ts"), false);
  assert.equal(isAppSource("apps/banners/src/index.js"), false);
  assert.equal(isAppSource("apps/global-layout/header/src/index.js"), false);
  assert.equal(isAppSource("apps/checkout/src/index.ts"), false);
  assert.equal(isAppSource("apps/product-details-page/src/index.ts"), false);
  assert.equal(isAppSource("apps/ecommerce-shell/src/index.js"), true);
  assert.equal(isAppSource("apps/admin-shell/src/index.js"), true);
  assert.equal(isAppSource("apps/social-media-shell/src/index.js"), true);
  assert.equal(isAppSource("packages/account-events/src/index.js"), true);
});

test("toRepoSourcePath maps webpack app and package sources onto repo paths", () => {
  assert.equal(
    toRepoSourcePath("@apps/formulary/src/mountAgnosticFormulary.js", {
      url: "webpack://@apps/formulary/./src/mountAgnosticFormulary.js",
    }),
    "apps/formulary/src/mountAgnosticFormulary.js",
  );
  assert.equal(
    toRepoSourcePath("@apps/formulary/packages/iframe-bridge/src/createIframeBridge.js", {
      url: "webpack://@apps/formulary/../../packages/iframe-bridge/src/createIframeBridge.js",
    }),
    "packages/iframe-bridge/src/createIframeBridge.js",
  );
  assert.equal(
    toRepoSourcePath("@apps/account/src/styles.css-?f8a6", {
      url: "webpack://@apps/account/./src/styles.css?f8a6",
    }),
    "apps/account/src/styles.css",
  );
  assert.equal(
    toRepoSourcePath("apps/global-layout-header/src/header-element.js", {
      url: "webpack://@apps/global-layout-header/./src/header-element.js",
    }),
    "apps/global-layout/header/src/header-element.js",
  );
});

test("toRepoSourcePath maps an absolute server file onto the repo path", () => {
  const absolutePath = path.resolve("apps/mock-data-service/src/server.js");
  assert.equal(
    toRepoSourcePath(absolutePath, { url: pathToFileURL(absolutePath).href }),
    "apps/mock-data-service/src/server.js",
  );
  assert.equal(
    toRepoSourcePath(absolutePath),
    "apps/mock-data-service/src/server.js",
  );
});

test("toRepoSourcePath leaves a repo path unchanged aside from a query", () => {
  assert.equal(
    toRepoSourcePath("apps/admin-shell/src/events/eventBus.js"),
    "apps/admin-shell/src/events/eventBus.js",
  );
  assert.equal(
    toRepoSourcePath("apps/account/src/styles.css?f8a6"),
    "apps/account/src/styles.css",
  );
});
