/**
 * Verifies the notification read use cases.
 * Role: Calls markNotificationReadForUser and markAllNotificationsReadForUser with an in-memory
 *   store and a recording broadcaster, and checks the returned outcome, the stored inbox, and
 *   the broadcasts.
 * Not in this file: Row update rules (src/domain/notificationInbox.test.js) or how a caller
 *   receives the outcome.
 * Key dependencies: node:test; src/domain/markNotificationRead.js; test/invokeRouter.js; test/recordCalls.js.
 * See also: src/domain/notificationInbox.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} = require("./markNotificationRead");
const { NOTIFICATION_FORBIDDEN_CODE, NOTIFICATION_NOT_FOUND_CODE } = require("./notificationInbox");
const { INVALID_REQUEST_CODE } = require("./useCaseCodes");
const { createMemoryJsonStore } = require("../../test/invokeRouter");
const { recordCalls } = require("../../test/recordCalls");

const inboxRows = [
  { id: "n-1", userId: "u-01", shell: "ecommerce", read: false, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "n-2", userId: "u-01", shell: "ecommerce", read: true, createdAt: "2026-01-02T00:00:00.000Z" },
  { id: "n-3", userId: "u-01", shell: "social", read: false, createdAt: "2026-01-03T00:00:00.000Z" },
  { id: "n-4", userId: "u-02", shell: "ecommerce", read: false, createdAt: "2026-01-04T00:00:00.000Z" },
];

function createStreams() {
  return { notificationInbox: recordCalls(["broadcastNotificationChanged"]) };
}

function createStore() {
  return createMemoryJsonStore({ "notificationInbox.json": inboxRows });
}

const rejectedReadCases = [
  ["a missing payload", null, INVALID_REQUEST_CODE],
  ["a blank id", { notificationId: "  " }, INVALID_REQUEST_CODE],
  ["an unknown id", { notificationId: "n-9" }, NOTIFICATION_NOT_FOUND_CODE],
  ["another user's row", { notificationId: "n-4" }, NOTIFICATION_FORBIDDEN_CODE],
];

rejectedReadCases.forEach(([caseName, payload, expectedCode]) => {
  test(`markNotificationReadForUser rejects ${caseName} and leaves the inbox unchanged`, async () => {
    const store = createStore();
    const streams = createStreams();

    const outcome = await markNotificationReadForUser({ jsonStore: store, userId: "u-01", payload, streams });

    assert.deepEqual(outcome, { ok: false, code: expectedCode });
    assert.deepEqual(store.files["notificationInbox.json"], inboxRows);
    assert.deepEqual(streams.notificationInbox.calls, []);
  });
});

test("markNotificationReadForUser marks the row read and broadcasts it", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await markNotificationReadForUser({
    jsonStore: store,
    userId: "u-01",
    payload: { notificationId: "n-3" },
    streams,
  });

  const expectedRow = { ...inboxRows[2], read: true };
  assert.deepEqual(outcome, { ok: true, result: expectedRow });
  assert.deepEqual(store.files["notificationInbox.json"][2], expectedRow);
  assert.deepEqual(streams.notificationInbox.calls, [
    ["broadcastNotificationChanged", "u-01", "social", expectedRow],
  ]);
});

test("markAllNotificationsReadForUser rejects an unknown shell", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await markAllNotificationsReadForUser({
    jsonStore: store,
    userId: "u-01",
    payload: { shell: "billing" },
    streams,
  });

  assert.deepEqual(outcome, { ok: false, code: INVALID_REQUEST_CODE });
  assert.deepEqual(store.files["notificationInbox.json"], inboxRows);
});

test("markAllNotificationsReadForUser rejects a missing payload", async () => {
  const outcome = await markAllNotificationsReadForUser({
    jsonStore: createStore(),
    userId: "u-01",
    payload: undefined,
    streams: createStreams(),
  });

  assert.deepEqual(outcome, { ok: false, code: INVALID_REQUEST_CODE });
});

test("markAllNotificationsReadForUser marks only the caller's unread rows in that shell", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await markAllNotificationsReadForUser({
    jsonStore: store,
    userId: "u-01",
    payload: { shell: "ecommerce" },
    streams,
  });

  assert.equal(outcome.ok, true);
  assert.deepEqual(outcome.result.map((row) => [row.id, row.read]), [["n-2", true], ["n-1", true]]);
  assert.deepEqual(
    store.files["notificationInbox.json"].map((row) => row.read),
    [true, true, false, false],
  );
  assert.deepEqual(streams.notificationInbox.calls, [
    ["broadcastNotificationChanged", "u-01", "ecommerce", { ...inboxRows[0], read: true }],
  ]);
});
