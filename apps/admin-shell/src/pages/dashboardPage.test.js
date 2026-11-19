/**
 * Verifies the admin dashboard summary cards and the message shown when they fail.
 * Role: Locks the totals and the error text the dashboard leaves on the page.
 * Not in this file: Live refresh of the summary.
 * Key dependencies: node:test; src/pages/dashboardPage.js; test/support/createPageDocument.js.
 * See also: src/pages/dashboardPage.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installFetch, installPageDocument } from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderDashboardPage } = await loadAppModule(new URL("./dashboardPage.js", import.meta.url).href);

test("shows order, post, and revenue totals", async () => {
  installFetch((url) => {
    if (url.includes("/admin/orders")) {
      return {
        body: {
          total: 4,
          items: [{ totalAmount: 12.5 }, { totalAmount: Number.NaN }],
        },
      };
    }
    if (url.includes("/admin/posts")) {
      return { body: { total: 7, items: [] } };
    }
    return { body: {} };
  });
  const pageRoot = createPageRoot();
  await renderDashboardPage({ authToken: "token-01" }, pageRoot, []);
  assert.match(pageRoot.textContent, /Total Orders/);
  assert.match(pageRoot.textContent, /4/);
  assert.match(pageRoot.textContent, /Total Posts/);
  assert.match(pageRoot.textContent, /7/);
  assert.match(pageRoot.textContent, /\$12\.50/);
});

test("shows an error when the summary cannot be loaded", async () => {
  installFetch(() => ({ throwError: new Error("dashboard down") }));
  const pageRoot = createPageRoot();
  await renderDashboardPage({ authToken: "token-01" }, pageRoot, []);
  assert.match(pageRoot.textContent, /Unable to load dashboard data/);
});
