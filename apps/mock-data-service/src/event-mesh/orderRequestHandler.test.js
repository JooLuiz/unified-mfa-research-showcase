/**
 * Integration test for the orders/requested gateway handler's success reply.
 * Role: Regression coverage for the persisted-notification-toast investigation. A prior change
 *   removed the orders.requested success reply (it used to carry a toast via
 *   notifications.raised) without replacing it, so apps/ecommerce-shell/src/commands/placeOrder.js
 *   waited up to 15s for a reply that never arrived and reported every successful order as
 *   failed. This proves the handler now replies with orders/accepted immediately on success.
 * Key dependencies: event-mesh/gateway (real library, local test gateway); ws.
 * See also: src/event-mesh/orderRequestHandler.js; apps/ecommerce-shell/src/commands/placeOrder.js.
 */

const { test, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");

const { registerOrderRequestHandler } = require("./orderRequestHandler");

const TEST_GATEWAY_PORT = 39873;
const TEST_CUSTOMER_ID = "u-test-customer";

/** @type {import("event-mesh/gateway").default} */
let gateway;

function createFakeJsonStore(initialFiles) {
  const files = new Map(Object.entries(initialFiles));
  return {
    files,
    async readJsonFile(fileName) {
      if (!files.has(fileName)) {
        throw new Error(`createFakeJsonStore - missing file: ${fileName}`);
      }
      return structuredClone(files.get(fileName));
    },
    async readJsonFileWithDefault(fileName, defaultValue) {
      if (!files.has(fileName)) {
        return structuredClone(defaultValue);
      }
      return structuredClone(files.get(fileName));
    },
    async writeJsonFile(fileName, data) {
      files.set(fileName, structuredClone(data));
    },
  };
}

function createCallRecorder() {
  const calls = [];
  const fn = (...args) => calls.push(args);
  fn.calls = calls;
  return fn;
}

function connectTestClient() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${TEST_GATEWAY_PORT}`);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function waitForNextMessage(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("waitForNextMessage - timed out"));
    }, timeoutMs);

    function onMessage(rawData) {
      clearTimeout(timeoutId);
      socket.off("message", onMessage);
      resolve(JSON.parse(rawData.toString()));
    }

    socket.on("message", onMessage);
  });
}

// A fresh gateway per test avoids a leftover subscriber from one test replying a second time
// to the next test's request - registerOrderRequestHandler adds a new subscriber every call,
// and subscriptions are never torn down individually.
beforeEach(async () => {
  const gatewayModule = await import("event-mesh/gateway");
  gateway = gatewayModule.default;
  gatewayModule.configureGateway({
    gatewayPort: TEST_GATEWAY_PORT,
    authenticateConnection: async () => ({ userId: TEST_CUSTOMER_ID, roles: ["customer"] }),
    authorizeMessage: () => true,
  });
  await gateway.start();
});

afterEach(async () => {
  await gateway.stop();
});

test("orders/requested replies with orders/accepted immediately on success, not a notification", async () => {
  const jsonStore = createFakeJsonStore({
    "users.json": [{ id: TEST_CUSTOMER_ID, fullName: "Test Customer", role: "customer" }],
    "orders.json": [],
    "carts.json": [],
    "products.json": [{ id: "p-test-1", name: "Test Product", stock: 10 }],
  });
  const adminEventStream = { broadcastEvent: createCallRecorder() };
  const cartEventStream = { broadcastCartChanged: createCallRecorder() };
  const stockEventStream = { broadcastStockChanged: createCallRecorder() };
  const notificationInboxEventStream = { broadcastNotificationChanged: createCallRecorder() };

  await registerOrderRequestHandler(
    jsonStore,
    adminEventStream,
    cartEventStream,
    stockEventStream,
    notificationInboxEventStream,
  );

  const customerSocket = await connectTestClient();
  const replyPromise = waitForNextMessage(customerSocket, 2000);

  customerSocket.send(
    JSON.stringify({
      topic: "orders",
      event: "requested",
      payload: {
        items: [{ productId: "p-test-1", quantity: 1, unitPrice: 10 }],
        subtotal: 10,
        discountAmount: 0,
        totalAmount: 10,
      },
      scope: "distributed",
      origin: "mesh",
      broadcastToPeers: false,
      timestamp: Date.now(),
    }),
  );

  const reply = await replyPromise;

  assert.equal(reply.topic, "orders");
  assert.equal(reply.event, "accepted");
  assert.equal(reply.payload.order.userId, TEST_CUSTOMER_ID);
  assert.equal(reply.payload.order.status, "placed");

  // The reply itself must never be the old notifications.raised toast shape - that would mean
  // the dedup fix regressed and the customer would see the order-placed toast twice.
  assert.notEqual(reply.topic, "notifications");

  assert.equal(jsonStore.files.get("orders.json").length, 1);
  assert.equal(notificationInboxEventStream.broadcastNotificationChanged.calls.length > 0, true);

  customerSocket.close();
});

test("orders/requested replies with a notifications/raised error when the cart is empty", async () => {
  const jsonStore = createFakeJsonStore({
    "users.json": [{ id: TEST_CUSTOMER_ID, fullName: "Test Customer", role: "customer" }],
    "orders.json": [],
    "carts.json": [],
    "products.json": [],
  });
  const adminEventStream = { broadcastEvent: createCallRecorder() };
  const cartEventStream = { broadcastCartChanged: createCallRecorder() };
  const stockEventStream = { broadcastStockChanged: createCallRecorder() };
  const notificationInboxEventStream = { broadcastNotificationChanged: createCallRecorder() };

  await registerOrderRequestHandler(
    jsonStore,
    adminEventStream,
    cartEventStream,
    stockEventStream,
    notificationInboxEventStream,
  );

  const customerSocket = await connectTestClient();
  const replyPromise = waitForNextMessage(customerSocket, 2000);

  customerSocket.send(
    JSON.stringify({
      topic: "orders",
      event: "requested",
      payload: { items: [] },
      scope: "distributed",
      origin: "mesh",
      broadcastToPeers: false,
      timestamp: Date.now(),
    }),
  );

  const reply = await replyPromise;

  assert.equal(reply.topic, "notifications");
  assert.equal(reply.event, "raised");
  assert.equal(reply.payload.type, "error");

  customerSocket.close();
});
