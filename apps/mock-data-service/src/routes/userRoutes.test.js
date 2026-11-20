/**
 * Verifies the current-user routes against an in-memory store.
 * Role: Asserts the public profile and that a rejected write leaves users.json.
 * Not in this file: Login.
 * Key dependencies: node:test; src/routes/userRoutes.js; test/invokeRouter.js.
 * See also: src/domain/auth.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createUserRouter } = require("./userRoutes");
const {
  bearerFor,
  createMemoryJsonStore,
  invokeRouter,
} = require("../../test/invokeRouter");

const shopper = {
  id: "u-01",
  username: "ada",
  email: "ada@example.com",
  password: "secret",
  role: "customer",
  fullName: "Ada",
};

const missingShopper = { ...shopper, id: "ghost-01" };

test("GET /users/me returns the public user", async () => {
  const store = createMemoryJsonStore({ "users.json": [shopper] });

  const response = await invokeRouter(createUserRouter(store), {
    method: "GET",
    path: "/users/me",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.fullName, "Ada");
  assert.equal(response.body.password, undefined);
});

test("PUT /users/me stores the submitted name", async () => {
  const store = createMemoryJsonStore({ "users.json": [structuredClone(shopper)] });

  const response = await invokeRouter(createUserRouter(store), {
    method: "PUT",
    path: "/users/me",
    headers: bearerFor(shopper),
    body: { fullName: "Ada Lovelace" },
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.fullName, "Ada Lovelace");
  assert.equal(store.files["users.json"][0].fullName, "Ada Lovelace");
});

test("a missing profile token leaves the user row unchanged", async () => {
  const store = createMemoryJsonStore({ "users.json": [structuredClone(shopper)] });

  const response = await invokeRouter(createUserRouter(store), {
    method: "PUT",
    path: "/users/me",
    body: { fullName: "Ada Lovelace" },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Missing or invalid token" });
  assert.equal(store.files["users.json"][0].fullName, "Ada");
});

test("a token for a missing user leaves users.json unchanged", async () => {
  const store = createMemoryJsonStore({ "users.json": [structuredClone(shopper)] });

  const response = await invokeRouter(createUserRouter(store), {
    method: "PUT",
    path: "/users/me",
    headers: bearerFor(missingShopper),
    body: { fullName: "Ada Lovelace" },
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "User not found" });
  assert.equal(store.files["users.json"][0].fullName, "Ada");
});
