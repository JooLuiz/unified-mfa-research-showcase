/**
 * Verifies per-product stock delivery on an injected transport.
 * Role: Locks that watchProduct delivers one product's availability and nothing after unwatch.
 * Not in this file: EventSource, HTTP paths, or reservation commands.
 * Key dependencies: node:test; src/createStockWatchEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createStockWatchEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createStockWatchEvents,
  STOCK_CHANGED_EVENT,
  STOCK_TOPIC,
} from "./createStockWatchEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("watchProduct delivers that product's availability until unwatch", () => {
  const transport = createRecordingTransport();
  const stockWatchEvents = createStockWatchEvents(transport);
  const received = [];
  const unwatch = stockWatchEvents.watchProduct("p-01", (available) => {
    received.push(available);
  });

  transport.publish({
    topic: STOCK_TOPIC,
    event: STOCK_CHANGED_EVENT,
    payload: null,
  });
  transport.publish({
    topic: STOCK_TOPIC,
    event: STOCK_CHANGED_EVENT,
    payload: { available: 1 },
  });
  transport.publish({
    topic: STOCK_TOPIC,
    event: STOCK_CHANGED_EVENT,
    payload: { productId: "p-01", available: 4 },
  });
  transport.publish({
    topic: STOCK_TOPIC,
    event: STOCK_CHANGED_EVENT,
    payload: { productId: "p-02", available: 9 },
  });
  unwatch();
  transport.publish({
    topic: STOCK_TOPIC,
    event: STOCK_CHANGED_EVENT,
    payload: { productId: "p-01", available: 3 },
  });

  assert.deepEqual(received, [4]);
});

test("subscribeToStockChanged delivers every update until unsubscribe", () => {
  const transport = createRecordingTransport();
  const stockWatchEvents = createStockWatchEvents(transport);
  const received = [];
  const unsubscribe = stockWatchEvents.subscribeToStockChanged((stockUpdate) => {
    received.push(stockUpdate);
  });
  const firstUpdate = { productId: "p-01", available: 4 };
  const secondUpdate = { productId: "p-02", available: 1 };

  transport.publish({
    topic: STOCK_TOPIC,
    event: STOCK_CHANGED_EVENT,
    payload: firstUpdate,
  });
  transport.publish({
    topic: STOCK_TOPIC,
    event: STOCK_CHANGED_EVENT,
    payload: secondUpdate,
  });
  unsubscribe();
  transport.publish({
    topic: STOCK_TOPIC,
    event: STOCK_CHANGED_EVENT,
    payload: { productId: "p-01", available: 0 },
  });

  assert.deepEqual(received, [firstUpdate, secondUpdate]);
});
