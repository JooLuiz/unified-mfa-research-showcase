/**
 * Verifies the notification center container contract shared by both branches.
 * Role: Locks the live-region attributes set when the center mounts.
 * Not in this file: How a shell raises the notification.
 * Key dependencies: node:test; src/mountNotificationCenter.js; test/support/installDomDocument.js.
 * See also: src/mountNotificationCenter.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import "../../../test/support/installBrowserGlobals.js";
import { mountNotificationCenter } from "./mountNotificationCenter.js";

test("mountNotificationCenter marks the container as a polite live region", () => {
  const attributes = new Map();
  const containerElement = {
    className: "",
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };

  mountNotificationCenter(containerElement, {
    subscribeToNotifications() {
      return function unsubscribeFromNotifications() {};
    },
  });

  assert.deepEqual(
    {
      className: containerElement.className,
      ariaLive: attributes.get("aria-live"),
      ariaAtomic: attributes.get("aria-atomic"),
    },
    {
      className: "notification-center",
      ariaLive: "polite",
      ariaAtomic: "false",
    },
  );
});

test("a raised toast shows its message, opens a link, and dismisses", () => {
  const timerCallbacks = [];
  window.setTimeout = (callback) => {
    timerCallbacks.push(callback);
    return timerCallbacks.length;
  };
  window.clearTimeout = () => {};
  const { root } = installDomDocument();
  const opened = [];
  let emitNotification = () => {};
  const unmount = mountNotificationCenter(root, {
    subscribeToNotifications(listener) {
      emitNotification = listener;
      return function unsubscribeFromNotifications() {};
    },
    onOpenLink(notification) {
      opened.push(notification.link);
    },
  });

  emitNotification({ type: "success", title: "Saved", message: "Done" });
  const savedToast = findElement(root, (node) => node.textContent === "Saved");
  assert.ok(savedToast);
  assert.match(root.textContent, /Done/);
  assert.equal(findElement(root, (node) => node.className.includes("notification-toast--linked")), null);
  savedToast.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.deepEqual(opened, []);

  const dismissButton = findElement(
    root,
    (node) => node.nodeName === "BUTTON" && node.textContent === "Dismiss",
  );
  dismissButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.equal(findElement(root, (node) => node.textContent === "Saved"), null);

  emitNotification({
    type: "success",
    title: "Order",
    message: "View it",
    link: "/orders/order-01",
  });
  const linkedToast = findElement(root, (node) => node.className.includes("notification-toast--linked"));
  linkedToast.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  assert.deepEqual(opened, ["/orders/order-01"]);
  assert.equal(findElement(root, (node) => node.textContent === "Order"), null);
  timerCallbacks.forEach((callback) => callback());

  unmount();
});
