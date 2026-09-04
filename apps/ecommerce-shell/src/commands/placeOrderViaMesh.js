/**
 * Places checkout orders for the ecommerce shell through event-mesh request/reply.
 * Role: Publishes order requests over mesh and awaits targeted notification replies.
 * Not in this file: Checkout UI state, cart mutations, or mesh client configuration.
 * Key dependencies: event-mesh/mesh.
 * See also: src/pages/checkoutPage.js.
 */

import mesh from "event-mesh/mesh";

const ORDERS_TOPIC = "orders";
const ORDERS_REQUESTED_EVENT = "requested";
const NOTIFICATION_TOPIC = "notifications";
const NOTIFICATION_RAISED_EVENT = "raised";
const ORDER_REPLY_TIMEOUT_MS = 15000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/** @type {((notification: { type: string, title: string, message: string }) => void) | null} */
let pendingNotificationWaiter = null;
let orderNotificationListenersStarted = false;

function isValidNotificationPayload(notificationPayload) {
  if (!notificationPayload || typeof notificationPayload !== "object") {
    return false;
  }

  return (
    (notificationPayload.type === "success" ||
      notificationPayload.type === "error") &&
    typeof notificationPayload.title === "string" &&
    typeof notificationPayload.message === "string"
  );
}

function resolveNotificationOutcome(notificationPayload) {
  if (!pendingNotificationWaiter) {
    return;
  }

  const resolveWaiter = pendingNotificationWaiter;
  pendingNotificationWaiter = null;
  resolveWaiter(notificationPayload);
}

function handleOrderNotificationRaised(message) {
  const notificationPayload = message.payload;
  if (!isValidNotificationPayload(notificationPayload)) {
    return;
  }

  resolveNotificationOutcome(notificationPayload);
}

/**
 * Registers a one-shot waiter for the next order placement notification reply.
 *
 * @returns {void}
 * @sideEffects Subscribes to mesh notification events used by order replies.
 */
function ensureOrderNotificationListeners() {
  if (orderNotificationListenersStarted) {
    return;
  }

  orderNotificationListenersStarted = true;
  mesh.subscribe(
    NOTIFICATION_TOPIC,
    NOTIFICATION_RAISED_EVENT,
    handleOrderNotificationRaised,
  );
}

function waitForNextOrderNotification() {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      pendingNotificationWaiter = null;
      resolve(null);
    }, ORDER_REPLY_TIMEOUT_MS);

    pendingNotificationWaiter = (notificationPayload) => {
      window.clearTimeout(timeoutId);
      resolve(notificationPayload);
    };
  });
}

/**
 * Places an order through the mesh gateway and waits for the server notification reply.
 *
 * @param {object} orderPayload - Order values accepted by the gateway order handler.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the order.
 * @sideEffects Publishes a distributed mesh order request and listens for a targeted reply.
 */
async function placeOrderViaMesh(orderPayload) {
  try {
    ensureOrderNotificationListeners();
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });

    const notificationPromise = waitForNextOrderNotification();

    mesh.publish({
      topic: ORDERS_TOPIC,
      event: ORDERS_REQUESTED_EVENT,
      payload: orderPayload,
      scope: "distributed",
    });

    const notificationPayload = await notificationPromise;
    if (!notificationPayload) {
      return { ok: false };
    }

    return { ok: notificationPayload.type === "success" };
  } catch (error) {
    console.warn("placeOrderViaMesh - error");
    console.warn(error);
    return { ok: false };
  }
}

export { placeOrderViaMesh };
