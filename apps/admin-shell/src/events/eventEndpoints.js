/**
 * Admin shell subscriptions that are not shared with other shells.
 * Role: Maps the admin live contracts onto the gateway's admin topic.
 * Not in this file: Order status commands (packages/server-events/src/eventEndpoints.js).
 * Key dependencies: None.
 * See also: src/events/eventBus.js; src/events/adminLiveEvents.js.
 *   On main these are SSE frames on /admin/events; this branch subscribes to gateway events.
 */

/**
 * @returns {{ connections: object }} Shell connection map.
 */
function createAdminEndpoints() {
  return {
    connections: {
      adminLive: {
        id: "admin-live",
        frames: [
          { topic: "admin-live", event: "order-created", gatewayTopic: "admin", gatewayEvent: "order_created" },
          { topic: "admin-live", event: "post-created", gatewayTopic: "admin", gatewayEvent: "post_created" },
          {
            topic: "admin-live",
            event: "likes-changed",
            gatewayTopic: "admin",
            gatewayEvent: "post_likes_changed",
          },
        ],
      },
    },
  };
}

export { createAdminEndpoints };
