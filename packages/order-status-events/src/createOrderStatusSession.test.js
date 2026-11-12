/**
 * Verifies order status delivery on an injected transport.
 * Role: Locks that a subscriber receives one status update and nothing after unsubscribe.
 * Not in this file: EventSource, HTTP paths, or the status write.
 * Key dependencies: node:test; src/createOrderStatusEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createOrderStatusEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createOrderStatusEvents,
  ORDERS_STATUS_CHANGED_EVENT,
  ORDERS_TOPIC,
} from "./createOrderStatusEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("subscribeToOrderStatusChanged delivers one status update until unsubscribe", () => {
  const transport = createRecordingTransport();
  const orderStatusEvents = createOrderStatusEvents(transport);
  const received = [];
  const unsubscribe = orderStatusEvents.subscribeToOrderStatusChanged((statusEvent) => {
    received.push(statusEvent);
  });
  const shipped = { orderId: "order-01", status: "shipped" };

  transport.publish({
    topic: ORDERS_TOPIC,
    event: ORDERS_STATUS_CHANGED_EVENT,
    payload: shipped,
  });
  unsubscribe();
  transport.publish({
    topic: ORDERS_TOPIC,
    event: ORDERS_STATUS_CHANGED_EVENT,
    payload: { orderId: "order-01", status: "delivered" },
  });

  assert.deepEqual(received, [shipped]);
});
