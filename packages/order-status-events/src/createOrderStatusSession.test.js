/**
 * Verifies order status delivery on an injected transport.
 * Role: Locks that a subscriber receives one status update and nothing after unsubscribe.
 * Not in this file: The live connection or the status write.
 * Key dependencies: node:test; src/createOrderStatusEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createOrderStatusEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import {
  createOrderStatusEvents,
  ORDERS_STATUS_CHANGED_EVENT,
  ORDERS_TOPIC,
} from "./createOrderStatusEvents.js";
import { createOrderStatusStreamSession } from "./createOrderStatusSession.js";

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

test("createOrderStatusStreamSession delivers a status change until stop or unsubscribe", () => {
  const transport = createRecordingTransport();
  const session = createOrderStatusStreamSession();
  const received = [];
  const unsubscribe = session.subscribe((statusEvent) => {
    received.push(statusEvent);
  });
  const shipped = { orderId: "order-01", status: "shipped" };

  session.start(transport);
  transport.deliver("orders", "status-changed", shipped);
  unsubscribe();
  transport.deliver("orders", "status-changed", { orderId: "order-01", status: "delivered" });
  assert.deepEqual(received, [shipped]);

  const afterUnsubscribe = [];
  session.subscribe((statusEvent) => {
    afterUnsubscribe.push(statusEvent);
  });
  session.stop();
  transport.deliver("orders", "status-changed", { orderId: "order-01", status: "delivered" });
  assert.deepEqual(afterUnsubscribe, []);
});
