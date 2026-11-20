/**
 * Verifies stock hold commands return the transport outcome.
 * Role: Locks accepted, rejected, request-failed, and network-error results for reserve and set.
 * Not in this file: Live availability delivery or the HTTP adapter that produces those outcomes.
 * Key dependencies: node:test; src/stockReservationCommands.js; src/stockEventsContracts.js; test/support/createRecordingTransport.js.
 * See also: src/stockReservationCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import { STOCK_INSUFFICIENT_CODE } from "./stockEventsContracts.js";
import { reserveStockQuantity, setStockQuantity } from "./stockReservationCommands.js";

/**
 * Runs one stock command and locks the request the transport recorded.
 *
 * @param {(transport: object, input: object) => Promise<object>} command - reserveStockQuantity or setStockQuantity.
 * @param {"reserve" | "set"} eventName - Stock command event.
 * @param {{ productId: string, quantity: number, sessionId?: string }} hold - Product, quantity, and optional guest session id.
 * @param {object} requestReply - Outcome the transport resolves.
 * @returns {Promise<object>} Command result.
 * @sideEffects Asserts the recorded stock request.
 */
async function runStockCommand(command, eventName, hold, requestReply) {
  const transport = createRecordingTransport({ requestReply });
  const result = await command(transport, hold);
  assert.deepEqual(transport.published, [
    {
      topic: "stock",
      event: eventName,
      payload: {
        productId: hold.productId,
        quantity: hold.quantity,
        sessionId: hold.sessionId || "",
      },
    },
  ]);
  return result;
}

test("reserveStockQuantity returns the accepted hold for a signed-in caller", async () => {
  const acceptedHold = { ok: true, quantity: 2, available: 8 };
  const result = await runStockCommand(
    reserveStockQuantity,
    "reserve",
    { productId: "p-01", quantity: 2 },
    acceptedHold,
  );

  assert.deepEqual(result, acceptedHold);
});

test("setStockQuantity returns the accepted hold for a guest session", async () => {
  const acceptedHold = { ok: true, quantity: 0, available: 11 };
  const result = await runStockCommand(
    setStockQuantity,
    "set",
    { productId: "p-01", quantity: 0, sessionId: "guest-01" },
    acceptedHold,
  );

  assert.deepEqual(result, acceptedHold);
});

test("reserveStockQuantity returns the server rejection code", async () => {
  const rejection = { ok: false, code: STOCK_INSUFFICIENT_CODE };
  const result = await runStockCommand(
    reserveStockQuantity,
    "reserve",
    { productId: "p-01", quantity: 9 },
    rejection,
  );

  assert.deepEqual(result, rejection);
});

test("reserveStockQuantity returns request-failed when the transport reports an unreadable result", async () => {
  const rejection = { ok: false, code: "request-failed" };
  const result = await runStockCommand(
    reserveStockQuantity,
    "reserve",
    { productId: "p-01", quantity: 1 },
    rejection,
  );

  assert.deepEqual(result, rejection);
});

test("reserveStockQuantity returns network-error when the transport cannot deliver the command", async () => {
  const rejection = { ok: false, code: "network-error" };
  const result = await runStockCommand(
    reserveStockQuantity,
    "reserve",
    { productId: "p-01", quantity: 1, sessionId: "" },
    rejection,
  );

  assert.deepEqual(result, rejection);
});
