/**
 * Ecommerce commands that are not shared with other shells.
 * Role: Maps cart commands, order placement, the orders CSV export, and the cart live alias.
 * Not in this file: Stock, likes, session, and inbox commands (packages/server-events/src/eventEndpoints.js).
 * Key dependencies: @shared/server-events.
 * See also: src/events/eventBus.js; apps/mock-data-service/src/inbound/.
 *   On main these are HTTP routes and SSE streams; this branch publishes gateway commands.
 */

import { bearerHeaders, downloadCsvFile, readAcceptedOutcome } from "@shared/server-events";

const ORDERS_EXPORT_FILE_NAME = "my-orders.csv";

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
        publishTopic: "cart-sync",
        publishEvent: "upsert",
        acceptEvent: "changed",
        rejectEvent: "upsert-rejected",
        timeoutResult: { ok: false },
        networkResult() {
          return { ok: false };
        },
        beforePublish: { topic: "cart-sync", event: "watching", payload: {}, scope: "distributed" },
        toGatewayPayload(payload, requestId) {
          return {
            requestId,
            items: payload.cart?.items || [],
            appliedCoupon: payload.cart?.appliedCoupon ?? null,
            ...(payload.guestStockSessionIdToRelease
              ? { guestStockSessionIdToRelease: payload.guestStockSessionIdToRelease }
              : {}),
          };
        },
        toOutcome: readAcceptedOutcome,
      },
      "orders:place": {
        publishTopic: "orders",
        publishEvent: "requested",
        acceptEvent: "accepted",
        matchRequestId: false,
        toGatewayPayload(payload) {
          return payload;
        },
        toOutcome(payload) {
          return { ok: true, order: payload.order };
        },
      },
      "exports:csv": createExportCommand(ORDERS_EXPORT_FILE_NAME),
    },
    connections: {
      cartLive: {
        id: "cart-live",
        frames: [{ topic: "cart", event: "live-changed", gatewayTopic: "cart-sync", gatewayEvent: "changed" }],
      },
    },
  };
}

/**
 * Builds the CSV export command: request the job, then download the finished file.
 *
 * @param {string} fileName - Download name shown by the browser.
 * @returns {object} Gateway command descriptor.
 */
function createExportCommand(fileName) {
  return {
    publishTopic: "exports",
    publishEvent: "requested",
    acceptEvent: "completed",
    rejectEvent: "failed",
    toGatewayPayload(payload, requestId) {
      return { requestId, kind: payload.kind };
    },
    toOutcome(payload) {
      return payload.code ? { ok: false, code: payload.code } : { ok: true, jobId: payload.jobId };
    },
    async afterAccept(outcome, payload, { apiBaseUrl, authToken }) {
      if (!outcome.jobId || typeof document === "undefined") {
        return;
      }
      const response = await fetch(`${apiBaseUrl}/exports/${encodeURIComponent(outcome.jobId)}/download`, {
        headers: bearerHeaders(authToken),
      });
      await downloadCsvFile(response, fileName);
    },
  };
}

export { createEcommerceEndpoints };
