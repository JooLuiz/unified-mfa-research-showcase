/**
 * Verifies the stock reservation use cases.
 * Role: Calls reserveStock and setStockReservation with an in-memory store and a recording
 *   broadcaster, and checks the returned outcome, the stored holds, and the broadcasts.
 * Not in this file: Availability math (src/domain/stockRequests.test.js) or holder resolution.
 * Key dependencies: node:test; src/domain/reserveStock.js; test/invokeRouter.js; test/recordCalls.js.
 * See also: src/domain/stockRequests.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { reserveStock, setStockReservation } = require("./reserveStock");
const { STOCK_INSUFFICIENT_CODE, STOCK_REQUEST_INVALID_CODE } = require("./stock");
const { STOCK_HOLDER_MISSING_CODE } = require("./useCaseCodes");
const { createMemoryJsonStore } = require("../../test/invokeRouter");
const { recordCalls } = require("../../test/recordCalls");

const guestHolder = { type: "guest", sessionId: "guest-01" };

function createStreams() {
  return { stock: recordCalls(["broadcastStockChanged"]) };
}

function createStore() {
  return createMemoryJsonStore({
    "products.json": [{ id: "p-01", stock: 3 }],
    "carts.json": [],
    "guestHolds.json": {},
  });
}

test("reserveStock rejects a request with no holder", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await reserveStock({ jsonStore: store, holder: null, payload: { productId: "p-01", quantity: 1 }, streams });

  assert.deepEqual(outcome, { ok: false, code: STOCK_HOLDER_MISSING_CODE });
  assert.deepEqual(store.files["guestHolds.json"], {});
  assert.deepEqual(streams.stock.calls, []);
});

test("reserveStock rejects a missing payload as an invalid request", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await reserveStock({ jsonStore: store, holder: guestHolder, payload: undefined, streams });

  assert.deepEqual(outcome, { ok: false, code: STOCK_REQUEST_INVALID_CODE });
  assert.deepEqual(streams.stock.calls, []);
});

test("reserveStock adds to the hold and broadcasts the new availability", async () => {
  const store = createStore();
  const streams = createStreams();

  const first = await reserveStock({ jsonStore: store, holder: guestHolder, payload: { productId: "p-01", quantity: "1" }, streams });
  const second = await reserveStock({ jsonStore: store, holder: guestHolder, payload: { productId: "p-01", quantity: 1 }, streams });

  assert.deepEqual(first, { ok: true, result: { productId: "p-01", quantity: 1, available: 2 } });
  assert.deepEqual(second, { ok: true, result: { productId: "p-01", quantity: 2, available: 1 } });
  assert.deepEqual(store.files["guestHolds.json"], { "guest-01": [{ productId: "p-01", quantity: 2 }] });
  assert.deepEqual(streams.stock.calls, [
    ["broadcastStockChanged", "p-01", 2],
    ["broadcastStockChanged", "p-01", 1],
  ]);
});

test("reserveStock rejects more than is available", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await reserveStock({ jsonStore: store, holder: guestHolder, payload: { productId: "p-01", quantity: 4 }, streams });

  assert.deepEqual(outcome, { ok: false, code: STOCK_INSUFFICIENT_CODE });
  assert.deepEqual(streams.stock.calls, []);
});

test("setStockReservation replaces the hold and broadcasts the new availability", async () => {
  const store = createStore();
  const streams = createStreams();
  await reserveStock({ jsonStore: store, holder: guestHolder, payload: { productId: "p-01", quantity: 2 }, streams });

  const outcome = await setStockReservation({
    jsonStore: store,
    holder: guestHolder,
    payload: { productId: "p-01", quantity: 1 },
    streams,
  });

  assert.deepEqual(outcome, { ok: true, result: { productId: "p-01", quantity: 1, available: 2 } });
  assert.deepEqual(store.files["guestHolds.json"], { "guest-01": [{ productId: "p-01", quantity: 1 }] });
  assert.deepEqual(streams.stock.calls.at(-1), ["broadcastStockChanged", "p-01", 2]);
});

test("setStockReservation rejects a request with no holder", async () => {
  const streams = createStreams();

  const outcome = await setStockReservation({ jsonStore: createStore(), holder: null, payload: {}, streams });

  assert.deepEqual(outcome, { ok: false, code: STOCK_HOLDER_MISSING_CODE });
});
