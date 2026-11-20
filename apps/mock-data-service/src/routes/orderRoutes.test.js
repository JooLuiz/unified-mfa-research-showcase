/**
 * Verifies the shopper order routes against an in-memory store.
 * Role: Asserts which orders a caller can read and that an empty place leaves orders.json.
 * Not in this file: Order status changes.
 * Key dependencies: node:test; src/routes/orderRoutes.js; test/invokeRouter.js.
 * See also: src/domain/orderProcessing.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createOrderRouter } = require("./orderRoutes");
const {
  bearerFor,
  createMemoryJsonStore,
  invokeRouter,
  silentStream,
} = require("../../test/invokeRouter");

const shopper = {
  id: "u-01",
  username: "ada",
  email: "ada@example.com",
  password: "secret",
  role: "customer",
  fullName: "Ada",
};

const otherShopper = {
  id: "u-02",
  username: "grace",
  email: "grace@example.com",
  password: "secret",
  role: "customer",
  fullName: "Grace",
};

const ownOrder = {
  id: "order-01",
  userId: "u-01",
  items: [{ productId: "p-01", quantity: 1 }],
  status: "placed",
};

const otherOrder = {
  id: "order-02",
  userId: "u-02",
  items: [{ productId: "p-02", quantity: 1 }],
  status: "placed",
};

function orderRouter(store) {
  const stream = silentStream();
  return createOrderRouter(store, stream, stream, stream, stream);
}

test("GET /orders returns only the caller's orders", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper, otherShopper],
    "orders.json": [ownOrder, otherOrder],
  });

  const response = await invokeRouter(orderRouter(store), {
    method: "GET",
    path: "/orders",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.items.map((order) => order.id),
    ["order-01"],
  );
});

test("a missing order token is rejected", async () => {
  const store = createMemoryJsonStore({ "users.json": [shopper], "orders.json": [] });

  const response = await invokeRouter(orderRouter(store), {
    method: "GET",
    path: "/orders",
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Missing or invalid token" });
});

test("an unknown order id is rejected", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "orders.json": [ownOrder],
  });

  const response = await invokeRouter(orderRouter(store), {
    method: "GET",
    path: "/orders/missing",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "Order not found" });
});

test("another shopper's order is not returned", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper, otherShopper],
    "orders.json": [ownOrder, otherOrder],
  });

  const response = await invokeRouter(orderRouter(store), {
    method: "GET",
    path: "/orders/order-02",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { message: "Not allowed to access this order" });
});

test("an order with no items leaves orders.json unchanged", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "orders.json": [ownOrder],
  });

  const response = await invokeRouter(orderRouter(store), {
    method: "POST",
    path: "/orders",
    headers: bearerFor(shopper),
    body: { items: [] },
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "An order must include at least one item");
  assert.deepEqual(store.files["orders.json"], [ownOrder]);
});
