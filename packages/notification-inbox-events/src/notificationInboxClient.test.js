/**
 * Verifies inbox listener delivery and read commands that have nothing to send.
 * Role: Locks that one throwing listener does not block the next, and that an empty read does not change the rows.
 * Not in this file: EventSource frames or the inbox HTTP client.
 * Key dependencies: node:test; src/notificationInboxClient.js.
 * See also: src/notificationInboxClient.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import {
  getNotificationInboxState,
  markAllNotificationsRead,
  markNotificationRead,
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNewInboxNotifications,
  subscribeToNotificationInbox,
} from "./notificationInboxClient.js";

test("a throwing listener still lets the next listener see the current rows", async () => {
  const originalWarn = console.warn;
  const previousWindow = globalThis.window;
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

    const welcome = { id: "note-01", title: "Welcome", read: false };
    const shipped = { id: "note-02", title: "Shipped", read: false };
    const readWelcome = { ...welcome, read: true };
    const transport = createRecordingTransport({
      requestReplies: [
        { ok: true, items: [welcome] },
        { ok: true, notification: readWelcome },
        { ok: true, items: [readWelcome, { ...shipped, read: true }] },
      ],
    });
    const snapshots = [];
    const unsubscribe = subscribeToNotificationInbox((rows) => {
      snapshots.push(rows.map((row) => row.id));
    });
    await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });
    transport.deliver("notification-inbox", "changed", shipped);
    transport.deliver("notification-inbox", "changed", [shipped]);
    assert.deepEqual(getNotificationInboxState().map((row) => row.id), ["note-02", "note-01"]);

    await markNotificationRead("note-01");
    assert.equal(getNotificationInboxState().find((row) => row.id === "note-01").read, true);

    await markAllNotificationsRead();
    assert.deepEqual(
      getNotificationInboxState().map((row) => row.id),
      ["note-01", "note-02"],
    );
    assert.ok(snapshots.some((ids) => ids.includes("note-02") && ids.includes("note-01")));
    unsubscribe();

    const freshNotes = [];
    const unsubscribeNew = subscribeToNewInboxNotifications((row) => {
      freshNotes.push(row.id);
    });
    stopNotificationInboxLiveEvents();
    globalThis.window = {
      setTimeout() {
        return 1;
      },
      clearTimeout() {},
    };
    const failingTransport = createRecordingTransport({
      requestReplies: [
        { ok: true, items: [welcome] },
        { ok: false },
        { ok: true, items: [welcome] },
        { ok: false },
      ],
    });
    await startNotificationInboxLiveEvents(failingTransport, { shell: "" });
    assert.deepEqual(getNotificationInboxState(), []);
    await startNotificationInboxLiveEvents(failingTransport, { shell: "ecommerce" });
    failingTransport.deliver("notification-inbox", "changed", {
      id: "note-03",
      title: "New",
      read: false,
    });
    assert.deepEqual(freshNotes, ["note-03"]);
    await markNotificationRead("note-01");
    stopNotificationInboxLiveEvents();
    await startNotificationInboxLiveEvents(failingTransport, { shell: "ecommerce" });
    unsubscribeNew();
    stopNotificationInboxLiveEvents();
  } finally {
    stopNotificationInboxLiveEvents();
    console.warn = originalWarn;
    if (previousWindow) {
      globalThis.window = previousWindow;
    } else {
      delete globalThis.window;
    }
  }
});
