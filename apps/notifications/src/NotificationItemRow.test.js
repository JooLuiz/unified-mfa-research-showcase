/**
 * Verifies one inbox row shows its text and turns a click into the host's open action.
 * Role: Locks the row copy and click outcomes shared by both comparison branches.
 * Not in this file: Which rows the bell lists.
 * Key dependencies: node:test; src/NotificationItemRow.js; test/support/installDomDocument.js.
 * See also: src/NotificationItemRow.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

const jsxLoader = register(new URL("../../../scripts/test/jsxLoader.mjs", import.meta.url), import.meta.url);
if (jsxLoader && typeof jsxLoader.then === "function") {
  await jsxLoader;
}

const { NotificationItemRow } = await loadAppModule(
  new URL("./NotificationItemRow.js", import.meta.url).href,
);

/**
 * Finds the first element with a tag name under a mounted node.
 *
 * @param {object} node - DOM node to search.
 * @param {string} tagName - Uppercase tag name, such as "BUTTON".
 * @returns {object | null} The matching element.
 */
function findElement(node, tagName) {
  if (node.nodeName === tagName) {
    return node;
  }
  for (const child of node.childNodes || []) {
    const match = findElement(child, tagName);
    if (match) {
      return match;
    }
  }
  return null;
}

/**
 * Mounts one row and returns the rendered text.
 *
 * @param {object} notification - Inbox row the shopper sees.
 * @param {{ onOpenLink: (notification: object) => void, onMarkRead: (notificationId: string) => void }} handlers - Host actions.
 * @returns {{ root: object, unmount: () => void }} Mounted row.
 */
function mountRow(notification, handlers) {
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  act(() => {
    reactRoot.render(
      createElement(NotificationItemRow, {
        notification,
        onOpenLink: handlers.onOpenLink,
        onMarkRead: handlers.onMarkRead,
      }),
    );
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

test("a row shows its title and message, and a click opens that notification", () => {
  const opened = [];
  const markedRead = [];
  const notification = {
    id: "note-01",
    title: "Order shipped",
    message: "Your order left the warehouse.",
    read: true,
    createdAt: "not-a-date",
  };
  const mounted = mountRow(notification, {
    onOpenLink(openedNotification) {
      opened.push(openedNotification.id);
    },
    onMarkRead(notificationId) {
      markedRead.push(notificationId);
    },
  });

  try {
    assert.match(mounted.root.textContent, /Order shipped/);
    assert.match(mounted.root.textContent, /Your order left the warehouse/);
    assert.match(mounted.root.textContent, /not-a-date/);
    assert.equal(mounted.root.textContent.includes("Mark as read"), false);

    const row = mounted.root.childNodes[0];
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(opened, ["note-01"]);
    assert.deepEqual(markedRead, []);
  } finally {
    mounted.unmount();
  }
});

test("an unread row can be marked read without opening it, and a missing time is omitted", () => {
  const opened = [];
  const markedRead = [];
  const notification = {
    id: "note-02",
    title: "New reply",
    message: "Someone replied to your post.",
    read: false,
  };
  const mounted = mountRow(notification, {
    onOpenLink(openedNotification) {
      opened.push(openedNotification.id);
    },
    onMarkRead(notificationId) {
      markedRead.push(notificationId);
    },
  });

  try {
    assert.equal(findElement(mounted.root, "BUTTON").textContent, "Mark as read");
    assert.equal(
      mounted.root.childNodes[0].childNodes.some((child) =>
        String(child.className).includes("notification-item-time"),
      ),
      false,
    );
    assert.match(mounted.root.textContent, /Mark as read/);
    const markReadButton = findElement(mounted.root, "BUTTON");
    markReadButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(markedRead, ["note-02"]);
    assert.deepEqual(opened, []);
  } finally {
    mounted.unmount();
  }
});
