/**
 * Verifies the toast payload guards shared by every shell.
 * Role: Locks the required type, title, and message, and which optional fields are copied.
 * Not in this file: Transport delivery or toast DOM.
 * Key dependencies: node:test; src/notificationPayload.js.
 * See also: src/notificationPayload.js; src/createNotificationAdapter.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationPayload } from "./notificationPayload.js";

test("createNotificationPayload rejects a non-object and an unknown type", () => {
  assert.throws(
    () => createNotificationPayload(null),
    /requires a notification object/,
  );
  assert.throws(
    () => createNotificationPayload({ type: "info", title: "Hi", message: "There" }),
    /type success or error/,
  );
});

test("createNotificationPayload copies duration and notification id and omits an empty link", () => {
  const payload = createNotificationPayload({
    type: "success",
    title: "Saved",
    message: "Your profile was saved.",
    durationMs: 4000,
    link: "",
    notificationId: "notification-01",
  });

  assert.deepEqual(payload, {
    type: "success",
    title: "Saved",
    message: "Your profile was saved.",
    durationMs: 4000,
    notificationId: "notification-01",
  });
});
