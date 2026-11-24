/**
 * Verifies the shared inbox read and mark-read writes.
 * Role: Locks the skipped call, the failed call, and both shapes of a successful body for the read and both mark-read writes.
 * Not in this file: Inbox state or the live subscription (src/notificationInboxClient.js).
 * Key dependencies: node:test; src/notificationInboxApi.js; test/support/createRecordingTransport.js.
 * See also: src/notificationInboxApi.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import {
  fetchNotificationInbox,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notificationInboxApi.js";

test("fetchNotificationInbox returns no rows when the transport or shell is missing", async () => {
  const transport = createRecordingTransport();
  const skippedReads = [
    await fetchNotificationInbox(null, { shell: "ecommerce" }),
    await fetchNotificationInbox(transport, { shell: "" }),
    await fetchNotificationInbox(transport, {}),
  ];

  assert.deepEqual(skippedReads, [[], [], []]);
  assert.deepEqual(transport.published, []);
});

test("fetchNotificationInbox throws when the transport rejects the read", async () => {
  const transport = createRecordingTransport({ requestReply: { ok: false } });

  await assert.rejects(
    () => fetchNotificationInbox(transport, { shell: "ecommerce" }),
    /fetchNotificationInbox - request failed/,
  );
  assert.deepEqual(transport.published, [
    {
      topic: "notification-inbox",
      event: "fetch",
      payload: { shell: "ecommerce" },
    },
  ]);
});

test("fetchNotificationInbox returns the item list", async () => {
  const items = [{ id: "n-01", read: false }];
  const transport = createRecordingTransport({
    requestReply: { ok: true, items },
  });

  const rows = await fetchNotificationInbox(transport, { shell: "ecommerce" });

  assert.deepEqual(rows, items);
  assert.deepEqual(transport.published, [
    {
      topic: "notification-inbox",
      event: "fetch",
      payload: { shell: "ecommerce" },
    },
  ]);
});

test("fetchNotificationInbox returns no rows when the body has no item list", async () => {
  const transport = createRecordingTransport({
    requestReply: { ok: true, items: null },
  });

  const rows = await fetchNotificationInbox(transport, { shell: "social" });

  assert.deepEqual(rows, []);
  assert.deepEqual(transport.published, [
    {
      topic: "notification-inbox",
      event: "fetch",
      payload: { shell: "social" },
    },
  ]);
});

test("markNotificationAsRead returns the updated row", async () => {
  const notification = { id: "n-01", read: true };
  const transport = createRecordingTransport({ requestReply: { ok: true, notification } });

  const row = await markNotificationAsRead(transport, { notificationId: "n-01" });

  assert.deepEqual(row, notification);
});

test("markNotificationAsRead throws when the transport rejects the write", async () => {
  const transport = createRecordingTransport({ requestReply: { ok: false } });

  await assert.rejects(
    () => markNotificationAsRead(transport, { notificationId: "n-01" }),
    /markNotificationAsRead - request failed/,
  );
});

test("markAllNotificationsAsRead returns the item list", async () => {
  const items = [{ id: "n-01", read: true }];
  const transport = createRecordingTransport({ requestReply: { ok: true, items } });

  const rows = await markAllNotificationsAsRead(transport, { shell: "ecommerce" });

  assert.deepEqual(rows, items);
});

test("markAllNotificationsAsRead returns no rows when the body has no item list", async () => {
  const transport = createRecordingTransport({ requestReply: { ok: true, items: "none" } });

  const rows = await markAllNotificationsAsRead(transport, { shell: "admin" });

  assert.deepEqual(rows, []);
});

test("markAllNotificationsAsRead throws when the transport rejects the write", async () => {
  const transport = createRecordingTransport({ requestReply: { ok: false } });

  await assert.rejects(
    () => markAllNotificationsAsRead(transport, { shell: "ecommerce" }),
    /markAllNotificationsAsRead - request failed/,
  );
});
