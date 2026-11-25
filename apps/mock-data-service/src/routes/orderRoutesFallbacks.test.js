/**
 * Verifies how the order placement route handles a missing body and an optional inbox.
 * Role: Asserts the 400 for a request with no body and the 201 when no notification inbox is wired.
 * Not in this file: Order reads, the 401/404/500 responses (see orderRoutes.test.js).
 * Key dependencies: node:test; src/routes/orderRoutes.js; test/invokeRouter.js.
 * See also: src/routes/orderRoutes.test.js; src/domain/orderProcessing.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createOrderRouter } = require("./orderRoutes");
const { bearerFor, createMemoryJsonStore, invokeRouter, silentStream } = require("../../test/invokeRouter");

const shopper = {
  id: "u-01",
  username: "ada",
  email: "ada@example.com",
  password: "secret",
  role: "customer",
  fullName: "Ada",
};

function placeableFiles() {
  return {
    "users.json": [shopper],
    "orders.json": [],
    "carts.json": [{ userId: "u-01", items: [{ productId: "p-01", quantity: 1 }], appliedCoupon: null }],
    "products.json": [{ id: "p-01", name: "Lamp", price: 10, stock: 5 }],
  };
}

test("an order request with no body is rejected and stores nothing", async () => {
  const store = createMemoryJsonStore(placeableFiles());
  const stream = silentStream();

  const response = await invokeRouter(createOrderRouter(store, stream, stream, stream, stream), {
    method: "POST",
    path: "/orders",
    headers: bearerFor(shopper),
    parseJson: false,
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { message: "An order must include at least one item" });
  assert.deepEqual(store.files["orders.json"], []);
});

test("an order router without a notification inbox still stores the order", async () => {
  const store = createMemoryJsonStore(placeableFiles());
  const stream = silentStream();

  const response = await invokeRouter(createOrderRouter(store, stream, stream, stream), {
    method: "POST",
    path: "/orders",
    headers: bearerFor(shopper),
    body: { items: [{ productId: "p-01", quantity: 1 }], totalAmount: 10 },
  });

  assert.equal(response.status, 201);
  assert.equal(store.files["orders.json"].length, 1);
  assert.equal(store.files["orders.json"][0].id, response.body.id);
  assert.equal(store.files["products.json"][0].stock, 4);
});
