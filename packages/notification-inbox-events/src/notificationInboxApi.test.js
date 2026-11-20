/**
 * Verifies the shared inbox read.
 * Role: Locks the skipped call, the failed call, and both shapes of a successful body.
 * Not in this file: Mark-read writes.
 * Key dependencies: node:test; src/notificationInboxApi.js; test/support/createRecordingTransport.js.
 * See also: src/notificationInboxApi.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import { fetchNotificationInbox } from "./notificationInboxApi.js";

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
