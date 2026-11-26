/**
 * Verifies the order placement use case.
 * Role: Calls placeOrder with an in-memory store and recording broadcasters, and checks the
 *   returned outcome, the stored files, and the broadcasts.
 * Not in this file: How a caller receives the outcome.
 * Key dependencies: node:test; src/domain/placeOrder.js; test/invokeRouter.js; test/recordCalls.js.
 * See also: src/domain/orderProcessing.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { placeOrder } = require("./placeOrder");
const { ORDER_REQUEST_INVALID_CODE } = require("./orderProcessing");
const { USER_NOT_FOUND_CODE } = require("./useCaseCodes");
const { createMemoryJsonStore } = require("../../test/invokeRouter");
const { recordCalls } = require("../../test/recordCalls");

const shopper = { id: "u-01", username: "ada", fullName: "Ada", password: "secret", role: "customer" };
const admin = { id: "u-admin", username: "root", role: "admin" };

function createStreams({ withInbox = true } = {}) {
  return {
    admin: recordCalls(["broadcastEvent"]),
    cart: recordCalls(["broadcastCartChanged"]),
    stock: recordCalls(["broadcastStockChanged"]),
    ...(withInbox ? { notificationInbox: recordCalls(["broadcastNotificationChanged"]) } : {}),
  };
}

function createStore() {
  return createMemoryJsonStore({
    "users.json": [shopper, admin],
    "products.json": [{ id: "p-01", stock: 5 }],
    "carts.json": [{ userId: "u-01", items: [{ productId: "p-01", quantity: 2 }] }],
  });
}

const orderPayload = {
  items: [{ productId: "p-01", quantity: 2 }],
  subtotal: 20,
  totalAmount: 20,
};

test("placeOrder rejects an unknown user and stores nothing", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await placeOrder({ jsonStore: store, userId: "missing", payload: orderPayload, streams });

  assert.deepEqual(outcome, { ok: false, code: USER_NOT_FOUND_CODE });
  assert.equal(store.files["orders.json"], undefined);
  assert.deepEqual(streams.admin.calls, []);
});

test("placeOrder rejects a missing payload as an empty order", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await placeOrder({ jsonStore: store, userId: "u-01", payload: null, streams });

  assert.deepEqual(outcome, { ok: false, code: ORDER_REQUEST_INVALID_CODE });
  assert.equal(store.files["orders.json"], undefined);
  assert.deepEqual(streams.cart.calls, []);
  assert.deepEqual(streams.stock.calls, []);
});

test("placeOrder stores the order, clears the cart, and notifies every watcher", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await placeOrder({ jsonStore: store, userId: "u-01", payload: orderPayload, streams });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.userId, "u-01");
  assert.deepEqual(store.files["orders.json"], [outcome.result]);
  assert.deepEqual(store.files["carts.json"], []);
  assert.equal(store.files["products.json"][0].stock, 3);

  const [[eventName, adminEventType, adminPayload]] = streams.admin.calls;
  assert.equal(eventName, "broadcastEvent");
  assert.equal(adminEventType, "order_created");
  assert.equal(adminPayload.id, outcome.result.id);
  assert.equal(adminPayload.customer.id, "u-01");
  assert.equal(adminPayload.customer.password, undefined);

  const [[, cartUserId, clearedCart]] = streams.cart.calls;
  assert.equal(cartUserId, "u-01");
  assert.deepEqual(clearedCart.items, []);
  assert.equal(clearedCart.appliedCoupon, null);

  assert.deepEqual(streams.stock.calls, [["broadcastStockChanged", "p-01", 3]]);

  const inboxRows = store.files["notificationInbox.json"];
  assert.deepEqual(
    inboxRows.map((row) => [row.userId, row.shell]),
    [["u-01", "ecommerce"], ["u-admin", "admin"]],
  );
  assert.equal(streams.notificationInbox.calls.length, 2);
});

test("placeOrder skips inbox rows when no inbox broadcaster is given", async () => {
  const store = createStore();
  const streams = createStreams({ withInbox: false });

  const outcome = await placeOrder({ jsonStore: store, userId: "u-01", payload: orderPayload, streams });

  assert.equal(outcome.ok, true);
  assert.equal(store.files["notificationInbox.json"], undefined);
  assert.equal(streams.admin.calls.length, 1);
});
