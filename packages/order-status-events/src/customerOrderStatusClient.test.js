/**
 * Verifies the customer order-status stream and cancellation request.
 * Role: Locks that a pushed status reaches the subscriber and that cancellation records the customer actor.
 * Not in this file: Admin status writes.
 * Key dependencies: node:test; src/customerOrderStatusClient.js; test/support/createRecordingTransport.js.
 * See also: src/customerOrderStatusClient.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import {
  requestOrderCancellation,
  startCustomerOrderStatusStream,
  stopCustomerOrderStatusStream,
  subscribeToOrderStatusChanged,
} from "./customerOrderStatusClient.js";

test("a customer hears one status change and cancellation records the customer actor", async () => {
  const transport = createRecordingTransport({ requestReply: { ok: true } });
  const received = [];
  const unsubscribe = subscribeToOrderStatusChanged((statusEvent) => {
    received.push(statusEvent);
  });

  try {
    startCustomerOrderStatusStream(transport);
    const shipped = { orderId: "order-01", status: "shipped" };
    transport.deliver("orders", "status-changed", shipped);
    assert.deepEqual(received, [shipped]);

    const cancellation = await requestOrderCancellation(transport, { orderId: "order-01" });
    assert.deepEqual(cancellation, { ok: true });
    assert.deepEqual(transport.published.at(-1), {
      topic: "orders",
      event: "status-change",
      payload: {
        orderId: "order-01",
        status: "cancellation-requested",
        actor: "customer",
      },
    });
  } finally {
    unsubscribe();
    stopCustomerOrderStatusStream();
  }
});
