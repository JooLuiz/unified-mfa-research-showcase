/**
 * Verifies the shared stock watch client fans availability out by product id.
 * Role: Locks watch and unwatch behavior of createStockWatchClient.
 * Not in this file: Reconnect backoff or the reservation HTTP command.
 * Key dependencies: node:test; src/createStockWatchClient.js; test/support/installBrowserTestDoubles.js.
 * See also: src/createStockWatchClient.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createStockWatchClient } from "./createStockWatchClient.js";
import {
  FakeEventSource,
  installBrowserTestDoubles,
} from "../../../test/support/installBrowserTestDoubles.js";

test("watchProduct delivers that product's availability until unwatch", () => {
  installBrowserTestDoubles();
  const apiBaseUrl = "http://stock-client.test/api";
  const client = createStockWatchClient({ apiBaseUrl });
  const received = [];
  const unwatch = client.watchProduct("p-01", (available) => {
    received.push(available);
  });
  const eventSource = FakeEventSource.latestMatching(apiBaseUrl);

  eventSource.emit("stock_changed", { productId: "p-01", available: 4 });
  eventSource.emit("stock_changed", { productId: "p-02", available: 9 });
  unwatch();
  eventSource.emit("stock_changed", { productId: "p-01", available: 3 });

  assert.deepEqual(received, [4]);
});
