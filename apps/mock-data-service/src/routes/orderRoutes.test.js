/**
 * Verifies the shopper order routes against an in-memory store.
 * Role: Asserts which orders a caller can read, what placing an order stores, and the
 *   401, 404, and 500 responses.
 * Not in this file: Order status changes.
 * Key dependencies: node:test; src/routes/orderRoutes.js; test/invokeRouter.js.
 * See also: src/domain/orderProcessing.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createOrderRouter } = require("./orderRoutes");
const {
  bearerFor,
  createFailingJsonStore,
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

const ghost = { ...shopper, id: "ghost-01" };

const ownCart = {
  userId: "u-01",
  items: [{ productId: "p-01", quantity: 2 }],
  appliedCoupon: null,
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const otherCart = {
  userId: "u-02",
  items: [{ productId: "p-01", quantity: 1 }],
  appliedCoupon: null,
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const product = { id: "p-01", name: "Lamp", price: 10, stock: 5 };

function placeableFiles() {
  return {
    "users.json": [shopper, otherShopper],
    "orders.json": [ownOrder],
    "carts.json": [ownCart, otherCart],
    "products.json": [product],
  };
}

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

test("POST /orders stores the order, clears the caller's cart, and lowers stock", async () => {
  const store = createMemoryJsonStore(placeableFiles());

  const response = await invokeRouter(orderRouter(store), {
    method: "POST",
    path: "/orders",
    headers: bearerFor(shopper),
    body: { items: [{ productId: "p-01", quantity: 2 }], totalAmount: 20 },
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.userId, "u-01");
  assert.equal(response.body.status, "placed");
  assert.equal(response.body.totalAmount, 20);
  const storedOrders = store.files["orders.json"];
  assert.equal(storedOrders.length, 2);
  assert.equal(storedOrders[1].id, response.body.id);
  assert.deepEqual(store.files["carts.json"], [otherCart]);
  assert.equal(store.files["products.json"][0].stock, 3);
});

test("an order that cannot be stored returns 500 and leaves orders.json unchanged", async () => {
  const store = createFailingJsonStore(placeableFiles(), { failOnWrite: ["orders.json"] });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await invokeRouter(orderRouter(store), {
      method: "POST",
      path: "/orders",
      headers: bearerFor(shopper),
      body: { items: [{ productId: "p-01", quantity: 2 }] },
    });

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, {
      message: "Unable to place order",
      details: "order-persistence-failed",
    });
    assert.deepEqual(store.files["orders.json"], [ownOrder]);
  } finally {
    console.error = originalConsoleError;
  }
});

test("placing an order without a token is rejected", async () => {
  const store = createMemoryJsonStore(placeableFiles());

  const response = await invokeRouter(orderRouter(store), {
    method: "POST",
    path: "/orders",
    body: { items: [{ productId: "p-01", quantity: 1 }] },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Missing or invalid token" });
  assert.deepEqual(store.files["orders.json"], [ownOrder]);
});

test("placing an order for a deleted user is rejected", async () => {
  const store = createMemoryJsonStore(placeableFiles());

  const response = await invokeRouter(orderRouter(store), {
    method: "POST",
    path: "/orders",
    headers: bearerFor(ghost),
    body: { items: [{ productId: "p-01", quantity: 1 }] },
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "User not found" });
  assert.deepEqual(store.files["orders.json"], [ownOrder]);
});

test("reading an order for a deleted user is rejected", async () => {
  const store = createMemoryJsonStore({
    "users.json": [otherShopper],
    "orders.json": [ownOrder],
  });

  const response = await invokeRouter(orderRouter(store), {
    method: "GET",
    path: "/orders/order-01",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "User not found" });
});

test("an unreadable store returns 500 from every order route", async () => {
  const placeStore = createFailingJsonStore(placeableFiles(), { failOnRead: ["users.json"] });
  const readStore = createFailingJsonStore(placeableFiles(), { failOnRead: ["orders.json"] });

  const placeResponse = await invokeRouter(orderRouter(placeStore), {
    method: "POST",
    path: "/orders",
    headers: bearerFor(shopper),
    body: { items: [{ productId: "p-01", quantity: 1 }] },
  });
  const listResponse = await invokeRouter(orderRouter(readStore), {
    method: "GET",
    path: "/orders",
    headers: bearerFor(shopper),
  });
  const singleResponse = await invokeRouter(orderRouter(readStore), {
    method: "GET",
    path: "/orders/order-01",
    headers: bearerFor(shopper),
  });

  assert.equal(placeResponse.status, 500);
  assert.deepEqual(placeResponse.body, {
    message: "Unable to place order",
    details: "Cannot read users.json",
  });
  assert.equal(listResponse.status, 500);
  assert.deepEqual(listResponse.body, {
    message: "Unable to load orders",
    details: "Cannot read orders.json",
  });
  assert.equal(singleResponse.status, 500);
  assert.deepEqual(singleResponse.body, {
    message: "Unable to load order",
    details: "Cannot read orders.json",
  });
  assert.deepEqual(placeStore.files["orders.json"], [ownOrder]);
});
