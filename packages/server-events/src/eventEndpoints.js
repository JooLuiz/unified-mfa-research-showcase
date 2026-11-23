/**
 * Shared command descriptors for the server adapter.
 * Role: Maps topic and event names onto gateway commands, plus the few reads still served over HTTP.
 * Not in this file: Shell-only cart, order, export, and admin live descriptors
 *   (apps star-slash src/events/eventEndpoints.js).
 * Key dependencies: src/readResponse.js.
 * See also: src/createServerEvents.js; src/openEventConnection.js;
 *   apps/mock-data-service/src/inbound/ (the gateway handlers that reply).
 *   On main every descriptor is an HTTP route; this branch publishes gateway commands. A descriptor
 *   with publishTopic is a gateway command; a descriptor with method is an HTTP read.
 */

import {
  readAcceptedOutcome,
  readItemListOutcome,
  readLikeOutcome,
  readOrderStatusOutcome,
  readStockOutcome,
} from "./readResponse.js";

/**
 * @param {string} authToken
 * @param {object} [extraHeaders]
 * @returns {Record<string, string>}
 */
function bearerHeaders(authToken, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }
  return headers;
}

/**
 * @param {string} publishEvent - Gateway event the stock handler listens for.
 * @returns {object} Stock command descriptor.
 */
function createStockCommand(publishEvent) {
  return {
    publishTopic: "stock",
    publishEvent,
    acceptEvent: "accepted",
    rejectEvent: "rejected",
    toGatewayPayload(payload, requestId) {
      return {
        requestId,
        productId: payload.productId,
        quantity: payload.quantity,
        sessionId: payload.sessionId || "",
      };
    },
    toOutcome: readStockOutcome,
  };
}

/**
 * Builds the shared request and connection maps.
 *
 * @returns {{ requests: object, connections: object }}
 */
function createSharedEndpoints() {
  const requests = {
    "stock:reserve": createStockCommand("reserve"),
    "stock:set": createStockCommand("release"),
    "orders:status-change": {
      publishTopic: "orders",
      publishEvent: "status-change-requested",
      acceptEvent: "status-accepted",
      rejectEvent: "status-rejected",
      toGatewayPayload(payload, requestId) {
        return {
          requestId,
          orderId: payload.orderId,
          nextStatus: payload.status,
          actor: payload.actor,
        };
      },
      toOutcome: readOrderStatusOutcome,
    },
    "community-likes:toggle": {
      publishTopic: "community-likes",
      publishEvent: "toggle",
      acceptEvent: "accepted",
      rejectEvent: "rejected",
      toGatewayPayload(payload, requestId) {
        return { requestId, postId: payload.postId };
      },
      toOutcome: readLikeOutcome,
    },
    "session:sign-out-everywhere": {
      method: "POST",
      path() {
        return "/auth/sign-out-everywhere";
      },
      headers(authToken) {
        return bearerHeaders(authToken);
      },
      rejectWithoutAuth: true,
      missingAuthResult: { ok: false, status: 401 },
      async parse(response) {
        return { ok: response.ok, status: response.status };
      },
    },
    "notification-inbox:fetch": {
      method: "GET",
      path(payload) {
        return `/notifications?shell=${encodeURIComponent(payload.shell || "")}`;
      },
      headers(authToken) {
        return bearerHeaders(authToken);
      },
      resultWithoutRequest(payload) {
        return payload.shell ? null : { ok: true, items: [] };
      },
      rejectWithoutAuth: true,
      missingAuthResult: { ok: true, items: [] },
      async parse(response) {
        if (!response.ok) {
          return { ok: false, code: "request-failed" };
        }
        const body = await response.json();
        return { ok: true, items: Array.isArray(body.items) ? body.items : [] };
      },
    },
    "notification-inbox:mark-read": {
      publishTopic: "notification-inbox",
      publishEvent: "mark-read",
      acceptEvent: "read-accepted",
      rejectEvent: "read-rejected",
      toGatewayPayload(payload, requestId) {
        return { requestId, notificationId: payload.notificationId };
      },
      toOutcome(payload) {
        return payload.notification
          ? { ok: true, notification: payload.notification }
          : { ok: false, code: payload.code || "request-failed" };
      },
    },
    "notification-inbox:mark-all-read": {
      publishTopic: "notification-inbox",
      publishEvent: "mark-all-read",
      acceptEvent: "read-all-accepted",
      rejectEvent: "read-all-rejected",
      toGatewayPayload(payload, requestId) {
        return { requestId, shell: payload.shell };
      },
      toOutcome: readItemListOutcome,
    },
  };

  return { requests, connections: {} };
}

export { createSharedEndpoints, bearerHeaders, readAcceptedOutcome };
