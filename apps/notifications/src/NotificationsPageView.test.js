/**
 * Verifies the inbox page lists rows and opens a linked notification.
 * Role: Locks the page text and click outcomes shared by both comparison branches.
 * Not in this file: How the inbox list is delivered.
 * Key dependencies: node:test; src/NotificationsPageView.js; @shared/notification-inbox-events.
 * See also: src/NotificationsPageView.js.
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

const { NotificationsPageView } = await loadAppModule(
  new URL("./NotificationsPageView.js", import.meta.url).href,
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
  read: true,
  createdAt: "2026-03-02T12:00:00.000Z",
};

/**
 * Mounts the inbox page into a fresh document.
 *
 * @param {(path: string) => void} [navigate] - Shell navigation, when the host provides it.
 * @returns {{ root: object, unmount: () => void }} Mounted page.
 */
function mountPage(navigate) {
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  act(() => {
    reactRoot.render(createElement(NotificationsPageView, { navigate }));
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

test("an empty inbox shows the empty copy and disables mark-all", () => {
  const mounted = mountPage();
  try {
    assert.match(mounted.root.textContent, /Notification Inbox/);
    assert.match(mounted.root.textContent, /No notifications in your inbox/);
    const markAllButton = findElement(
      mounted.root,
      (node) => node.nodeName === "BUTTON" && node.textContent === "Mark all as read",
    );
    assert.equal(markAllButton.disabled, true);
  } finally {
    mounted.unmount();
  }
});

test("opening a linked row navigates, and a row without a link stays on the page", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalEventSource = globalThis.EventSource;
  console.warn = () => {};
  globalThis.EventSource = class QuietEventSource {
    addEventListener() {}
    close() {}
  };
  const readItems = [
    { ...shippedNotification, read: true },
    welcomeNotification,
  ];
  let inboxFetchCount = 0;
  globalThis.fetch = async () => {
    inboxFetchCount += 1;
    const items = inboxFetchCount === 1 ? [shippedNotification, welcomeNotification] : readItems;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ items }),
    };
  };
  const visited = [];
  let mounted;

  try {
    await startNotificationInboxLiveEvents({
      apiBaseUrl: "http://localhost:4000/api",
      authToken: "token-01",
      shell: "ecommerce",
    });
    mounted = mountPage((path) => {
      visited.push(path);
    });

    assert.match(mounted.root.textContent, /Order shipped/);
    const markReadButton = findElement(
      mounted.root,
      (node) => node.nodeName === "BUTTON" && node.textContent === "Mark as read",
    );
    const markAllButton = findElement(
      mounted.root,
      (node) => node.nodeName === "BUTTON" && node.textContent === "Mark all as read",
    );
    assert.equal(markAllButton.disabled, false);
    await act(async () => {
      markReadButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      markAllButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const markAllButtonAfterClick = findElement(
      mounted.root,
      (node) => node.nodeName === "BUTTON" && node.textContent === "Mark all as read",
    );
    assert.equal(markAllButtonAfterClick.disabled, true);
    await act(async () => {
      markAllButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(markAllButton.disabled, true);

    const shippedRow = findElement(
      mounted.root,
      (node) => node.classList && node.classList.contains("notification-item") && node.textContent.includes("Order shipped"),
    );
    await act(async () => {
      shippedRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.deepEqual(visited, ["/orders/order-01"]);

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
    mounted = mountPage();
    const shippedRow = findElement(
      mounted.root,
      (node) => node.classList && node.classList.contains("notification-item"),
    );
    await act(async () => {
      shippedRow.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.match(mounted.root.textContent, /Order shipped/);
  } finally {
    mounted?.unmount();
    stopNotificationInboxLiveEvents();
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
