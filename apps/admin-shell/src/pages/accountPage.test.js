/**
 * Verifies the admin account page and the sign-out control.
 * Role: Locks the account heading, dashboard return, and the disabled sign-out button.
 * Not in this file: Profile field editing inside the account remote.
 * Key dependencies: node:test; src/pages/accountPage.js; test/support/createPageDocument.js.
 * See also: src/pages/accountPage.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  installFetch,
  installPageDocument,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderAccountPage } = await loadAppModule(new URL("./accountPage.js", import.meta.url).href);

/**
 * Builds the signed-in admin the account page renders.
 *
 * @returns {object} Shell state.
 */
function createAdmin() {
  return {
    authToken: "token-01",
    currentUser: { id: "admin-01", username: "ada", fullName: "Ada Lovelace", role: "admin" },
  };
}

test("returns to the dashboard and keeps the account page when sign-out fails", async () => {
  installFetch((url) => {
    if (url.includes("sign-out-everywhere")) {
      return { throwError: new Error("sign out failed") };
    }
    return { body: {} };
  });
  resetLocation("/account");
  const pageRoot = createPageRoot();
  await renderAccountPage(createAdmin(), pageRoot, []);

  assert.match(pageRoot.textContent, /My Account/);
  pageRoot.querySelector("#backToDashboardButton").click();
  assert.equal(window.location.pathname, "/");

  const signOutButton = pageRoot.querySelector("#signOutEverywhereButton");
  signOutButton.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(signOutButton.disabled, true);
  assert.match(pageRoot.textContent, /My Account/);

  installFetch(() => ({ ok: true, body: {} }));
  signOutButton.disabled = false;
  signOutButton.click();
  await new Promise((resolve) => setTimeout(resolve, 0));

  installFetch(() => ({ body: { id: "admin-01", username: "ada", fullName: "Ada Lovelace", address: { city: "London" } } }));
  assert.match(pageRoot.textContent, /My Account/);
});
