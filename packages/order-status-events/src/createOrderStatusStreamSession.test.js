/**
 * Verifies the order-status stream delivers orders.status-changed until unsubscribe.
 * Role: Locks the SSE event name and listener fan-out of createOrderStatusStreamSession.
 * Not in this file: The status write command.
 * Key dependencies: node:test; src/createOrderStatusStreamSession.js; test/support/installBrowserTestDoubles.js.
 * See also: src/createOrderStatusStreamSession.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createOrderStatusStreamSession } from "./createOrderStatusStreamSession.js";
import {
  FakeEventSource,
  installBrowserTestDoubles,
} from "../../../test/support/installBrowserTestDoubles.js";

test("subscribe delivers orders.status-changed until unsubscribe, then stop closes the stream", async () => {
  installBrowserTestDoubles();
  const session = createOrderStatusStreamSession({
    ticketPath: "/orders/connection-tickets",
    streamPath: "/orders/stream",
    logName: "customer-order-status",
  });
  const received = [];
  const unsubscribe = session.subscribe((statusEvent) => {
    received.push(statusEvent);
  });

  await session.start({ apiBaseUrl: "http://localhost:4000/api", authToken: "token-01" });
  const eventSource = FakeEventSource.latestMatching("/orders/stream?ticket=");
  eventSource.emit("orders.status-changed", { orderId: "order-01", status: "shipped" });
  unsubscribe();
  eventSource.emit("orders.status-changed", { orderId: "order-01", status: "delivered" });
  session.stop();

  assert.equal(eventSource.url.includes("ticket-01"), true);
  assert.deepEqual(received, [{ orderId: "order-01", status: "shipped" }]);
  assert.equal(eventSource.closed, true);
});
