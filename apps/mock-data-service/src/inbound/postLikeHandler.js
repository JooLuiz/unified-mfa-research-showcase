/**
 * Handles authenticated post-like toggles received through the event-mesh gateway.
 * Role: Adapts community-likes/toggle messages to the togglePostLike use case, replies accepted
 *   or rejected, and fans the likes broadcast out to post watchers and admin clients.
 * Not in this file: Toggle steps (src/domain/togglePostLike.js) or the per-post watcher
 *   registry (src/infrastructure/postLikeEvents.js).
 * Key dependencies: src/domain/togglePostLike.js; src/domain/useCaseCodes.js; event-mesh/gateway.
 * See also: src/server.js; src/inbound/cartUpsertHandler.js (same reply shape).
 *   On main the same use case is called from src/routes/postLikeRoutes.js.
 */

const { LIKE_NOT_ALLOWED_CODE } = require("../domain/postLikes");
const { togglePostLike } = require("../domain/togglePostLike");
const {
  INVALID_REQUEST_CODE,
  POST_NOT_FOUND_CODE,
  USER_NOT_FOUND_CODE,
} = require("../domain/useCaseCodes");

const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_TOGGLE_EVENT = "toggle";
const COMMUNITY_LIKES_ACCEPTED_EVENT = "accepted";
const COMMUNITY_LIKES_REJECTED_EVENT = "rejected";
const OWN_POST_REJECTED_CODE = "own-post";
const ADMIN_POST_LIKES_CHANGED_EVENT_TYPE = "post_likes_changed";

// Reply codes the social shell already handles.
const REJECTED_REPLY_CODES = Object.freeze({
  [USER_NOT_FOUND_CODE]: POST_NOT_FOUND_CODE,
  [LIKE_NOT_ALLOWED_CODE]: OWN_POST_REJECTED_CODE,
});

/**
 * Registers the gateway subscriber that processes community-likes/toggle messages.
 *
 * @param {object} jsonStore - JSON file store bound to the data directory.
 * @param {{ broadcastLikesChanged: (postId: string, payload: object) => void }} postLikeEventStream - Per-post watcher registry and publisher.
 * @param {{ broadcastEvent: (eventType: string, payload: object) => void }} adminEventStream - Notifies every connected admin client.
 * @param {{ broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void }} notificationInboxEventStream - Publisher for durable inbox rows.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to the toggle event on the local gateway singleton.
 */
async function registerPostLikeHandler(
  jsonStore,
  postLikeEventStream,
  adminEventStream,
  notificationInboxEventStream,
) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  // Fans the use case's likes broadcast out to that post's watchers and every admin client.
  const likesBroadcaster = {
    broadcastLikesChanged(postId, likeChangedPayload) {
      postLikeEventStream.broadcastLikesChanged(postId, likeChangedPayload);
      adminEventStream.broadcastEvent(ADMIN_POST_LIKES_CHANGED_EVENT_TYPE, likeChangedPayload);
    },
  };

  gateway.subscribe(COMMUNITY_LIKES_TOPIC, COMMUNITY_LIKES_TOGGLE_EVENT, async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;
    const postId = incomingMessage.payload?.postId;

    const toggleResult = userId && postId
      ? await togglePostLike({
          jsonStore,
          userId,
          payload: { postId },
          streams: {
            postLikes: likesBroadcaster,
            notificationInbox: notificationInboxEventStream,
          },
        })
      : { ok: false, code: INVALID_REQUEST_CODE };

    if (!toggleResult.ok) {
      gateway.reply(incomingMessage, {
        topic: COMMUNITY_LIKES_TOPIC,
        event: COMMUNITY_LIKES_REJECTED_EVENT,
        payload: { requestId, code: REJECTED_REPLY_CODES[toggleResult.code] || toggleResult.code },
      });
      return;
    }

    gateway.reply(incomingMessage, {
      topic: COMMUNITY_LIKES_TOPIC,
      event: COMMUNITY_LIKES_ACCEPTED_EVENT,
      payload: { requestId, ...toggleResult.result },
    });
  });
}

module.exports = { registerPostLikeHandler };
