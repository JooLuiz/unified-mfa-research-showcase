/**
 * Verifies the bell shows inbox rows and turns clicks into navigation.
 * Role: Locks the dropdown text and click outcomes shared by both comparison branches.
 * Not in this file: How the inbox list is delivered.
 * Key dependencies: node:test; src/NotificationBellView.js; @shared/notification-inbox-events.
 * See also: src/NotificationBellView.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
} from "@shared/notification-inbox-events";
import "../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

const jsxLoader = register(new URL("../../../scripts/test/jsxLoader.mjs", import.meta.url), import.meta.url);
if (jsxLoader && typeof jsxLoader.then === "function") {
  await jsxLoader;
}

const { NotificationBellView } = await loadAppModule(
  new URL("./NotificationBellView.js", import.meta.url).href,
);

const shippedNotification = {
  id: "note-shipped",
  title: "Order shipped",
  message: "Left the warehouse.",
  read: false,
  link: "/orders/order-01",
  createdAt: "2026-03-01T12:00:00.000Z",
};
const welcomeNotification = {
  id: "note-welcome",
  title: "Welcome",
  message: "Hello.",
  read: false,
  createdAt: "2026-03-02T12:00:00.000Z",
};

/**
 * Mounts the bell into a fresh document.
 *
 * @param {(path: string) => void} [navigate] - Shell navigation, when the host provides it.
 * @returns {{ root: object, unmount: () => void }} Mounted bell.
 */
function mountBell(navigate) {
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  act(() => {
    reactRoot.render(createElement(NotificationBellView, { navigate }));
  });
  return {
    root,
    unmount() {
      act(() => {
        reactRoot.unmount();
      });
    },
  };
}

/**
 * Clicks a button whose label or text matches.
 *
 * @param {object} root - Mounted document root.
 * @param {string} label - Accessible name or button text.
 * @returns {Promise<void>}
 */
async function clickButton(root, label) {
  const button = findElement(
    root,
    (node) =>
      node.nodeName === "BUTTON" &&
      (node.getAttribute("aria-label") === label || node.textContent === label),
  );
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

test("the closed bell opens, a click outside closes it, and See all asks for the inbox", async () => {
  const visited = [];
  const mounted = mountBell((path) => {
    visited.push(path);
  });

  try {
    await clickButton(mounted.root, "Notifications");
    assert.match(mounted.root.textContent, /No notifications yet/);

    await act(async () => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    assert.equal(mounted.root.textContent.includes("See all"), false);

    await clickButton(mounted.root, "Notifications");
    await clickButton(mounted.root, "See all");
    assert.deepEqual(visited, ["/notifications"]);
    assert.equal(mounted.root.textContent.includes("See all"), false);
  } finally {
    mounted.unmount();
  }
});

test("opening a linked row navigates, and a row without a link only closes the bell", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalEventSource = globalThis.EventSource;
  console.warn = () => {};
  globalThis.EventSource = class QuietEventSource {
    addEventListener() {}
    close() {}
  };
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ items: [shippedNotification, welcomeNotification] }),
  });
  const visited = [];
  let mounted;

  try {
    await startNotificationInboxLiveEvents({
      apiBaseUrl: "http://localhost:4000/api",
      authToken: "token-01",
      shell: "ecommerce",
    });
    mounted = mountBell((path) => {
      visited.push(path);
    });

    await clickButton(mounted.root, "Notifications");
    assert.match(mounted.root.textContent, /2 unread/);
    assert.match(mounted.root.textContent, /Order shipped/);

    const markReadButton = findElement(
      mounted.root,
      (node) => node.nodeName === "BUTTON" && node.textContent === "Mark as read",
    );
    await act(async () => {
      markReadButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.match(mounted.root.textContent, /See all/);

    const shippedRow = findElement(
      mounted.root,
      (node) => node.classList && node.classList.contains("notification-item") && node.textContent.includes("Order shipped"),
    );
    await act(async () => {
      shippedRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.deepEqual(visited, ["/orders/order-01"]);
    assert.equal(mounted.root.textContent.includes("See all"), false);

    await clickButton(mounted.root, "Notifications");
    const welcomeRow = findElement(
      mounted.root,
      (node) => node.classList && node.classList.contains("notification-item") && node.textContent.includes("Welcome"),
    );
    await act(async () => {
      welcomeRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.deepEqual(visited, ["/orders/order-01"]);
  } finally {
    mounted?.unmount();
    stopNotificationInboxLiveEvents();
    globalThis.fetch = originalFetch;
    globalThis.EventSource = originalEventSource;
    console.warn = originalWarn;
  }
});

test("a linked row does not navigate when the host did not provide navigation", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({ items: [shippedNotification] }),
  });
  let mounted;

  try {
    await startNotificationInboxLiveEvents({
      apiBaseUrl: "http://localhost:4000/api",
      authToken: "token-01",
      shell: "ecommerce",
    });
    mounted = mountBell();
    await clickButton(mounted.root, "Notifications");
    const shippedRow = findElement(
      mounted.root,
      (node) => node.classList && node.classList.contains("notification-item"),
    );
    await act(async () => {
      shippedRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(mounted.root.textContent.includes("See all"), false);
    await clickButton(mounted.root, "Notifications");
    await clickButton(mounted.root, "See all");
    assert.equal(mounted.root.textContent.includes("Order shipped"), false);
  } finally {
    mounted?.unmount();
    stopNotificationInboxLiveEvents();
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
