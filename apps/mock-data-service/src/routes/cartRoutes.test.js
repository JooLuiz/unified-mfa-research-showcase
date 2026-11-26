/**
 * Verifies the cart HTTP routes against an in-memory store.
 * Role: Asserts status, response body, and the cart and guest-hold files left behind,
 *   including the 500 responses.
 * Not in this file: The cart SSE stream.
 * Key dependencies: node:test; src/routes/cartRoutes.js; test/invokeRouter.js.
 * See also: src/domain/cartProcessing.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createCartRouter } = require("./cartRoutes");
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

const storedCart = {
  userId: "u-01",
  items: [{ productId: "p-01", quantity: 1 }],
  appliedCoupon: null,
  updatedAt: "2026-06-01T00:00:00.000Z",
};

function cartRouter(store) {
  return createCartRouter(store, silentStream(), silentStream());
}

test("GET /cart returns the stored cart", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "carts.json": [storedCart],
  });

  const response = await invokeRouter(cartRouter(store), {
    method: "GET",
    path: "/cart",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items, [{ productId: "p-01", quantity: 1 }]);
});

test("PUT /cart stores the submitted cart and returns it", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "carts.json": [],
  });
  const nextCart = {
    items: [{ productId: "p-01", quantity: 1 }],
    appliedCoupon: null,
  };

  const response = await invokeRouter(cartRouter(store), {
    method: "PUT",
    path: "/cart",
    headers: bearerFor(shopper),
    body: nextCart,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.items, nextCart.items);
  assert.deepEqual(store.files["carts.json"][0].items, nextCart.items);
});

test("a missing cart token is rejected", async () => {
  const store = createMemoryJsonStore({ "users.json": [shopper], "carts.json": [] });

  const response = await invokeRouter(cartRouter(store), {
    method: "GET",
    path: "/cart",
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Missing or invalid token" });
});

test("a cart token for an unknown user is rejected", async () => {
  const store = createMemoryJsonStore({ "users.json": [], "carts.json": [] });

  const response = await invokeRouter(cartRouter(store), {
    method: "GET",
    path: "/cart",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "User not found" });
});

test("an invalid cart body leaves the stored cart unchanged", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "carts.json": [storedCart],
  });

  const response = await invokeRouter(cartRouter(store), {
    method: "PUT",
    path: "/cart",
    headers: bearerFor(shopper),
    body: { items: ["p-01"] },
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { message: "Cart items are invalid" });
  assert.deepEqual(store.files["carts.json"], [storedCart]);
});

test("saving a cart releases the named guest hold session", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "carts.json": [],
    "guestHolds.json": { "guest-01": [{ productId: "p-01", quantity: 1 }] },
  });

  const response = await invokeRouter(cartRouter(store), {
    method: "PUT",
    path: "/cart",
    headers: {
      ...bearerFor(shopper),
      "x-stock-session-to-release": "guest-01",
    },
    body: { items: [{ productId: "p-01", quantity: 1 }], appliedCoupon: null },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(store.files["guestHolds.json"], {});
});

test("a failed cart write returns 500 and leaves the previous cart", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "carts.json": [storedCart],
  });
  const failingStore = {
    ...store,
    async writeJsonFile() {
      throw new Error("disk full");
    },
  };

  const response = await invokeRouter(cartRouter(failingStore), {
    method: "PUT",
    path: "/cart",
    headers: bearerFor(shopper),
    body: { items: [{ productId: "p-01", quantity: 2 }], appliedCoupon: null },
  });

  assert.equal(response.status, 500);
  assert.equal(response.body.message, "Unable to save cart");
  assert.deepEqual(store.files["carts.json"], [storedCart]);
});

test("an invalid stored cart file returns 500 from GET /cart", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "carts.json": {},
  });

  const response = await invokeRouter(cartRouter(store), {
    method: "GET",
    path: "/cart",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { message: "Unable to load cart" });
});

test("unreadable users return 500 from both cart routes and leave the cart", async () => {
  const store = createFailingJsonStore(
    { "users.json": [shopper], "carts.json": [storedCart] },
    { failOnRead: ["users.json"] },
  );
  const router = cartRouter(store);

  const readResponse = await invokeRouter(router, {
    method: "GET",
    path: "/cart",
    headers: bearerFor(shopper),
  });
  const saveResponse = await invokeRouter(router, {
    method: "PUT",
    path: "/cart",
    headers: bearerFor(shopper),
    body: { items: [{ productId: "p-01", quantity: 2 }], appliedCoupon: null },
  });

  assert.equal(readResponse.status, 500);
  assert.deepEqual(readResponse.body, {
    message: "Unable to load cart",
    details: "Cannot read users.json",
  });
  assert.equal(saveResponse.status, 500);
  assert.deepEqual(saveResponse.body, {
    message: "Unable to save cart",
    details: "Cannot read users.json",
  });
  assert.deepEqual(store.files["carts.json"], [storedCart]);
});
