/**
 * Verifies login against an in-memory user file.
 * Role: Asserts the public user returned on success and that a bad password changes nothing.
 * Not in this file: Profile updates.
 * Key dependencies: node:test; src/routes/authRoutes.js; test/invokeRouter.js.
 * See also: src/domain/auth.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createAuthRouter } = require("./authRoutes");
const { createMemoryJsonStore, invokeRouter } = require("../../test/invokeRouter");

const shopper = {
  id: "u-01",
  username: "ada",
  email: "ada@example.com",
  password: "secret",
  role: "customer",
  fullName: "Ada",
};

test("POST /auth/login returns a token and a public user", async () => {
  const store = createMemoryJsonStore({ "users.json": [shopper] });

  const response = await invokeRouter(createAuthRouter(store), {
    method: "POST",
    path: "/auth/login",
    body: { username: "ada", password: "secret" },
  });

  assert.equal(response.status, 200);
  assert.equal(typeof response.body.token, "string");
  assert.equal(response.body.user.fullName, "Ada");
  assert.equal(response.body.user.password, undefined);
});

test("a wrong password is rejected and users.json is unchanged", async () => {
  const store = createMemoryJsonStore({ "users.json": [shopper] });

  const response = await invokeRouter(createAuthRouter(store), {
    method: "POST",
    path: "/auth/login",
    body: { username: "ada", password: "nope" },
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Invalid credentials" });
  assert.deepEqual(store.files["users.json"], [shopper]);
});
