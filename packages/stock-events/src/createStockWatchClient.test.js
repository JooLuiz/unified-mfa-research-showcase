/**
 * Verifies per-product stock delivery on an injected transport.
 * Role: Locks that watchProduct delivers one product's availability and nothing after unwatch.
 * Not in this file: EventSource, HTTP paths, or reservation commands.
 * Key dependencies: node:test; src/createStockWatchEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createStockWatchEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import { createStockWatchClient } from "./createStockWatchClient.js";
import {
  createStockWatchEvents,
  STOCK_CHANGED_EVENT,
  STOCK_TOPIC,
} from "./createStockWatchEvents.js";

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

test("createStockWatchClient delivers one product and publishes the watched ids after the stream is ready", async (testContext) => {
  testContext.mock.timers.enable({ apis: ["setTimeout"] });
  const previousWindow = globalThis.window;
  globalThis.window = {
    setTimeout,
    clearTimeout() {},
  };
  const transport = createRecordingTransport();
  const received = [];
  const reconnects = [];
  const client = createStockWatchClient(transport);
  const unwatch = client.watchProduct("p-01", (available) => {
    received.push(available);
  });
  const unwatchSecond = client.watchProduct("p-01", () => {});
  const unsubscribeReconnect = client.subscribeToReconnect(() => {
    reconnects.push("reconnected");
  });

  try {
    testContext.mock.timers.tick(150);
    transport.deliver("stock", "changed", { productId: "p-01", available: 4 });
    transport.deliver("stock", "changed", { productId: "p-02", available: 9 });
    assert.deepEqual(received, [4]);

    unwatchSecond();
    transport.deliver("stock", "ready", { streamId: "stream-01" });
    transport.deliver("stock", "ready", { streamId: "stream-02" });
    testContext.mock.timers.tick(150);
    unsubscribeReconnect();

    unwatch();
    transport.deliver("stock", "changed", { productId: "p-01", available: 1 });
    testContext.mock.timers.tick(150);
    assert.deepEqual(reconnects, ["reconnected"]);

    assert.deepEqual(received, [4]);
    const watchingMessages = transport.published.filter((message) => message.event === "watching");
    assert.ok(watchingMessages.length >= 1);
    assert.deepEqual(watchingMessages[0], {
      topic: "stock",
      event: "watching",
      payload: { streamId: "stream-01", productIds: ["p-01"] },
      scope: "distributed",
    });
  } finally {
    unwatch();
    if (previousWindow) {
      globalThis.window = previousWindow;
    } else {
      delete globalThis.window;
    }
    testContext.mock.timers.reset();
  }
});
