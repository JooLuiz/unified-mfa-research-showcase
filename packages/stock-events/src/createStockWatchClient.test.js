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
