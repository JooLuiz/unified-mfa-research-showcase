/**
 * Verifies the notification center container contract shared by both branches.
 * Role: Locks the live-region attributes set when the center mounts.
 * Not in this file: Toast rendering. The mount arguments that deliver a toast differ by branch.
 * Key dependencies: node:test; src/mountNotificationCenter.js.
 * See also: src/mountNotificationCenter.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
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
