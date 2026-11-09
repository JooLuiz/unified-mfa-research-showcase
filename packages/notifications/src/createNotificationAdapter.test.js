/**
 * Verifies toast messages on an injected transport.
 * Role: Locks the notifications.raised payload and the required-field guard.
 * Not in this file: Toast DOM or the shell window event name.
 * Key dependencies: node:test; src/createNotificationAdapter.js; test/support/createRecordingTransport.js.
 * See also: src/createNotificationAdapter.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationAdapter } from "./createNotificationAdapter.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("notify publishes a local notifications.raised payload and omits an empty link", () => {
  const transport = createRecordingTransport();
  const notifications = createNotificationAdapter(transport);

  notifications.notify({
    type: "success",
    title: "Posts exported",
    message: "Your posts have been downloaded as a CSV file.",
    link: "",
    notificationId: "notification-01",
  });

  assert.deepEqual(transport.published, [
    {
      topic: "notifications",
      event: "raised",
      payload: {
        type: "success",
        title: "Posts exported",
        message: "Your posts have been downloaded as a CSV file.",
        notificationId: "notification-01",
      },
      scope: "local",
    },
  ]);
});

test("notify throws when title or message is missing and does not publish", () => {
  const transport = createRecordingTransport();
  const notifications = createNotificationAdapter(transport);

  assert.throws(
    () => notifications.notify({ type: "error", title: "Export failed" }),
    /title and message/,
  );
  assert.deepEqual(transport.published, []);
});

test("subscribeToNotifications delivers the payload until unsubscribe", () => {
  const transport = createRecordingTransport();
  const notifications = createNotificationAdapter(transport);
  const received = [];
  const unsubscribe = notifications.subscribeToNotifications((payload) => {
    received.push(payload);
  });

  notifications.notify({
    type: "error",
    title: "Export failed",
    message: "Try again.",
    link: "/account",
  });
  unsubscribe();
  notifications.notify({ type: "success", title: "Later", message: "Ignored." });

  assert.deepEqual(received, [
    {
      type: "error",
      title: "Export failed",
      message: "Try again.",
      link: "/account",
    },
  ]);
});
