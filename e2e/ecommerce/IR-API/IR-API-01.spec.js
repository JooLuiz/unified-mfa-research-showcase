/**
 * Verifies shared API rejections a caller can observe without a session.
 * Role: Locks missing-token and unknown-id responses served by both comparison branches.
 * Not in this file: Routes that exist on only one branch.
 * Key dependencies: @playwright/test.
 * See also: apps/mock-data-service/src/routes/orderRoutes.js.
 */

const { test, expect } = require("@playwright/test");

const API_ORIGIN = "http://localhost:4000/api";

const missingTokenReads = [
  "/orders",
  "/orders/missing-order",
  "/cart",
  "/users/me",
  "/notifications",
  "/admin/orders",
  "/admin/orders/missing-order",
  "/admin/posts",
];

test("a missing token is rejected on the shared read APIs", async ({ request }) => {
  for (const path of missingTokenReads) {
    const response = await request.get(`${API_ORIGIN}${path}`);
    expect(response.status()).toBe(401);
    expect(await response.json()).toEqual({ message: "Missing or invalid token" });
  }
});

test("a missing token is rejected on the shared write APIs", async ({ request }) => {
  const signOut = await request.post(`${API_ORIGIN}/auth/sign-out-everywhere`);
  expect(signOut.status()).toBe(401);
  expect(await signOut.json()).toEqual({ message: "Missing or invalid token" });

  const profileUpdate = await request.put(`${API_ORIGIN}/users/me`, {
    data: { fullName: "Ada" },
  });
  expect(profileUpdate.status()).toBe(401);
  expect(await profileUpdate.json()).toEqual({ message: "Missing or invalid token" });

  const newPost = await request.post(`${API_ORIGIN}/posts`, {
    data: { content: "Hello" },
  });
  expect(newPost.status()).toBe(401);
  expect(await newPost.json()).toEqual({ message: "Missing or invalid token" });
});

test("an unknown product and an unknown post are not found", async ({ request }) => {
  const product = await request.get(`${API_ORIGIN}/products/missing-product`);
  expect(product.status()).toBe(404);
  expect(await product.json()).toEqual({ message: "Product not found" });

  const post = await request.get(`${API_ORIGIN}/posts/missing-post`);
  expect(post.status()).toBe(404);
  expect(await post.json()).toEqual({ message: "Post not found" });
});
