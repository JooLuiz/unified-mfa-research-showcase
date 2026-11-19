/**
 * Verifies shared API outcomes that need a real session.
 * Role: Locks validation, unknown ids, and another user's order on URLs both branches serve.
 * Not in this file: Routes that exist on only one branch, and writes that change seed data.
 * Key dependencies: @playwright/test.
 * See also: e2e/ecommerce/IR-API/IR-API-01.spec.js.
 */

const { test, expect } = require("@playwright/test");

const API_ORIGIN = "http://localhost:4000/api";
const ALICE_ORDER_ID = "order-mp20d2w4-s59o9n";

/**
 * Signs in with the shared seed password and returns the bearer token.
 *
 * @param {import("@playwright/test").APIRequestContext} request - Playwright request fixture.
 * @param {string} username - Seed username or email.
 * @returns {Promise<string>} Bearer token.
 */
async function signIn(request, username) {
  const response = await request.post(`${API_ORIGIN}/auth/login`, {
    data: { username, password: "password123" },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(typeof body.token).toBe("string");
  return body.token;
}

test("invalid and empty credentials are rejected", async ({ request }) => {
  const invalidLogin = await request.post(`${API_ORIGIN}/auth/login`, {
    data: { username: "alice.parker", password: "wrong-password" },
  });
  expect(invalidLogin.status()).toBe(401);
  expect(await invalidLogin.json()).toEqual({ message: "Invalid credentials" });

  const emptyLogin = await request.post(`${API_ORIGIN}/auth/login`, { data: {} });
  expect(emptyLogin.status()).toBe(401);
  expect(await emptyLogin.json()).toEqual({ message: "Invalid credentials" });
});

test("an incomplete FAQ submission is rejected", async ({ request }) => {
  const response = await request.post(`${API_ORIGIN}/faq`, { data: {} });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({
    message: "Name, email, and question are required",
  });
});

test("product filters keep the matching catalog rows", async ({ request }) => {
  const byId = await request.get(`${API_ORIGIN}/products?ids=p-01`);
  expect(byId.status()).toBe(200);
  const byIdBody = await byId.json();
  expect(byIdBody.total).toBe(1);
  expect(byIdBody.items[0].id).toBe("p-01");

  const byCategory = await request.get(`${API_ORIGIN}/products?categoryIds=cat-lighting`);
  expect(byCategory.status()).toBe(200);
  const categoryBody = await byCategory.json();
  expect(categoryBody.items.every((product) => product.categoryId === "cat-lighting")).toBe(true);
  expect(categoryBody.total).toBeGreaterThan(0);

  const byName = await request.get(`${API_ORIGIN}/products?search=desk%20lamp`);
  expect(byName.status()).toBe(200);
  const nameBody = await byName.json();
  expect(nameBody.items.some((product) => product.id === "p-01")).toBe(true);

  const none = await request.get(`${API_ORIGIN}/products?search=zzzz-no-such-product`);
  expect(none.status()).toBe(200);
  expect((await none.json()).total).toBe(0);

  const aboveRange = await request.get(`${API_ORIGIN}/products?minPrice=1000000`);
  expect(aboveRange.status()).toBe(200);
  expect((await aboveRange.json()).total).toBe(0);

  const ignoredPrice = await request.get(`${API_ORIGIN}/products?minPrice=not-a-number`);
  expect(ignoredPrice.status()).toBe(200);
  expect((await ignoredPrice.json()).total).toBeGreaterThan(0);

  const priceAscending = await request.get(`${API_ORIGIN}/products?sortBy=price-asc`);
  const ascendingItems = (await priceAscending.json()).items;
  expect(ascendingItems[0].price).toBeLessThanOrEqual(ascendingItems[1].price);

  const priceDescending = await request.get(`${API_ORIGIN}/products?sortBy=price-desc`);
  const descendingItems = (await priceDescending.json()).items;
  expect(descendingItems[0].price).toBeGreaterThanOrEqual(descendingItems[1].price);

  const nameAscending = await request.get(`${API_ORIGIN}/products?sortBy=name-asc`);
  const nameItems = (await nameAscending.json()).items;
  expect(nameItems[0].name.localeCompare(nameItems[1].name)).toBeLessThanOrEqual(0);
});

test("a known product and a known post are returned", async ({ request }) => {
  const product = await request.get(`${API_ORIGIN}/products/p-01`);
  expect(product.status()).toBe(200);
  expect((await product.json()).id).toBe("p-01");

  const post = await request.get(`${API_ORIGIN}/posts/post-01`);
  expect(post.status()).toBe(200);
  expect((await post.json()).id).toBe("post-01");
});

test("unknown catalog records are not found", async ({ request }) => {
  const showcase = await request.get(`${API_ORIGIN}/showcases/missing-showcase`);
  expect(showcase.status()).toBe(404);
  expect(await showcase.json()).toEqual({ message: "Showcase not found" });

  const banner = await request.get(`${API_ORIGIN}/banners/missing-banner`);
  expect(banner.status()).toBe(404);
  expect(await banner.json()).toEqual({ message: "Banner not found" });
});

test("public catalog and post lists return a total and items", async ({ request }) => {
  for (const path of ["/products", "/posts"]) {
    const response = await request.get(`${API_ORIGIN}${path}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(body.items.length);
    expect(body.total).toBeGreaterThan(0);
  }
});

test("public category, showcase, and banner lists return arrays", async ({ request }) => {
  for (const path of ["/categories", "/showcases", "/banners"]) {
    const response = await request.get(`${API_ORIGIN}${path}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  }
});

test("a signed-in customer sees their own cart, profile, and orders", async ({ request }) => {
  const token = await signIn(request, "bruno.silva");
  const headers = { Authorization: `Bearer ${token}` };

  const profile = await request.get(`${API_ORIGIN}/users/me`, { headers });
  expect(profile.status()).toBe(200);
  expect((await profile.json()).email).toBe("bruno@example.com");

  const cart = await request.get(`${API_ORIGIN}/cart`, { headers });
  expect(cart.status()).toBe(200);
  const cartBody = await cart.json();
  expect(Array.isArray(cartBody.items)).toBe(true);

  const orders = await request.get(`${API_ORIGIN}/orders`, { headers });
  expect(orders.status()).toBe(200);
  const ordersBody = await orders.json();
  expect(ordersBody.total).toBe(ordersBody.items.length);
});

test("a customer cannot read another shopper's order or an unknown order", async ({ request }) => {
  const token = await signIn(request, "bruno.silva");
  const headers = { Authorization: `Bearer ${token}` };

  const foreignOrder = await request.get(`${API_ORIGIN}/orders/${ALICE_ORDER_ID}`, { headers });
  expect(foreignOrder.status()).toBe(403);
  expect(await foreignOrder.json()).toEqual({ message: "Not allowed to access this order" });

  const missingOrder = await request.get(`${API_ORIGIN}/orders/missing-order`, { headers });
  expect(missingOrder.status()).toBe(404);
  expect(await missingOrder.json()).toEqual({ message: "Order not found" });
});

test("a post without content is rejected", async ({ request }) => {
  const token = await signIn(request, "bruno.silva");
  const response = await request.post(`${API_ORIGIN}/posts`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { content: "   " },
  });
  expect(response.status()).toBe(400);
  expect(await response.json()).toEqual({ message: "Post content is required" });
});

test("notifications require a known shell", async ({ request }) => {
  const token = await signIn(request, "bruno.silva");
  const headers = { Authorization: `Bearer ${token}` };
  const rejected = await request.get(`${API_ORIGIN}/notifications?shell=unknown`, { headers });
  expect(rejected.status()).toBe(400);
  expect(await rejected.json()).toEqual({ message: "Valid shell query parameter required" });

  const accepted = await request.get(`${API_ORIGIN}/notifications?shell=ecommerce`, { headers });
  expect(accepted.status()).toBe(200);
  const inbox = await accepted.json();
  expect(inbox.total).toBe(inbox.items.length);
});

test("a customer is refused on admin reads", async ({ request }) => {
  const token = await signIn(request, "bruno.silva");
  const headers = { Authorization: `Bearer ${token}` };
  for (const path of ["/admin/orders", `/admin/orders/${ALICE_ORDER_ID}`, "/admin/posts"]) {
    const response = await request.get(`${API_ORIGIN}${path}`, { headers });
    expect(response.status()).toBe(403);
    expect(await response.json()).toEqual({ message: "Admin access required" });
  }
});

test("an admin can list orders and posts and is told when an order is missing", async ({ request }) => {
  const token = await signIn(request, "alice.parker");
  const headers = { Authorization: `Bearer ${token}` };

  const orders = await request.get(`${API_ORIGIN}/admin/orders`, { headers });
  expect(orders.status()).toBe(200);
  const ordersBody = await orders.json();
  expect(ordersBody.total).toBe(ordersBody.items.length);
  expect(ordersBody.total).toBeGreaterThan(0);

  const posts = await request.get(`${API_ORIGIN}/admin/posts`, { headers });
  expect(posts.status()).toBe(200);
  const postsBody = await posts.json();
  expect(postsBody.total).toBe(postsBody.items.length);

  const missingOrder = await request.get(`${API_ORIGIN}/admin/orders/missing-order`, { headers });
  expect(missingOrder.status()).toBe(404);
  expect(await missingOrder.json()).toEqual({ message: "Order not found" });

  const ownOrder = await request.get(`${API_ORIGIN}/orders/${ALICE_ORDER_ID}`, { headers });
  expect(ownOrder.status()).toBe(200);
  expect((await ownOrder.json()).id).toBe(ALICE_ORDER_ID);
});
