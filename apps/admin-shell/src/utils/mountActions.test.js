/**
 * Verifies the admin header shows the signed-in name and ignores a missing element.
 * Role: Locks updateHeaderState and the bell mount outcome.
 * Not in this file: Admin page routing.
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

test("a missing admin header is ignored, and a signed-in header mounts the bell", async () => {
  const appState = { authToken: "", currentUser: null };
  assert.equal(updateHeaderState(appState, null), undefined);

  const layoutMounts = {
    headerMount: { children: [], appendChild(child) { this.children.push(child); child.parentNode = this; } },
    footerMount: { children: [], appendChild(child) { this.children.push(child); child.parentNode = this; } },
  };
  const guestHeader = mountHeaderAndFooter(appState, layoutMounts, null, []);
  assert.equal(guestHeader.state.isAuthenticated, false);
  assert.equal(guestHeader.state.currentUserName, "");
  assert.equal(guestHeader.state.appType, "admin");

  appState.authToken = "token-01";
  appState.currentUser = { username: "ada" };
  updateHeaderState(appState, guestHeader);
  assert.equal(guestHeader.state.currentUserName, "ada");
  assert.equal(guestHeader.state.isAuthenticated, true);

  appState.currentUser = { username: "ada", fullName: "Ada Lovelace" };
  const cleanups = [];
  nextHeaderHasBellSlot = true;
  mountHeaderAndFooter(appState, layoutMounts, {
    mountNotificationBell() {
      return function cleanupBell() {};
    },
  }, cleanups);
  await waitForMountTimer();
  assert.equal(cleanups.length, 1);
  assert.equal(layoutMounts.headerMount.children.at(-1).state.currentUserName, "Ada Lovelace");

  nextHeaderHasBellSlot = false;
  const withoutSlot = [];
  mountHeaderAndFooter(appState, layoutMounts, {
    mountNotificationBell() {
      return function cleanupBell() {};
    },
  }, withoutSlot);
  await waitForMountTimer();
  assert.equal(withoutSlot.length, 0);

  assert.equal(guestHeader.state.appType, "admin");
});
