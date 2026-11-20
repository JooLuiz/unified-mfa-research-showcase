/**
 * Verifies the admin order-status stream and status write.
 * Role: Locks that a pushed status reaches the admin subscriber and that the write records the admin actor.
 * Not in this file: Customer cancellation requests.
 * Key dependencies: node:test; src/adminOrderStatusClient.js; test/support/createRecordingTransport.js.
 * See also: src/adminOrderStatusClient.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import {
  requestAdminOrderStatusChange,
  startAdminOrderStatusStream,
  stopAdminOrderStatusStream,
  subscribeToAdminOrderStatusChanged,
} from "./adminOrderStatusClient.js";

test("an admin hears one status change and a ship request records the admin actor", async () => {
  const transport = createRecordingTransport({
    requestReply: { ok: true, order: { id: "order-01", status: "shipped" } },
  });
  const received = [];
  const unsubscribe = subscribeToAdminOrderStatusChanged((statusEvent) => {
    received.push(statusEvent);
  });

  try {
    startAdminOrderStatusStream(transport);
    const shipped = { orderId: "order-01", status: "shipped" };
    transport.deliver("orders", "status-changed", shipped);
    assert.deepEqual(received, [shipped]);

    const changeResult = await requestAdminOrderStatusChange(transport, {
      orderId: "order-01",
      status: "shipped",
    });
    assert.deepEqual(changeResult, { ok: true, order: { id: "order-01", status: "shipped" } });
    assert.deepEqual(transport.published.at(-1), {
      topic: "orders",
      event: "status-change",
      payload: { orderId: "order-01", status: "shipped", actor: "admin" },
    });
  } finally {
    unsubscribe();
    stopAdminOrderStatusStream();
  }
});
