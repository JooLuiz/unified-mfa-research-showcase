/**
 * Verifies the social header and footer mount, refresh after sign-in, and unmount.
 * Role: Locks the DOM and bell cleanup the social shell lifecycle leaves behind.
 * Not in this file: The header custom element's own navigation.
 * Key dependencies: node:test; src/utils/mountActions.js; src/events/eventBus.js; test/support/loadAppModule.js.
 * See also: src/utils/mountActions.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

/**
 * Installs the small document the header and footer mounts need.
 *
 * @returns {void}
 */
function createAnchor() {
  const anchor = { tagName: "a" };
  Object.defineProperty(anchor, "href", {
    set(value) {
      const nextUrl = new URL(value, "http://localhost");
      anchor.host = nextUrl.host;
      anchor.pathname = nextUrl.pathname;
      anchor.search = nextUrl.search;
      anchor.hash = nextUrl.hash;
    },
    get() {
      return `http://${anchor.host || "localhost"}${anchor.pathname || "/"}${anchor.search || ""}${anchor.hash || ""}`;
    },
  });
  return anchor;
}

function installDocument() {
  class ShellElement extends EventTarget {
    constructor(tagName) {
      super();
      this.tagName = tagName;
      this.attributes = {};
      this.children = [];
      this.parentNode = null;
      this.style = {};
      this.bellSlot = tagName === "react-header-mfe" ? {} : null;
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
    if (tagName === "a") {
      return createAnchor();
    }
    return new ShellElement(tagName);
  }

  globalThis.document = {
    body: createNode("body"),
    createElement: createNode,
  };
}

installDocument();

const { createFooterApp, createHeaderApp } = await loadAppModule(
  new URL("./mountActions.js", import.meta.url).href,
);
const { publishAuthSessionChanged } = await loadAppModule(
  new URL("../events/eventBus.js", import.meta.url).href,
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

test("the social header shows the signed-in name, and unmount removes the header and footer", async () => {
  const headerApp = createHeaderApp();
  const footerApp = createFooterApp();
  assert.equal(typeof (await headerApp.bootstrap()), "undefined");
  assert.equal(typeof (await footerApp.bootstrap()), "undefined");

  const pageRoot = {
    children: [],
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((entry) => entry !== child);
      child.parentNode = null;
    },
  };
  const appState = { authToken: "", currentUser: null };
  let bellMounts = 0;
  const modules = {
    mountNotificationBell() {
      bellMounts += 1;
      return function cleanupBell() {
        bellMounts -= 1;
      };
    },
  };

  await headerApp.mount({ appState, domElement: pageRoot, modules });
  await waitForMountTimer();
  assert.equal(pageRoot.children.length, 1);
  assert.equal(pageRoot.children[0].state.isAuthenticated, false);
  assert.equal(pageRoot.children[0].state.currentUserName, "");
  assert.equal(bellMounts, 0);

  assert.equal(pageRoot.children[0].state.currentUserName, "");

  await headerApp.unmount();
  assert.equal(pageRoot.children.length, 0);
  assert.equal(bellMounts, 0);
  await headerApp.unmount();
  assert.equal(pageRoot.children.length, 0);

  const signedInApp = createHeaderApp();
  const signedInRoot = {
    children: [],
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    },
    removeChild(child) {
      this.children = this.children.filter((entry) => entry !== child);
      child.parentNode = null;
    },
  };
  let signedInBells = 0;
  await signedInApp.mount({
    appState: { authToken: "token-01", currentUser: { username: "ada" } },
    domElement: signedInRoot,
    modules: {
      mountNotificationBell() {
        signedInBells += 1;
        return function cleanupBell() {
          signedInBells -= 1;
        };
      },
    },
  });
  await waitForMountTimer();
  assert.equal(signedInRoot.children[0].state.isAuthenticated, true);
  assert.equal(signedInRoot.children[0].state.currentUserName, "ada");
  assert.equal(signedInBells, 1);
  await signedInApp.unmount();
  assert.equal(signedInBells, 0);
  assert.equal(signedInRoot.children.length, 0);

  await footerApp.mount({ domElement: pageRoot });
  assert.equal(pageRoot.children.length, 1);
  assert.equal(
    pageRoot.children[0].attributes.message,
    "© 2026 Benchmark Micro Frontend Environment - Social Channel.",
  );
  await footerApp.unmount();
  assert.equal(pageRoot.children.length, 0);
  await footerApp.unmount();
  assert.equal(pageRoot.children.length, 0);
});
