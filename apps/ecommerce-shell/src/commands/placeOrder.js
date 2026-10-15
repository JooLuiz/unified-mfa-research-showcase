/**
 * Places checkout orders for the ecommerce shell through event-mesh request/reply.
 * Role: Publishes order requests over mesh and awaits a targeted accept/error reply.
 * Not in this file: Checkout UI state, cart mutations, or mesh client configuration.
 *   The "Order placed" toast itself comes from the persisted notification inbox
 *   (@shared/notification-inbox-events, wired in src/main.js), not from this reply.
 * Key dependencies: event-mesh/mesh.
 * See also: src/pages/checkoutPage.js; apps/mock-data-service/src/event-mesh/orderRequestHandler.js.
 */

import mesh from "event-mesh/mesh";

const ORDERS_TOPIC = "orders";
const ORDERS_REQUESTED_EVENT = "requested";
const ORDERS_ACCEPTED_EVENT = "accepted";
const NOTIFICATION_TOPIC = "notifications";
const NOTIFICATION_RAISED_EVENT = "raised";
const ORDER_REPLY_TIMEOUT_MS = 15000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/** @type {((outcome: { ok: boolean }) => void) | null} */
let pendingOrderOutcomeWaiter = null;
let orderReplyListenersStarted = false;

function isErrorNotificationPayload(notificationPayload) {
  return (
    notificationPayload &&
    typeof notificationPayload === "object" &&
    notificationPayload.type === "error" &&
    typeof notificationPayload.title === "string" &&
    typeof notificationPayload.message === "string"
  );
}

function resolvePendingOrderOutcome(outcome) {
  if (!pendingOrderOutcomeWaiter) {
    return;
  }

  const resolveWaiter = pendingOrderOutcomeWaiter;
  pendingOrderOutcomeWaiter = null;
  resolveWaiter(outcome);
}

/**
 * Resolves the in-flight order as accepted. The server sends this reply only on success;
 * the "Order placed" toast is a separate, persisted notification-inbox push, not this reply.
 */
function handleOrderAccepted() {
  resolvePendingOrderOutcome({ ok: true });
}

/**
 * Resolves the in-flight order as rejected when the server replies with an error toast
 * (e.g. an emptied cart). This channel is shared with every other toast in the shell, but
 * only one order request is ever in flight per tab, so no further correlation is needed.
 */
function handleOrderErrorNotificationRaised(message) {
  if (!isErrorNotificationPayload(message.payload)) {
    return;
  }
  resolvePendingOrderOutcome({ ok: false });
}

/**
 * Registers the one-shot reply listeners for order placement outcomes.
 *
 * @returns {void}
 * @sideEffects Subscribes to mesh events used by order replies.
 */
function ensureOrderReplyListeners() {
  if (orderReplyListenersStarted) {
    return;
  }

  orderReplyListenersStarted = true;
  mesh.subscribe(ORDERS_TOPIC, ORDERS_ACCEPTED_EVENT, handleOrderAccepted);
  mesh.subscribe(
    NOTIFICATION_TOPIC,
    NOTIFICATION_RAISED_EVENT,
    handleOrderErrorNotificationRaised,
  );
}

function waitForOrderOutcome() {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      pendingOrderOutcomeWaiter = null;
      resolve({ ok: false });
    }, ORDER_REPLY_TIMEOUT_MS);

    pendingOrderOutcomeWaiter = (outcome) => {
      window.clearTimeout(timeoutId);
      resolve(outcome);
    };
  });
}

/**
 * Places an order through the mesh gateway and waits for the server's accept/error reply.
 *
 * @param {object} appStateOrOrderPayload - Shell app state or order values.
 * @param {object} [orderPayload] - Order values accepted by the gateway order handler.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the order.
 * @sideEffects Publishes a distributed mesh order request and listens for a targeted reply.
 */
async function placeOrder(appStateOrOrderPayload, orderPayload) {
  const payload = orderPayload || (appStateOrOrderPayload && !appStateOrOrderPayload.currentUser && !appStateOrOrderPayload.authToken ? appStateOrOrderPayload : {});
  try {
    ensureOrderReplyListeners();
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });

    const outcomePromise = waitForOrderOutcome();

    mesh.publish({
      topic: ORDERS_TOPIC,
      event: ORDERS_REQUESTED_EVENT,
      payload,
      scope: "distributed",
    });

    return await outcomePromise;
  } catch (error) {
    console.warn("placeOrder - error");
    console.warn(error);
    return { ok: false };
  }
}

const placeOrderViaMesh = placeOrder;

export { placeOrder, placeOrderViaMesh };
