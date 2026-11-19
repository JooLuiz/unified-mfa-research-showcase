/**
 * Verifies inbox listener delivery and read commands that have nothing to send.
 * Role: Locks that one throwing listener does not block the next, and that an empty read does not change the rows.
 * Not in this file: EventSource frames or the inbox HTTP client.
 * Key dependencies: node:test; src/notificationInboxClient.js.
 * See also: src/notificationInboxClient.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  getNotificationInboxState,
  markAllNotificationsRead,
  markNotificationRead,
  stopNotificationInboxLiveEvents,
  subscribeToNotificationInbox,
} from "./notificationInboxClient.js";

test("a throwing listener still lets the next listener see the current rows", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const received = [];

  try {
    stopNotificationInboxLiveEvents();
    try {
      subscribeToNotificationInbox(() => {
        throw new Error("listener failed");
      });
    } catch (error) {
      assert.equal(error.message, "listener failed");
    }
    subscribeToNotificationInbox((rows) => {
      received.push(rows);
    });
    stopNotificationInboxLiveEvents();

    assert.deepEqual(getNotificationInboxState(), []);
    assert.deepEqual(received.at(-1), []);

    await markNotificationRead("");
    await markAllNotificationsRead();
    assert.deepEqual(getNotificationInboxState(), []);
  } finally {
    stopNotificationInboxLiveEvents();
    console.warn = originalWarn;
  }
});
