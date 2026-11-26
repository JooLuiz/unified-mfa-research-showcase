/**
 * Verifies the cart save use case.
 * Role: Calls saveCart with an in-memory store and recording broadcasters, and checks the
 *   returned outcome, the stored files, and the broadcasts.
 * Not in this file: How a caller receives the outcome.
 * Key dependencies: node:test; src/domain/saveCart.js; test/invokeRouter.js; test/recordCalls.js.
 * See also: src/domain/cartProcessing.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { saveCart } = require("./saveCart");
const { CART_REQUEST_INVALID_CODE } = require("./cartProcessing");
const { createMemoryJsonStore } = require("../../test/invokeRouter");
const { recordCalls } = require("../../test/recordCalls");

function createStreams() {
  return {
    cart: recordCalls(["broadcastCartChanged"]),
    stock: recordCalls(["broadcastStockChanged"]),
  };
}

function createStore() {
  return createMemoryJsonStore({
    "products.json": [{ id: "p-01", stock: 5 }],
    "carts.json": [],
    "guestHolds.json": { "guest-01": [{ productId: "p-01", quantity: 1 }] },
  });
}

const validItems = [{ productId: "p-01", quantity: 1 }];

test("saveCart rejects a missing payload and broadcasts nothing", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await saveCart({ jsonStore: store, userId: "u-01", payload: undefined, streams });

  assert.deepEqual(outcome, { ok: false, code: CART_REQUEST_INVALID_CODE });
  assert.deepEqual(store.files["carts.json"], []);
  assert.deepEqual(streams.cart.calls, []);
});

test("saveCart stores the cart and broadcasts it without a requestId when none is sent", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await saveCart({
    jsonStore: store,
    userId: "u-01",
    payload: { items: validItems, appliedCoupon: null },
    streams,
  });

  assert.equal(outcome.ok, true);
  assert.deepEqual(store.files["carts.json"], [outcome.result]);
  assert.deepEqual(streams.cart.calls, [["broadcastCartChanged", "u-01", outcome.result]]);
  assert.deepEqual(store.files["guestHolds.json"], { "guest-01": [{ productId: "p-01", quantity: 1 }] });
  assert.deepEqual(streams.stock.calls, []);
});

test("saveCart echoes a string requestId in the broadcast", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await saveCart({
    jsonStore: store,
    userId: "u-01",
    payload: { items: validItems, requestId: "req-7" },
    streams,
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.requestId, undefined);
  const [[, , broadcastCart]] = streams.cart.calls;
  assert.equal(broadcastCart.requestId, "req-7");
});

test("saveCart releases the named guest hold and broadcasts the freed stock", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await saveCart({
    jsonStore: store,
    userId: "u-01",
    payload: { items: validItems, guestStockSessionIdToRelease: "  guest-01  " },
    streams,
  });

  assert.equal(outcome.ok, true);
  assert.deepEqual(store.files["guestHolds.json"], {});
  // Stock 5, minus the user's saved cart line of 1, with the guest hold of 1 gone.
  assert.deepEqual(streams.stock.calls, [["broadcastStockChanged", "p-01", 4]]);
});

test("saveCart ignores a blank guest session id", async () => {
  const store = createStore();
  const streams = createStreams();

  await saveCart({
    jsonStore: store,
    userId: "u-01",
    payload: { items: validItems, guestStockSessionIdToRelease: "   " },
    streams,
  });

  assert.deepEqual(store.files["guestHolds.json"], { "guest-01": [{ productId: "p-01", quantity: 1 }] });
  assert.deepEqual(streams.stock.calls, []);
});

test("saveCart still succeeds when the guest hold release fails", async () => {
  const store = createStore();
  const streams = createStreams();
  const failingStore = {
    ...store,
    async writeJsonFile(fileName, data) {
      if (fileName === "guestHolds.json") {
        throw new Error("Cannot write guestHolds.json");
      }
      return store.writeJsonFile(fileName, data);
    },
  };

  const outcome = await saveCart({
    jsonStore: failingStore,
    userId: "u-01",
    payload: { items: validItems, guestStockSessionIdToRelease: "guest-01" },
    streams,
  });

  assert.equal(outcome.ok, true);
  assert.deepEqual(streams.stock.calls, []);
});
