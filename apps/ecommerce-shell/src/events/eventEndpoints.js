/**
 * Ecommerce HTTP routes that are not shared with other shells.
 * Role: Maps cart commands, order placement, the orders CSV download, the cart live stream, and the customer order-status stream.
 * Not in this file: Stock, likes, session, and inbox routes (packages/server-events/src/eventEndpoints.js).
 * Key dependencies: @shared/server-events.
 * See also: src/events/eventBus.js.
 */

import {
  bearerHeaders,
  downloadCsvFile,
  exchangeTicket,
  readAcceptedOutcome,
} from "@shared/server-events";

const STOCK_SESSION_RELEASE_HEADER_NAME = "X-Stock-Session-To-Release";

/**
 * @returns {{ requests: object, connections: object }} Shell endpoint maps.
 */
function createEcommerceEndpoints() {
  return {
    requests: {
      "cart:fetch": {
        method: "GET",
        path() {
          return "/cart";
        },
        headers(authToken) {
          return bearerHeaders(authToken);
        },
        rejectWithoutAuth: true,
        missingAuthResult: { ok: false },
        networkResult() {
          return { ok: false };
        },
        async parse(response) {
          if (!response.ok) {
            return { ok: false };
          }
          const cart = await response.json();
          return { ok: true, cart };
        },
      },
      "cart:save": {
        method: "PUT",
        path() {
          return "/cart";
        },
        headers(authToken, payload) {
          const headers = bearerHeaders(authToken, { "Content-Type": "application/json" });
          if (payload.guestStockSessionIdToRelease) {
            headers[STOCK_SESSION_RELEASE_HEADER_NAME] = payload.guestStockSessionIdToRelease;
          }
          return headers;
        },
        body(payload) {
          return payload.cart;
        },
        rejectWithoutAuth: true,
        missingAuthResult: { ok: false },
        networkResult() {
          return { ok: false };
        },
        parse: readAcceptedOutcome,
      },
      "orders:place": {
        method: "POST",
        path() {
          return "/orders";
        },
        headers(authToken) {
          return bearerHeaders(authToken, { "Content-Type": "application/json" });
        },
        body(payload) {
          return payload;
        },
        rejectWithoutAuth: true,
        missingAuthResult: { ok: false },
        networkResult() {
          return { ok: false };
        },
        parse: readAcceptedOutcome,
      },
      "exports:csv": {
        method: "GET",
        path(payload) {
          return csvExportByKind[payload.kind]?.endpointPath || "";
        },
        headers(authToken) {
          return bearerHeaders(authToken, { Accept: "text/csv" });
        },
        rejectWithoutAuth: true,
        missingAuthResult: { ok: false },
        networkResult() {
          return { ok: false };
        },
        fulfill(response, payload) {
          const fileName = csvExportByKind[payload.kind]?.fileName || "export.csv";
          return downloadCsvFile(response, fileName);
        },
      },
    },
    connections: {
      cartLive: {
        id: "cart-live",
        requiresAuth: true,
        frames: [{ sseName: "cart_changed", topic: "cart", event: "live-changed" }],
        buildUrl(input) {
          return exchangeTicket({
            ...input,
            ticketPath: "/cart/connection-tickets",
            streamPath: "/cart/events",
          });
        },
      },
      customerOrders: {
        id: "customer-orders",
        requiresAuth: true,
        frames: [{ sseName: "orders.status-changed", topic: "orders", event: "status-changed" }],
        buildUrl(input) {
          return exchangeTicket({
            ...input,
            ticketPath: "/orders/connection-tickets",
            streamPath: "/orders/stream",
          });
        },
      },
    },
  };
}

const csvExportByKind = {
  orders: { endpointPath: "/exports/orders.csv", fileName: "my-orders.csv" },
};

export { createEcommerceEndpoints };
