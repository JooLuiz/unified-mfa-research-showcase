/**
 * Verifies how the inbox client recovers when a read command or inbox load fails.
 * Role: Locks the rows shoppers see after failed mark-read, mark-all-read, refetch, and start calls.
 * Not in this file: The happy-path listener flow (src/notificationInboxClient.test.js).
 * Key dependencies: node:test; src/notificationInboxClient.js; test/support/createRecordingTransport.js.
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

// The client marks rows read in place, so every use builds a fresh row.
function welcomeRow() {
  return { id: "note-01", title: "Welcome", read: false };
}

function shippedRow() {
  return { id: "note-02", title: "Shipped", read: false };
}

/**
 * Silences warnings and installs a window whose timers are captured, then restores both.
 *
 * @param {import("node:test").TestContext} testContext - Registers the restore step.
 * @returns {{ timers: Function[] }} Callbacks passed to window.setTimeout.
 * @sideEffects Replaces console.warn and global window until the test ends.
 */
function installInboxTestGlobals(testContext) {
  const captured = { timers: [] };
  const previousWindow = globalThis.window;
  const originalWarn = console.warn;
  console.warn = () => {};
  globalThis.window = {
    setTimeout(callback) {
      captured.timers.push(callback);
      return captured.timers.length;
    },
    clearTimeout() {},
  };
  stopNotificationInboxLiveEvents();
  testContext.after(() => {
    stopNotificationInboxLiveEvents();
    console.warn = originalWarn;
    if (previousWindow) {
      globalThis.window = previousWindow;
    } else {
      delete globalThis.window;
    }
  });
  return captured;
}

function waitForPendingWork() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test("a failed mark-read reloads the inbox from the server", async (testContext) => {
  installInboxTestGlobals(testContext);
  const serverRows = [{ ...welcomeRow(), read: false, title: "Welcome back" }];
  const transport = createRecordingTransport({
    requestReplies: [{ ok: true, items: [welcomeRow()] }, { ok: false }, { ok: true, items: serverRows }],
  });
  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });
  const snapshots = [];
  const unsubscribe = subscribeToNotificationInbox((rows) => snapshots.push(rows));

  await markNotificationRead("note-01");
  unsubscribe();

  assert.deepEqual(getNotificationInboxState(), serverRows);
  assert.deepEqual(snapshots.at(-1), serverRows);
});

test("mark-all-read with nothing unread leaves the rows and listeners alone", async (testContext) => {
  installInboxTestGlobals(testContext);
  const readRows = [{ ...welcomeRow(), read: true }];
  const transport = createRecordingTransport({
    requestReplies: [{ ok: true, items: readRows }, { ok: true, items: [shippedRow()] }],
  });
  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });
  const snapshots = [];
  const unsubscribe = subscribeToNotificationInbox((rows) => snapshots.push(rows));

  await markAllNotificationsRead();
  unsubscribe();

  assert.deepEqual(getNotificationInboxState(), readRows);
  assert.equal(snapshots.length, 1);
});

test("mark-all-read shows every row read, then the server rows", async (testContext) => {
  installInboxTestGlobals(testContext);
  const serverRows = [{ ...shippedRow(), read: true }, { ...welcomeRow(), read: true }];
  const transport = createRecordingTransport({
    requestReplies: [{ ok: true, items: [welcomeRow(), { ...shippedRow(), read: true }] }, { ok: true, items: serverRows }],
  });
  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });
  const snapshots = [];
  const unsubscribe = subscribeToNotificationInbox((rows) => snapshots.push(rows));

  await markAllNotificationsRead();
  unsubscribe();

  assert.deepEqual(snapshots[1], [{ ...welcomeRow(), read: true }, { ...shippedRow(), read: true }]);
  assert.deepEqual(getNotificationInboxState(), serverRows);
});

test("a failed mark-all-read reloads the inbox from the server", async (testContext) => {
  installInboxTestGlobals(testContext);
  const serverRows = [{ ...welcomeRow(), read: true }];
  const transport = createRecordingTransport({
    requestReplies: [{ ok: true, items: [welcomeRow()] }, { ok: false }, { ok: true, items: serverRows }],
  });
  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });

  await markAllNotificationsRead();

  assert.deepEqual(getNotificationInboxState(), serverRows);
});

test("a failed reload keeps the rows already shown", async (testContext) => {
  installInboxTestGlobals(testContext);
  const transport = createRecordingTransport({
    requestReplies: [{ ok: true, items: [welcomeRow()] }, { ok: false }, { ok: false }],
  });
  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });

  await assert.doesNotReject(() => markAllNotificationsRead());

  assert.deepEqual(getNotificationInboxState(), [{ ...welcomeRow(), read: true }]);
});

test("a throwing new-row listener does not block the next one", async (testContext) => {
  installInboxTestGlobals(testContext);
  const transport = createRecordingTransport({ requestReplies: [{ ok: true, items: [welcomeRow()] }] });
  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });
  const freshIds = [];
  const unsubscribeFailing = subscribeToNewInboxNotifications(() => {
    throw new Error("listener failed");
  });
  const unsubscribeWorking = subscribeToNewInboxNotifications((row) => freshIds.push(row.id));

  transport.deliver("notification-inbox", "changed", shippedRow());
  unsubscribeFailing();
  unsubscribeWorking();

  assert.deepEqual(freshIds, ["note-02"]);
  assert.deepEqual(getNotificationInboxState().map((row) => row.id), ["note-02", "note-01"]);
});

test("a failed start loads the inbox when the retry runs", async (testContext) => {
  const captured = installInboxTestGlobals(testContext);
  const transport = createRecordingTransport({
    requestReplies: [{ ok: false }, { ok: true, items: [welcomeRow()] }],
  });

  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });
  assert.deepEqual(getNotificationInboxState(), []);
  assert.equal(captured.timers.length, 1);

  captured.timers[0]();
  await waitForPendingWork();

  assert.deepEqual(getNotificationInboxState(), [welcomeRow()]);
});

test("a retry after stop does not load the inbox", async (testContext) => {
  const captured = installInboxTestGlobals(testContext);
  const transport = createRecordingTransport({
    requestReplies: [{ ok: false }, { ok: true, items: [welcomeRow()] }],
  });

  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });
  stopNotificationInboxLiveEvents();
  captured.timers[0]();
  await waitForPendingWork();

  assert.deepEqual(getNotificationInboxState(), []);
});

test("read commands after stop leave the inbox empty", async (testContext) => {
  installInboxTestGlobals(testContext);
  const transport = createRecordingTransport({
    requestReplies: [{ ok: true, items: [welcomeRow()] }, { ok: false }, { ok: true, items: [shippedRow()] }],
  });
  await startNotificationInboxLiveEvents(transport, { shell: "ecommerce" });
  stopNotificationInboxLiveEvents();

  await markAllNotificationsRead();
  await markNotificationRead("note-01");

  assert.deepEqual(getNotificationInboxState(), []);
});
