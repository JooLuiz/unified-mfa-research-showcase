/**
 * Verifies checkout order placement returns the transport outcome.
 * Role: Locks an accepted order and an out-of-stock rejection.
 * Not in this file: Clearing the local cart after a successful order.
 * Key dependencies: node:test; src/commands/placeOrder.js; test/support/createRecordingTransport.js.
 * See also: src/commands/placeOrder.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { placeOrder } = await loadAppModule(new URL("./placeOrder.js", import.meta.url).href);

const orderPayload = {
  items: [{ productId: "p-01", quantity: 1 }],
};

test("placeOrder returns the created order and records the place request", async () => {
  const accepted = { ok: true, order: { id: "order-01" } };
  const transport = createRecordingTransport({ requestReply: accepted });

  const result = await placeOrder(transport, orderPayload);

  assert.deepEqual(result, accepted);
  assert.deepEqual(transport.published, [
    { topic: "orders", event: "place", payload: orderPayload },
  ]);
});

test("placeOrder returns an out-of-stock rejection", async () => {
  const transport = createRecordingTransport({
    requestReply: { ok: false, code: "out-of-stock" },
  });

  const result = await placeOrder(transport, orderPayload);

  assert.deepEqual(result, { ok: false, code: "out-of-stock" });
});
