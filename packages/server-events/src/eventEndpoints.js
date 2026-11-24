/**
 * Shared command and stream descriptors for the HTTP adapter.
 * Role: Maps topic and event names onto the mock API paths the packages used to call directly.
 * Not in this file: Shell-only cart, export, and admin live routes (apps star-slash src/events/eventEndpoints.js).
 * Key dependencies: src/readResponse.js.
 * See also: src/createServerEvents.js; src/openEventConnection.js.
 */

import {
  readAcceptedOutcome,
  readItemListOutcome,
  readJsonOutcome,
  readLikeOutcome,
  readOrderStatusOutcome,
  readStockOutcome,
} from "./readResponse.js";

const STOCK_SESSION_HEADER_NAME = "X-Stock-Session";

/**
 * Exchanges a bearer token for a one-time stream URL.
 *
 * @param {{ apiBaseUrl: string, authToken: string, ticketPath: string, streamPath: string }} ticketInput
 * @returns {Promise<string>} EventSource URL including the ticket query.
 * @sideEffects POSTs the ticket path.
 */
async function exchangeTicket({ apiBaseUrl, authToken, ticketPath, streamPath }) {
  const ticketResponse = await fetch(`${apiBaseUrl}${ticketPath}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!ticketResponse.ok) {
    throw new Error(`exchangeTicket - request failed: ${ticketResponse.status}`);
  }
  const ticketBody = await ticketResponse.json();
  return `${apiBaseUrl}${streamPath}?ticket=${encodeURIComponent(ticketBody.ticket)}`;
}

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
 * Builds the shared request, publish, and connection maps.
 *
 * @param {{ getStockSessionId: () => string, inboxShell: { current: string } }} endpointInput
 * @returns {{ requests: object, publishes: object, connections: object }}
 */
function createSharedEndpoints({ getStockSessionId, inboxShell }) {
  const requests = {
    "stock:reserve": {
      method: "POST",
      path() {
        return "/stock/reservations";
      },
      headers(authToken, payload) {
        return stockHeaders(authToken, payload);
      },
      body(payload) {
        return { productId: payload.productId, quantity: payload.quantity };
      },
      parse: readStockOutcome,
    },
    "stock:set": {
      method: "PUT",
      path() {
        return "/stock/reservations";
      },
      headers(authToken, payload) {
        return stockHeaders(authToken, payload);
      },
      body(payload) {
        return { productId: payload.productId, quantity: payload.quantity };
      },
      parse: readStockOutcome,
    },
    "orders:status-change": {
      method: "PUT",
      path(payload) {
        return `/orders/${encodeURIComponent(payload.orderId)}/status`;
      },
      headers(authToken) {
        return bearerHeaders(authToken, { "Content-Type": "application/json" });
      },
      body(payload) {
        return { status: payload.status, actor: payload.actor };
      },
      parse: readOrderStatusOutcome,
    },
    "account:update": {
      method: "PUT",
      path() {
        return "/users/me";
      },
      headers(authToken) {
        return bearerHeaders(authToken, { "Content-Type": "application/json" });
      },
      body(payload) {
        return payload.update;
      },
      rejectWithoutAuth: true,
      missingAuthResult: { ok: false },
      networkResult() {
        return { ok: false };
      },
      parse(response) {
        return readJsonOutcome(response, "user");
      },
    },
    "community-likes:toggle": {
      method: "POST",
      path(payload) {
        return `/posts/${encodeURIComponent(payload.postId)}/like`;
      },
      headers(authToken) {
        return bearerHeaders(authToken);
      },
      parse: readLikeOutcome,
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
      remember(payload) {
        inboxShell.current = payload.shell || "";
      },
      rejectWithoutAuth: true,
      missingAuthResult: { ok: true, items: [] },
      parse: readItemListOutcome,
    },
    "notification-inbox:mark-read": {
      method: "PUT",
      path(payload) {
        return `/notifications/${encodeURIComponent(payload.notificationId)}/read`;
      },
      headers(authToken) {
        return bearerHeaders(authToken);
      },
      async parse(response) {
        if (!response.ok) {
          return { ok: false, code: "request-failed" };
        }
        const notification = await response.json();
        return { ok: true, notification };
      },
    },
    "notification-inbox:mark-all-read": {
      method: "PUT",
      path(payload) {
        return `/notifications/read-all?shell=${encodeURIComponent(payload.shell || "")}`;
      },
      headers(authToken) {
        return bearerHeaders(authToken);
      },
      parse: readItemListOutcome,
    },
  };

  const publishes = {
    "stock:watching": {
      method: "PUT",
      path() {
        return "/stock/watching";
      },
      headers() {
        return { "Content-Type": "application/json" };
      },
      body(payload) {
        return { streamId: payload.streamId, productIds: payload.productIds };
      },
    },
  };

  const connections = {
    stock: {
      id: "stock",
      frames: [
        { sseName: "stock_changed", topic: "stock", event: "changed" },
        { sseName: "stock_stream_ready", topic: "stock", event: "ready" },
      ],
      buildUrl({ apiBaseUrl, stockSessionId }) {
        const sessionId = stockSessionId || getStockSessionId();
        return Promise.resolve(
          `${apiBaseUrl}/stock/stream?sessionId=${encodeURIComponent(sessionId)}`,
        );
      },
    },
    posts: {
      id: "posts",
      frames: [
        {
          sseName: "community.post-likes-changed",
          topic: "community-likes",
          event: "changed",
        },
        { sseName: "community.post-created", topic: "community-posts", event: "created" },
      ],
      buildUrl({ apiBaseUrl }) {
        return Promise.resolve(`${apiBaseUrl}/posts/stream`);
      },
    },
    session: {
      id: "session",
      requiresAuth: true,
      frames: [{ sseName: "session.revoked", topic: "session", event: "revoked" }],
      buildUrl({ apiBaseUrl, authToken }) {
        return Promise.resolve(
          `${apiBaseUrl}/auth/session-stream?token=${encodeURIComponent(authToken)}`,
        );
      },
    },
    notificationInbox: {
      id: "notification-inbox",
      requiresAuth: true,
      vary() {
        return inboxShell.current;
      },
      frames: [
        {
          sseName: "notification-inbox.changed",
          topic: "notification-inbox",
          event: "changed",
        },
      ],
      buildUrl({ apiBaseUrl, authToken, vary }) {
        return Promise.resolve(
          `${apiBaseUrl}/notifications/stream?shell=${encodeURIComponent(vary)}&token=${encodeURIComponent(authToken)}`,
        );
      },
    },
  };

  return { requests, publishes, connections };
}

/**
 * @param {string} authToken
 * @param {{ sessionId?: string }} payload
 * @returns {Record<string, string>}
 */
function stockHeaders(authToken, payload) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  } else if (payload.sessionId) {
    headers[STOCK_SESSION_HEADER_NAME] = payload.sessionId;
  }
  return headers;
}

export {
  createSharedEndpoints,
  exchangeTicket,
  bearerHeaders,
  readAcceptedOutcome,
  readJsonOutcome,
};
