/**
 * Verifies that the notification inbox routes reject a request without a shell.
 * Role: Asserts the 400 status and that notificationInbox.json is unchanged.
 * Not in this file: Listing and marking rows (see notificationInboxRoutes.test.js).
 * Key dependencies: node:test; src/routes/notificationInboxRoutes.js; test/invokeRouter.js.
 * See also: src/routes/notificationInboxRoutes.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createNotificationInboxRouter } = require("./notificationInboxRoutes");
const { bearerFor, createMemoryJsonStore, invokeRouter, silentStream } = require("../../test/invokeRouter");

const shopper = { id: "u-01", username: "ada", email: "ada@example.com", password: "secret", role: "customer" };

const unreadRow = {
  id: "n-01",
  userId: "u-01",
  shell: "ecommerce",
  type: "order",
  title: "n-01",
  message: "Ready",
  link: "/orders/order-01",
  read: false,
  createdAt: "2026-06-01T00:00:00.000Z",
};

function createStore() {
  return createMemoryJsonStore({ "users.json": [shopper], "notificationInbox.json": [unreadRow] });
}

test("GET /notifications without a shell query returns 400", async () => {
  const store = createStore();

  const response = await invokeRouter(createNotificationInboxRouter(store, silentStream()), {
    method: "GET",
    path: "/notifications",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 400);
});

test("PUT /notifications/read-all without a shell query returns 400 and marks nothing", async () => {
  const store = createStore();

  const response = await invokeRouter(createNotificationInboxRouter(store, silentStream()), {
    method: "PUT",
    path: "/notifications/read-all",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(store.files["notificationInbox.json"], [unreadRow]);
});
