/**
 * Verifies sign-out-everywhere against an in-memory store.
 * Role: Asserts the revocation row and that a revoked token cannot sign out again.
 * Not in this file: The session SSE stream.
 * Key dependencies: node:test; src/routes/sessionRoutes.js; test/invokeRouter.js.
 * See also: src/domain/sessionRevocation.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createSessionRouter } = require("./sessionRoutes");
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
};

function sessionRouter(store) {
  return createSessionRouter(store, silentStream());
}

test("POST /auth/sign-out-everywhere stores a revocation for the caller", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "sessionRevocations.json": [],
  });

  const response = await invokeRouter(sessionRouter(store), {
    method: "POST",
    path: "/auth/sign-out-everywhere",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 204);
  assert.equal(response.body, null);
  assert.equal(store.files["sessionRevocations.json"][0].userId, "u-01");
});

test("a missing sign-out token is rejected", async () => {
  const store = createMemoryJsonStore({ "sessionRevocations.json": [] });

  const response = await invokeRouter(sessionRouter(store), {
    method: "POST",
    path: "/auth/sign-out-everywhere",
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Missing or invalid token" });
});

test("a token that was just revoked cannot sign out again", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "sessionRevocations.json": [],
  });
  const router = sessionRouter(store);
  const headers = bearerFor(shopper);

  const first = await invokeRouter(router, {
    method: "POST",
    path: "/auth/sign-out-everywhere",
    headers,
  });
  const second = await invokeRouter(router, {
    method: "POST",
    path: "/auth/sign-out-everywhere",
    headers,
  });

  assert.equal(first.status, 204);
  assert.equal(second.status, 401);
  assert.equal(store.files["sessionRevocations.json"].length, 1);
  assert.equal(store.files["sessionRevocations.json"][0].userId, "u-01");
});
