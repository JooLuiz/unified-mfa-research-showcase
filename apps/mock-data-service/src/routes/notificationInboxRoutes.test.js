/**
 * Verifies the notification inbox HTTP routes against an in-memory store.
 * Role: Asserts the listed rows, the read flags left in notificationInbox.json, and the
 *   401, 403, 404, and 500 responses.
 * Not in this file: The inbox SSE stream.
 * Key dependencies: node:test; src/routes/notificationInboxRoutes.js; test/invokeRouter.js.
 * See also: src/domain/notificationInbox.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { createNotificationInboxRouter } = require("./notificationInboxRoutes");
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
};

function inboxRow(id, shell, read = false) {
  return {
    id,
    userId: "u-01",
    shell,
    type: "order",
    title: id,
    message: "Ready",
    link: "/orders/order-01",
    read,
    createdAt: "2026-06-01T00:00:00.000Z",
  };
}

function inboxRouter(store) {
  return createNotificationInboxRouter(store, silentStream());
}

test("GET /notifications returns only the caller's rows for that shell", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "notificationInbox.json": [
      inboxRow("note-01", "ecommerce"),
      inboxRow("note-02", "social"),
      { ...inboxRow("note-03", "ecommerce"), userId: "u-02" },
    ],
  });

  const response = await invokeRouter(inboxRouter(store), {
    method: "GET",
    path: "/notifications?shell=ecommerce",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(
    response.body.items.map((row) => row.id),
    ["note-01"],
  );
});

test("PUT /notifications/:id/read marks that row read", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "notificationInbox.json": [inboxRow("note-01", "ecommerce")],
  });

  const response = await invokeRouter(inboxRouter(store), {
    method: "PUT",
    path: "/notifications/note-01/read",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.read, true);
  assert.equal(store.files["notificationInbox.json"][0].read, true);
});

test("PUT /notifications/read-all marks every row in that shell", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "notificationInbox.json": [
      inboxRow("note-01", "ecommerce"),
      inboxRow("note-02", "ecommerce"),
      inboxRow("note-03", "social"),
    ],
  });

  const response = await invokeRouter(inboxRouter(store), {
    method: "PUT",
    path: "/notifications/read-all?shell=ecommerce",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 200);
  assert.equal(store.files["notificationInbox.json"][0].read, true);
  assert.equal(store.files["notificationInbox.json"][1].read, true);
  assert.equal(store.files["notificationInbox.json"][2].read, false);
  assert.equal(response.body.total, 2);
});

test("a missing inbox token is rejected", async () => {
  const store = createMemoryJsonStore({ "notificationInbox.json": [] });

  const response = await invokeRouter(inboxRouter(store), {
    method: "GET",
    path: "/notifications?shell=ecommerce",
  });

  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { message: "Missing or invalid token" });
});

test("an empty shell query is rejected and an empty shell returns no rows", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "notificationInbox.json": [inboxRow("note-01", "social")],
  });
  const router = inboxRouter(store);

  const missingShell = await invokeRouter(router, {
    method: "GET",
    path: "/notifications?shell=",
    headers: bearerFor(shopper),
  });
  const emptyShell = await invokeRouter(router, {
    method: "GET",
    path: "/notifications?shell=admin",
    headers: bearerFor(shopper),
  });

  assert.equal(missingShell.status, 400);
  assert.equal(emptyShell.status, 200);
  assert.deepEqual(emptyShell.body, { total: 0, items: [] });
});

test("marking another user's row read is forbidden and the row stays unread", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "notificationInbox.json": [{ ...inboxRow("note-09", "ecommerce"), userId: "u-02" }],
  });

  const response = await invokeRouter(inboxRouter(store), {
    method: "PUT",
    path: "/notifications/note-09/read",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, {
    message: "Unable to mark notification read",
    code: "notification-forbidden",
  });
  assert.equal(store.files["notificationInbox.json"][0].read, false);
});

test("marking an unknown notification read is rejected", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "notificationInbox.json": [inboxRow("note-01", "ecommerce")],
  });

  const response = await invokeRouter(inboxRouter(store), {
    method: "PUT",
    path: "/notifications/missing/read",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 404);
  assert.deepEqual(response.body, {
    message: "Unable to mark notification read",
    code: "notification-not-found",
  });
  assert.equal(store.files["notificationInbox.json"][0].read, false);
});

test("marking rows read without a token is rejected and the rows stay unread", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "notificationInbox.json": [inboxRow("note-01", "ecommerce")],
  });
  const router = inboxRouter(store);

  const readOne = await invokeRouter(router, {
    method: "PUT",
    path: "/notifications/note-01/read",
  });
  const readAll = await invokeRouter(router, {
    method: "PUT",
    path: "/notifications/read-all?shell=ecommerce",
  });

  assert.equal(readOne.status, 401);
  assert.deepEqual(readOne.body, { message: "Missing or invalid token" });
  assert.equal(readAll.status, 401);
  assert.deepEqual(readAll.body, { message: "Missing or invalid token" });
  assert.equal(store.files["notificationInbox.json"][0].read, false);
});

test("marking every row read with a blank shell is rejected", async () => {
  const store = createMemoryJsonStore({
    "users.json": [shopper],
    "notificationInbox.json": [inboxRow("note-01", "ecommerce")],
  });

  const response = await invokeRouter(inboxRouter(store), {
    method: "PUT",
    path: "/notifications/read-all?shell=",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { message: "Valid shell query parameter required" });
  assert.equal(store.files["notificationInbox.json"][0].read, false);
});

test("an unreadable inbox returns 500 from GET /notifications", async () => {
  const store = createFailingJsonStore(
    { "users.json": [shopper], "notificationInbox.json": [inboxRow("note-01", "ecommerce")] },
    { failOnRead: ["notificationInbox.json"] },
  );

  const response = await invokeRouter(inboxRouter(store), {
    method: "GET",
    path: "/notifications?shell=ecommerce",
    headers: bearerFor(shopper),
  });

  assert.equal(response.status, 500);
  assert.deepEqual(response.body, {
    message: "Unable to load notifications",
    details: "Cannot read notificationInbox.json",
  });
});

test("an unwritable inbox returns 500 from both read routes and the rows stay unread", async () => {
  const store = createFailingJsonStore(
    { "users.json": [shopper], "notificationInbox.json": [inboxRow("note-01", "ecommerce")] },
    { failOnWrite: ["notificationInbox.json"] },
  );
  const router = inboxRouter(store);

  const readOne = await invokeRouter(router, {
    method: "PUT",
    path: "/notifications/note-01/read",
    headers: bearerFor(shopper),
  });
  const readAll = await invokeRouter(router, {
    method: "PUT",
    path: "/notifications/read-all?shell=ecommerce",
    headers: bearerFor(shopper),
  });

  assert.equal(readOne.status, 500);
  assert.deepEqual(readOne.body, {
    message: "Unable to mark notification read",
    details: "Cannot write notificationInbox.json",
  });
  assert.equal(readAll.status, 500);
  assert.deepEqual(readAll.body, {
    message: "Unable to mark notifications read",
    details: "Cannot write notificationInbox.json",
  });
  assert.equal(store.files["notificationInbox.json"][0].read, false);
});
