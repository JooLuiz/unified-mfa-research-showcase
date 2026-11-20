/**
 * Runs the shared unit suite, quietly unless logs were requested.
 * Role: Owns the Node test command so `npm test` and `npm run test:logs` share one file list.
 * Not in this file: Hiding console output (see quietReporter.mjs) or writing the coverage report.
 * Key dependencies: node:child_process; scripts/test/quietReporter.mjs.
 * See also: scripts/test/quietReporter.test.js; scripts/coverage/runUnitCoverage.js.
 */

const { spawnSync } = require("node:child_process");

const COVERAGE_INCLUDES = [
  "apps/mock-data-service/src/domain/**/*.js",
  "apps/mock-data-service/src/csv/**/*.js",
  "apps/mock-data-service/src/routes/**/*.js",
  "packages/*/src/**/*.js",
  "apps/product-list-page/src/productListFilters.js",
  "apps/product-list-page/src/hooks/useResponsiveGrid.js",
  "apps/ecommerce-shell/src/utils/cartSnapshot.js",
  "apps/ecommerce-shell/src/utils/cartSync.js",
  "apps/ecommerce-shell/src/commands/cartCommands.js",
  "apps/ecommerce-shell/src/events/eventBus.js",
  "apps/social-media-shell/src/events/eventBus.js",
  "apps/admin-shell/src/events/eventBus.js",
  "apps/formulary/src/faq-formulary.js",
  "apps/product-details-page/src/product-details.template.ts",
];

