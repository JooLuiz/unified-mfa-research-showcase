/**
 * Verifies an order status write returns the transport outcome.
 * Role: Locks the accepted order, a rejected code, and a scripted network failure.
 * Not in this file: The live status subscription.
 * Key dependencies: node:test; src/requestOrderStatusChange.js; test/support/createRecordingTransport.js.
 * See also: src/requestOrderStatusChange.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import { requestOrderStatusChange } from "./requestOrderStatusChange.js";

const statusChange = {
  orderId: "order-01",
  status: "shipped",
  actor: "admin",
};

/**
 * Sends one status change and locks the recorded request.
 *
 * @param {object} requestReply - Outcome the transport resolves.
 * @returns {Promise<object>} Command result.
 * @sideEffects Asserts the recorded orders/status-change message.
 */
async function runStatusChange(requestReply) {
  const transport = createRecordingTransport({ requestReply });
  const result = await requestOrderStatusChange(transport, statusChange);
  assert.deepEqual(transport.published, [
    {
      topic: "orders",
      event: "status-change",
      payload: statusChange,
    },
  ]);
  return result;
}

test("requestOrderStatusChange returns the updated order from the transport", async () => {
  const accepted = { ok: true, order: { id: "order-01", status: "shipped" } };
  const result = await runStatusChange(accepted);
  assert.deepEqual(result, accepted);
});

test("requestOrderStatusChange returns a not-allowed rejection", async () => {
  const result = await runStatusChange({ ok: false, code: "not-allowed" });
  assert.deepEqual(result, { ok: false, code: "not-allowed" });
});

test("requestOrderStatusChange returns a scripted network failure", async () => {
  const result = await runStatusChange({ ok: false, code: "network-error" });
  assert.deepEqual(result, { ok: false, code: "network-error" });
});
