/**
 * Verifies each social page application is active on its own path only.
 * Role: Locks which page a member sees for each path on every comparison branch.
 * Not in this file: Page rendering or single-spa itself.
 * Key dependencies: node:test; src/pages/pageRegistry.js; test/support/loadAppModule.js.
 * See also: src/pages/pageRegistry.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { PAGE_APP_NAMES, createPageAppRegistrations } = await loadAppModule(
  new URL("./pageRegistry.js", import.meta.url).href,
);

const pageApps = {
  feedPageApp: { id: "feed" },
  postsPageApp: { id: "posts" },
  loginPageApp: { id: "login" },
  accountPageApp: { id: "account" },
  notificationsPageApp: { id: "notifications" },
  singlePostPageApp: { id: "single-post" },
};

/**
 * Lists the page ids active for one pathname.
 *
 * @param {string} pathname - Location pathname.
 * @returns {string[]} Active page ids.
 */
function activePagesFor(pathname) {
  return createPageAppRegistrations(pageApps)
    .filter((registration) => registration.activeWhen({ pathname }))
    .map((registration) => registration.app.id);
}

test("each path activates exactly its own page", () => {
  assert.deepEqual(activePagesFor("/"), ["feed"]);
  assert.deepEqual(activePagesFor("/posts"), ["posts"]);
  assert.deepEqual(activePagesFor("/login"), ["login"]);
  assert.deepEqual(activePagesFor("/account"), ["account"]);
  assert.deepEqual(activePagesFor("/notifications"), ["notifications"]);
  assert.deepEqual(activePagesFor("/posts/post-01"), ["single-post"]);
});

test("an unknown path activates no page", () => {
  assert.deepEqual(activePagesFor("/unknown"), []);
  assert.deepEqual(activePagesFor("/account/extra"), []);
});

test("every registered page can be reloaded by name", () => {
  const registeredNames = createPageAppRegistrations(pageApps).map((registration) => registration.name);
  assert.deepEqual(registeredNames, PAGE_APP_NAMES);
});
