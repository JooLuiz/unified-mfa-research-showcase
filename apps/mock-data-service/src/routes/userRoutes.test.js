/**
 * Verifies the current-user routes against an in-memory store.
 * Role: Asserts the current-user profile reads and writes, and the 401, 404, and 500 responses.
 * Not in this file: Login.
 * Key dependencies: node:test; src/routes/userRoutes.js; test/invokeRouter.js.
 * See also: src/domain/auth.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createUserRouter } = require("./userRoutes");
const {
  bearerFor,
  createFailingJsonStore,
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

test("GET /users/me with a token for a deleted user is rejected", async () => {
  const store = createMemoryJsonStore({ "users.json": [structuredClone(shopper)] });

  const response = await invokeRouter(createUserRouter(store), {
    method: "GET",
    path: "/users/me",
    headers: bearerFor(missingShopper),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { message: "User not found" });
});

test("unreadable users return 500 from GET /users/me", async () => {
  const store = createFailingJsonStore(
    { "users.json": [structuredClone(shopper)] },
    { failOnRead: ["users.json"] },
  );

  const response = await invokeRouter(createUserRouter(store), {
    method: "GET",
    path: "/users/me",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    message: "Unable to load current user",
    details: "Cannot read users.json",
  });
});

test("an unwritable user file returns 500 and leaves the profile unchanged", async () => {
  const store = createFailingJsonStore(
    { "users.json": [structuredClone(shopper)] },
    { failOnWrite: ["users.json"] },
  );

  const response = await invokeRouter(createUserRouter(store), {
    method: "PUT",
    path: "/users/me",
    headers: bearerFor(shopper),
    body: { fullName: "Ada Lovelace" },
  });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    message: "Unable to update user",
    details: "Cannot write users.json",
  });
  assert.equal(store.files["users.json"][0].fullName, "Ada");
});

test("PUT /users/me with no body returns the user unchanged", async () => {
  const store = createMemoryJsonStore({ "users.json": [structuredClone(shopper)] });

  const response = await invokeRouter(createUserRouter(store), {
    method: "PUT",
    path: "/users/me",
    headers: bearerFor(shopper),
    parseJson: false,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.fullName, "Ada");
  assert.deepEqual(store.files["users.json"], [shopper]);
});