const TEST_FILES = [
  "apps/mock-data-service/src/domain/**/*.test.js",
  "apps/mock-data-service/src/csv/**/*.test.js",
  "apps/mock-data-service/src/infrastructure/**/*.test.js",
  "apps/mock-data-service/src/routes/**/*.test.js",
  "packages/*/src/**/*.test.js",
  "apps/product-list-page/src/productListFilters.test.js",
  "apps/product-list-page/src/hooks/useResponsiveGrid.test.js",
  "apps/product-list-page/src/hooks/useProductListData.test.js",
  "apps/product-card/src/product-card-component.test.js",
  "apps/social-media-posts/src/post-card.test.js",
  "apps/social-media-posts/src/post-feed.test.js",
  "apps/single-post/src/SinglePostCard.test.js",
  "apps/single-post/src/SinglePostView.test.js",
  "apps/ecommerce-shell/src/utils/cartSnapshot.test.js",
  "apps/ecommerce-shell/src/utils/cartSync.test.js",
  "apps/ecommerce-shell/src/utils/cartSyncTabs.test.js",
  "apps/product-details-page/src/product-details.template.test.js",
  "apps/ecommerce-shell/src/shellBootstrap.test.js",
  "apps/ecommerce-shell/src/commands/faqCommands.test.js",
  "apps/ecommerce-shell/src/commands/accountCommands.test.js",
  "apps/ecommerce-shell/src/commands/cartCommands.test.js",
  "apps/ecommerce-shell/src/commands/placeOrder.test.js",
  "apps/ecommerce-shell/src/exports/requestCsvExport.test.js",
  "apps/social-media-shell/src/exports/requestCsvExport.test.js",
  "apps/social-media-shell/src/commands/postCommands.test.js",
  "apps/social-media-shell/src/commands/postLikeCommands.test.js",
  "apps/social-media-shell/src/commands/accountCommands.test.js",
  "apps/admin-shell/src/commands/accountCommands.test.js",
  "apps/ecommerce-shell/src/utils/authActions.test.js",
  "apps/social-media-shell/src/utils/authActions.test.js",
  "apps/admin-shell/src/utils/authActions.test.js",
  "apps/order-details/src/order-details-utils.test.js",
  "apps/notifications/src/selectBellNotifications.test.js",
  "apps/notifications/src/NotificationItemRow.test.js",
  "apps/notifications/src/NotificationBellView.test.js",
  "apps/notifications/src/NotificationsPageView.test.js",
  "apps/ecommerce-shell/src/events/eventBus.test.js",
  "apps/ecommerce-shell/src/events/eventContracts.test.js",
  "apps/formulary/src/faq-formulary.test.js",
  "apps/ecommerce-shell/src/events/cartLiveEvents.test.js",
  "apps/ecommerce-shell/src/events/stockGating.test.js",
  "apps/admin-shell/src/events/eventBus.test.js",
  "apps/admin-shell/src/events/adminLiveEvents.test.js",
  "apps/social-media-shell/src/events/eventBus.test.js",
  "apps/ecommerce-shell/src/notifications/sessionState.test.js",
  "apps/admin-shell/src/notifications/sessionState.test.js",
  "apps/social-media-shell/src/notifications/sessionState.test.js",
  "apps/ecommerce-shell/src/notifications/notificationCenter.test.js",
  "apps/admin-shell/src/notifications/notificationCenter.test.js",
  "apps/social-media-shell/src/notifications/notificationCenter.test.js",
  "apps/product-list-page/src/productListApi.test.js",
  "apps/social-media-shell/src/utils/navigate.test.js",
  "apps/ecommerce-shell/src/commands/placeCheckoutOrder.test.js",
  "apps/ecommerce-shell/src/utils/cartActions.test.js",
  "apps/ecommerce-shell/src/utils/cartPersist.test.js",
  "apps/ecommerce-shell/src/utils/mountActions.test.js",
  "apps/admin-shell/src/utils/mountActions.test.js",
  "apps/social-media-shell/src/utils/mountActions.test.js",
  "apps/social-media-shell/src/utils/pageApps.test.js",
  "scripts/coverage/coverageFilters.test.js",
  "scripts/test/quietReporter.test.js",
  "apps/admin-shell/src/pages/accountPage.test.js",
  "apps/admin-shell/src/pages/dashboardPage.test.js",
  "apps/admin-shell/src/pages/loginPage.test.js",
  "apps/admin-shell/src/pages/orderDetailsPage.test.js",
  "apps/admin-shell/src/pages/ordersPage.test.js",
  "apps/admin-shell/src/pages/ordersTableView.test.js",
  "apps/admin-shell/src/pages/postsPage.test.js",
  "apps/admin-shell/src/pages/postsTableView.test.js",
  "apps/ecommerce-shell/src/pages/accountPage.test.js",
  "apps/ecommerce-shell/src/pages/authenticationPages.test.js",
  "apps/ecommerce-shell/src/pages/catalogPages.test.js",
  "apps/ecommerce-shell/src/pages/checkoutPage.test.js",
  "apps/ecommerce-shell/src/pages/homePage.test.js",
  "apps/ecommerce-shell/src/pages/orderPages.test.js",
  "apps/ecommerce-shell/src/pages/promotionsPage.test.js",
  "apps/social-media-shell/src/pages/accountPage.test.js",
  "apps/social-media-shell/src/pages/authenticationPages.test.js",
  "apps/social-media-shell/src/pages/feedPage.test.js",
  "apps/social-media-shell/src/pages/postsPage.test.js",
];

/**
 * Builds the Node arguments for one unit run.
 *
 * @param {{ logs: boolean }} options - When logs is true, console output from passing files is printed.
 * @returns {string[]} Arguments for the Node executable, excluding the executable itself.
 */
function unitTestArguments({ logs }) {
  const reporter = logs ? "spec" : "./scripts/test/quietReporter.mjs";
  const args = [
    "--experimental-strip-types",
    "--test",
    "--test-force-exit",
    "--experimental-test-coverage",
    `--test-reporter=${reporter}`,
    "--test-coverage-exclude=**/*.test.js",
    "--test-coverage-exclude=packages/server-events/**",
    ...COVERAGE_INCLUDES.map((pattern) => `--test-coverage-include=${pattern}`),
  ];
  if (!logs) {
    args.push("--disable-warning=ExperimentalWarning", "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON");
  }
  args.push(...TEST_FILES);
  return args;
}

/**
 * Spawns the unit suite and exits with its status.
 *
 * Side effects: Starts a Node test process and inherits its stdio.
 *
 * @returns {void}
 */
function main() {
  const logs = process.argv.includes("--logs");
  const result = spawnSync(process.execPath, unitTestArguments({ logs }), { stdio: "inherit" });
  process.exit(result.status ?? 1);
}

if (require.main === module) {
  main();
}

module.exports = { unitTestArguments };
