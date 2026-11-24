/**
 * Admin HTTP routes that are not shared with other shells.
 * Role: Maps the admin live stream and the admin order-status stream, and builds the admin
 *   order read path the order-details remote calls.
 * Not in this file: The status write, which uses the shared orders/status-change command.
 * Key dependencies: @shared/server-events.
 * See also: src/events/eventBus.js; src/events/adminLiveEvents.js.
 */

import { exchangeTicket } from "@shared/server-events";

/**
 * @returns {{ connections: object }} Shell connection map.
 */
function createAdminEndpoints() {
  return {
    connections: {
      adminLive: {
        id: "admin-live",
        requiresAuth: true,
        frames: [
          { sseName: "order_created", topic: "admin-live", event: "order-created" },
          { sseName: "post_created", topic: "admin-live", event: "post-created" },
          {
            sseName: "community.post-likes-changed",
            topic: "admin-live",
            event: "likes-changed",
          },
        ],
        buildUrl(input) {
          return exchangeTicket({
            ...input,
            ticketPath: "/admin/connection-tickets",
            streamPath: "/admin/events",
          });
        },
      },
      adminOrders: {
        id: "admin-orders",
        requiresAuth: true,
        frames: [{ sseName: "orders.status-changed", topic: "orders", event: "status-changed" }],
        buildUrl(input) {
          return exchangeTicket({
            ...input,
            ticketPath: "/admin/orders/connection-tickets",
            streamPath: "/admin/orders/stream",
          });
        },
      },
    },
  };
}

/**
 * Builds the admin read path for one order.
 *
 * @param {string} orderId - Order to read.
 * @returns {string} Path under the mock API base url.
 */
function buildAdminOrderPath(orderId) {
  return `/admin/orders/${encodeURIComponent(orderId)}`;
}

export { buildAdminOrderPath, createAdminEndpoints };
