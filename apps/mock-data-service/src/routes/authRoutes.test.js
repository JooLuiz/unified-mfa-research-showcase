/**
 * Verifies login against an in-memory user file.
 * Role: Asserts the login token and public user, the rejected credentials, and the 500 response.
 * Not in this file: Profile updates.
 * Key dependencies: node:test; src/routes/authRoutes.js; test/invokeRouter.js.
 * See also: src/domain/auth.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createAuthRouter } = require("./authRoutes");
const {
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

test("unreadable users return 500 from POST /auth/login", async () => {
  const store = createFailingJsonStore({ "users.json": [shopper] }, { failOnRead: ["users.json"] });

  const response = await invokeRouter(createAuthRouter(store), {
    method: "POST",
    path: "/auth/login",
    body: { username: "ada", password: "secret" },
  });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    message: "Unable to authenticate",
    details: "Cannot read users.json",
  });
});
