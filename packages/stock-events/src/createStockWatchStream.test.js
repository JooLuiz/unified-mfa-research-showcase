/**
 * Verifies the stock SSE stream delivers stock_changed and stops after unsubscribe.
 * Role: Locks the event name and listener fan-out of createStockWatchStream.
 * Not in this file: The live HTTP connection or guest session persistence.
 * Key dependencies: node:test; src/createStockWatchStream.js; test/support/installBrowserTestDoubles.js.
 * See also: src/createStockWatchStream.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createStockWatchStream } from "./createStockWatchStream.js";
import {
  FakeEventSource,
  installBrowserTestDoubles,
} from "../../../test/support/installBrowserTestDoubles.js";

test("subscribeToStockChanged delivers stock_changed until unsubscribe", () => {
  installBrowserTestDoubles();
  const stream = createStockWatchStream({ apiBaseUrl: "http://localhost:4000/api" });
  const received = [];
  const unsubscribe = stream.subscribeToStockChanged((productId, available) => {
    received.push({ productId, available });
  });
  const eventSource = FakeEventSource.latestMatching("/stock/stream");

  eventSource.emit("stock_changed", { productId: "p-01", available: 4 });
  unsubscribe();
  eventSource.emit("stock_changed", { productId: "p-01", available: 3 });

  assert.equal(eventSource.url.includes("sessionId="), true);
  assert.deepEqual(received, [{ productId: "p-01", available: 4 }]);
});
