/**
 * Verifies the order status change use case.
 * Role: Calls changeOrderStatus with an in-memory store and recording broadcasters, and checks
 *   the returned outcome, the stored files, and the broadcasts.
 * Not in this file: Transition table details (src/domain/orderStatus.test.js) or how a caller
 *   receives the outcome.
 * Key dependencies: node:test; src/domain/changeOrderStatus.js; test/invokeRouter.js; test/recordCalls.js.
 * See also: src/domain/orderStatus.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { changeOrderStatus } = require("./changeOrderStatus");
const { ORDER_STATUS_INVALID_TRANSITION_CODE } = require("./orderStatus");
const {
  ADMIN_REQUIRED_CODE,
  INVALID_ACTOR_CODE,
  ORDER_NOT_FOUND_CODE,
  USER_NOT_FOUND_CODE,
} = require("./useCaseCodes");
const { createMemoryJsonStore } = require("../../test/invokeRouter");
const { recordCalls } = require("../../test/recordCalls");

const shopper = { id: "u-01", username: "ada", role: "customer" };
const otherShopper = { id: "u-02", username: "bob", role: "customer" };
const admin = { id: "u-admin", username: "root", role: "admin" };
const placedOrder = {
  id: "order-1",
  userId: "u-01",
  items: [{ productId: "p-01", quantity: 2 }],
  status: "placed",
};

function createStreams({ withInbox = true } = {}) {
  return {
    orders: recordCalls(["broadcastStatusChanged"]),
    stock: recordCalls(["broadcastStockChanged"]),
    ...(withInbox ? { notificationInbox: recordCalls(["broadcastNotificationChanged"]) } : {}),
  };
}

function createStore() {
  return createMemoryJsonStore({
    "users.json": [shopper, otherShopper, admin],
    "orders.json": [placedOrder],
    "products.json": [{ id: "p-01", stock: 3 }],
  });
}

async function runChange(userId, payload, streams = createStreams()) {
  const store = createStore();
  const outcome = await changeOrderStatus({ jsonStore: store, userId, payload, streams });
  return { outcome, store, streams };
}

const rejectedCases = [
  ["an unknown user", "missing", { orderId: "order-1", status: "shipped", actor: "admin" }, USER_NOT_FOUND_CODE],
  ["a missing payload", "u-01", null, INVALID_ACTOR_CODE],
  ["an unknown actor", "u-01", { orderId: "order-1", status: "shipped", actor: "guest" }, INVALID_ACTOR_CODE],
  ["an unknown order", "u-admin", { orderId: "order-9", status: "shipped", actor: "admin" }, ORDER_NOT_FOUND_CODE],
  ["a customer claiming admin", "u-01", { orderId: "order-1", status: "shipped", actor: "admin" }, ADMIN_REQUIRED_CODE],
  ["a customer on another user's order", "u-02", { orderId: "order-1", status: "cancellation-requested", actor: "customer" }, ORDER_NOT_FOUND_CODE],
  ["an illegal transition", "u-admin", { orderId: "order-1", status: "delivered", actor: "admin" }, ORDER_STATUS_INVALID_TRANSITION_CODE],
];

rejectedCases.forEach(([caseName, userId, payload, expectedCode]) => {
  test(`changeOrderStatus rejects ${caseName} and leaves the order unchanged`, async () => {
    const { outcome, store, streams } = await runChange(userId, payload);

    assert.deepEqual(outcome, { ok: false, code: expectedCode });
    assert.deepEqual(store.files["orders.json"], [placedOrder]);
    assert.deepEqual(streams.orders.calls, []);
  });
});

test("changeOrderStatus lets an admin cancel, restores stock, and notifies the customer", async () => {
  const { outcome, store, streams } = await runChange("u-admin", {
    orderId: "order-1",
    status: "cancelled",
    actor: "admin",
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.result.status, "cancelled");
  assert.deepEqual(store.files["orders.json"], [{ ...placedOrder, status: "cancelled" }]);
  assert.equal(store.files["products.json"][0].stock, 5);
  assert.deepEqual(streams.orders.calls, [["broadcastStatusChanged", "u-01", "order-1", "cancelled"]]);
  assert.deepEqual(streams.stock.calls, [["broadcastStockChanged", "p-01", 5]]);
  assert.deepEqual(
    store.files["notificationInbox.json"].map((row) => [row.userId, row.shell]),
    [["u-01", "ecommerce"]],
  );
  assert.equal(streams.notificationInbox.calls.length, 1);
});

test("changeOrderStatus lets the owner request cancellation without an inbox broadcaster", async () => {
  const { outcome, store, streams } = await runChange(
    "u-01",
    { orderId: "order-1", status: "cancellation-requested", actor: "customer" },
    createStreams({ withInbox: false }),
  );

  assert.equal(outcome.ok, true);
  assert.equal(store.files["orders.json"][0].status, "cancellation-requested");
  assert.equal(store.files["notificationInbox.json"], undefined);
  assert.deepEqual(streams.stock.calls, []);
  assert.deepEqual(streams.orders.calls, [
    ["broadcastStatusChanged", "u-01", "order-1", "cancellation-requested"],
  ]);
});
