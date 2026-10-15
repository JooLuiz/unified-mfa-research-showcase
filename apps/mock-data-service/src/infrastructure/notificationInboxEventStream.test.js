/**
 * Integration tests for the notification inbox watcher registry and targeted push.
 * Role: Proves a client that announces notification-inbox/watching for one (userId, shell)
 *   pair receives broadcastNotificationChanged's push, and that a client watching a different
 *   shell does not. Regression coverage for the persisted-notification-toast investigation:
 *   this hop was suspected of dropping pushes but was confirmed working end to end.
 * Key dependencies: event-mesh/gateway (real library, local test gateway); ws.
 * See also: src/infrastructure/notificationInboxEventStream.js.
 */

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const WebSocket = require("ws");

const { createNotificationInboxEventStream } = require("./notificationInboxEventStream");

const TEST_GATEWAY_PORT = 39872;
const TEST_USER_ID = "u-test-watcher";

/** @type {import("event-mesh/gateway").default} */
let gateway;

function connectTestClient() {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://localhost:${TEST_GATEWAY_PORT}`);
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}

function publishWatching(socket, shell) {
  socket.send(
    JSON.stringify({
      topic: "notification-inbox",
      event: "watching",
      payload: { shell },
      scope: "distributed",
      origin: "mesh",
      broadcastToPeers: false,
      timestamp: Date.now(),
    }),
  );
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

function assertNoMessageArrives(socket, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      socket.off("message", onMessage);
      resolve();
    }, timeoutMs);

    function onMessage(rawData) {
      clearTimeout(timeoutId);
      socket.off("message", onMessage);
      reject(new Error(`assertNoMessageArrives - unexpected message: ${rawData.toString()}`));
    }

    socket.on("message", onMessage);
  });
}

before(async () => {
  const gatewayModule = await import("event-mesh/gateway");
  gateway = gatewayModule.default;
  gatewayModule.configureGateway({
    gatewayPort: TEST_GATEWAY_PORT,
    authenticateConnection: async () => ({ userId: TEST_USER_ID, roles: ["admin"] }),
    authorizeMessage: () => true,
  });
  await gateway.start();
});

after(async () => {
  await gateway.stop();
});

test("broadcastNotificationChanged delivers the row to a client watching that (userId, shell) pair", async () => {
  const notificationInboxEventStream = createNotificationInboxEventStream();
  await notificationInboxEventStream.registerWithGateway();

  const watchingSocket = await connectTestClient();
  publishWatching(watchingSocket, "admin");
  // Give the gateway a tick to process the watching announcement before broadcasting.
  await new Promise((resolve) => setTimeout(resolve, 50));

  const notificationRow = {
    id: "notification-test-1",
    userId: TEST_USER_ID,
    shell: "admin",
    type: "New order",
    title: "New order",
    message: "A new order was placed.",
    link: "/order-details/order-test-1",
    read: false,
    createdAt: new Date().toISOString(),
  };

  const receivedMessagePromise = waitForNextMessage(watchingSocket, 2000);
  notificationInboxEventStream.broadcastNotificationChanged(TEST_USER_ID, "admin", notificationRow);
  const receivedMessage = await receivedMessagePromise;

  assert.equal(receivedMessage.topic, "notification-inbox");
  assert.equal(receivedMessage.event, "changed");
  assert.deepEqual(receivedMessage.payload, notificationRow);

  watchingSocket.close();
});

test("broadcastNotificationChanged does not deliver to a client watching a different shell", async () => {
  const notificationInboxEventStream = createNotificationInboxEventStream();
  await notificationInboxEventStream.registerWithGateway();

  const watchingSocket = await connectTestClient();
  publishWatching(watchingSocket, "ecommerce");
  await new Promise((resolve) => setTimeout(resolve, 50));

  const noMessagePromise = assertNoMessageArrives(watchingSocket, 300);
  notificationInboxEventStream.broadcastNotificationChanged(TEST_USER_ID, "admin", {
    id: "notification-test-2",
    userId: TEST_USER_ID,
    shell: "admin",
  });
  await noMessagePromise;

  watchingSocket.close();
});

test("broadcastNotificationChanged is a no-op when nobody is watching that pair", () => {
  const notificationInboxEventStream = createNotificationInboxEventStream();
  assert.doesNotThrow(() => {
    notificationInboxEventStream.broadcastNotificationChanged(TEST_USER_ID, "admin", {
      id: "notification-test-3",
      userId: TEST_USER_ID,
      shell: "admin",
    });
  });
});
