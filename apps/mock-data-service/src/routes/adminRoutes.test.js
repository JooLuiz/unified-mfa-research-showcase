/**
 * Verifies the admin list routes against an in-memory store.
 * Role: Asserts the admin order and post lists, and the auth rejections.
 * Not in this file: The admin SSE stream.
 * Key dependencies: node:test; src/routes/adminRoutes.js; test/invokeRouter.js.
 * See also: src/domain/auth.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createAdminRouter } = require("./adminRoutes");
const {
  bearerFor,
  createMemoryJsonStore,
  invokeRouter,
  silentStream,
} = require("../../test/invokeRouter");

const admin = {
  id: "admin-01",
  username: "admin",
  email: "admin@example.com",
  password: "secret",
  role: "admin",
  fullName: "Ada Admin",
};

const shopper = {
  id: "u-01",
  username: "ada",
  email: "ada@example.com",
  password: "secret",
  role: "customer",
  fullName: "Ada",
};

const order = {
  id: "order-01",
  userId: "u-01",
  items: [{ productId: "p-01", quantity: 1 }],
  placedAt: "2026-06-01T00:00:00.000Z",
  status: "placed",
};

const post = {
  id: "post-01",
  authorId: "u-01",
  content: "Hello",
  createdAt: "2026-06-01T00:00:00.000Z",
  likes: 0,
  comments: 0,
};

function adminRouter(users) {
  const store = createMemoryJsonStore({
    "users.json": users,
    "orders.json": [order],
    "posts.json": [post],
  });
  return { store, router: createAdminRouter(store, silentStream()) };
}

test("GET /admin/orders returns every order with its customer", async () => {
  const { router } = adminRouter([admin, shopper]);

  const response = await invokeRouter(router, {
    method: "GET",
    path: "/admin/orders",
    headers: bearerFor(admin),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.items[0].customer.fullName, "Ada");
});

test("a missing admin token is rejected", async () => {
  const { router } = adminRouter([admin]);

  const response = await invokeRouter(router, {
    method: "GET",
    path: "/admin/orders",
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Missing or invalid token" });
});

test("a customer token is rejected from the admin list", async () => {
  const { router } = adminRouter([admin, shopper]);

  const response = await invokeRouter(router, {
    method: "GET",
    path: "/admin/orders",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { message: "Admin access required" });
});

test("an unknown admin order id is rejected", async () => {
  const { router } = adminRouter([admin, shopper]);

  const response = await invokeRouter(router, {
    method: "GET",
    path: "/admin/orders/missing",
    headers: bearerFor(admin),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "Order not found" });
});

test("GET /admin/posts returns every post", async () => {
  const { router } = adminRouter([admin, shopper]);

  const response = await invokeRouter(router, {
    method: "GET",
    path: "/admin/posts",
    headers: bearerFor(admin),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.total, 1);
  assert.equal(response.body.items[0].content, "Hello");
});
