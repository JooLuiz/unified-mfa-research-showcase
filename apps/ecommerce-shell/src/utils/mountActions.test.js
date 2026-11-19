/**
 * Verifies the ecommerce header reflects the cart and session, and mounts the bell when signed in.
 * Role: Locks the header and footer state mountHeaderAndFooter leaves in the page.
 * Not in this file: Header navigation inside the custom element.
 * Key dependencies: node:test; src/utils/mountActions.js; test/support/loadAppModule.js.
 * See also: src/utils/mountActions.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

let nextHeaderHasBellSlot = true;

/**
 * Installs the small document the header and footer mounts need.
 *
 * @returns {void}
 */
function installDocument() {
  class ShellElement extends EventTarget {
    constructor(tagName) {
      super();
      this.tagName = tagName;
      this.attributes = {};
      this.children = [];
      this.parentNode = null;
      this.style = {};
      this.bellSlot = tagName === "react-header-mfe" && nextHeaderHasBellSlot ? {} : null;
    }

    setAttribute(name, value) {
      this.attributes[name] = value;
    }

    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }

    removeChild(child) {
      this.children = this.children.filter((entry) => entry !== child);
      child.parentNode = null;
    }

    querySelector(selector) {
      if (selector === "#notificationBellMount") {
        return this.bellSlot;
      }
      return null;
    }
  }

  function createNode(tagName) {
    return new ShellElement(tagName);
  }

  globalThis.document = {
    body: createNode("body"),
    createElement: createNode,
  };
}

installDocument();

const { mountHeaderAndFooter, updateHeaderState } = await loadAppModule(
  new URL("./mountActions.js", import.meta.url).href,
);

/**
 * Waits until a zero-delay timer queued by the mount has run.
 *
 * @returns {Promise<void>}
 */
function waitForMountTimer() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

/**
 * Builds a shopper whose cart total can be checked on the header.
 *
 * @param {string} authToken - Signed-in token, or an empty string for a guest.
 * @returns {object} Shell state.
 */
function createShopper(authToken) {
  return {
    authToken,
    currentUser: authToken ? { username: "ada" } : null,
    cartItems: [
      { productId: "mug", quantity: 2 },
      { productId: "gone", quantity: 1 },
    ],
    productsById: { mug: { name: "Mug", price: 10 } },
    appliedCoupon: { discountPercentage: 50 },
  };
}

test("a missing header is ignored, and a mounted header shows the cart and the signed-in name", async () => {
  const appState = createShopper("");
  assert.equal(updateHeaderState(appState, null), undefined);

  const layoutMounts = {
    headerMount: { children: [], appendChild(child) { this.children.push(child); child.parentNode = this; } },
    footerMount: { children: [], appendChild(child) { this.children.push(child); child.parentNode = this; } },
  };
  const guestHeader = mountHeaderAndFooter(appState, layoutMounts, {}, []);
  assert.equal(guestHeader.state.isAuthenticated, false);
  assert.equal(guestHeader.state.currentUserName, "");
  assert.equal(guestHeader.state.totalPrice, 10);
  assert.equal(guestHeader.state.itemCount, 3);
  assert.equal(layoutMounts.footerMount.children.length, 1);

  appState.authToken = "token-01";
  appState.currentUser = { username: "ada", fullName: "Ada Lovelace" };
  updateHeaderState(appState, guestHeader);
  assert.equal(guestHeader.state.currentUserName, "Ada Lovelace");
  assert.equal(guestHeader.state.isAuthenticated, true);

  const cleanups = [];
  let bellMounts = 0;
  nextHeaderHasBellSlot = true;
  const signedInHeader = mountHeaderAndFooter(appState, layoutMounts, {
    mountNotificationBell() {
      bellMounts += 1;
      return function cleanupBell() {
        bellMounts -= 1;
      };
    },
  }, cleanups);
  await waitForMountTimer();
  assert.equal(bellMounts, 1);
  assert.equal(cleanups.length, 1);
  assert.equal(signedInHeader.state.currentUserName, "Ada Lovelace");

  nextHeaderHasBellSlot = false;
  const withoutSlot = [];
  mountHeaderAndFooter(appState, layoutMounts, {
    mountNotificationBell() {
      return function cleanupBell() {};
    },
  }, withoutSlot);
  await waitForMountTimer();
  assert.equal(withoutSlot.length, 0);

  const notAFunction = [];
  nextHeaderHasBellSlot = true;
  mountHeaderAndFooter(appState, layoutMounts, {
    mountNotificationBell() {
      return "not-a-function";
    },
  }, notAFunction);
  await waitForMountTimer();
  assert.equal(notAFunction.length, 0);

  mountHeaderAndFooter(appState, layoutMounts, {
    mountNotificationBell() {
      return function cleanupBell() {};
    },
  }, null);
  await waitForMountTimer();
  assert.equal(layoutMounts.headerMount.children.length > 0, true);

  assert.equal(signedInHeader.state.appType, "ecommerce");
});
