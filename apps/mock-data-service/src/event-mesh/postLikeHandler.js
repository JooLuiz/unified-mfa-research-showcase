/**
 * Handles authenticated post-like toggles received through the event-mesh gateway.
 * Role: Validates the actor and the author guard, persists the toggle, replies to the sender,
 *   and broadcasts the new count to every client watching that post and to admin clients.
 * Not in this file: Toggle/count rules (src/domain/postLikes.js) or the per-post watcher
 *   registry (src/infrastructure/postLikeEventStream.js).
 * Key dependencies: JSON store; src/domain/postLikes.js; src/infrastructure/postLikeEventStream.js;
 *   src/infrastructure/adminEventStream.js.
 * See also: src/server.js; src/event-mesh/cartUpsertHandler.js (same reply/broadcast shape).
 */

const { LIKE_NOT_ALLOWED_CODE, toggleLike } = require("../domain/postLikes");
const { recordPostLikedNotification } = require("../domain/notificationTriggers");

const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_TOGGLE_EVENT = "toggle";
const COMMUNITY_LIKES_ACCEPTED_EVENT = "accepted";
const COMMUNITY_LIKES_REJECTED_EVENT = "rejected";
const OWN_POST_REJECTED_CODE = "own-post";
const INVALID_REQUEST_REJECTED_CODE = "invalid-request";
const POST_NOT_FOUND_REJECTED_CODE = "post-not-found";
const ADMIN_POST_LIKES_CHANGED_EVENT_TYPE = "post_likes_changed";

/**
 * Registers the gateway subscriber that processes community-likes/toggle messages.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> }} jsonStore - JSON file store bound to the data directory.
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

  gateway.subscribe(COMMUNITY_LIKES_TOPIC, COMMUNITY_LIKES_TOGGLE_EVENT, async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;
    const postId = incomingMessage.payload?.postId;

    if (!userId || !postId) {
      gateway.reply(incomingMessage, {
        topic: COMMUNITY_LIKES_TOPIC,
        event: COMMUNITY_LIKES_REJECTED_EVENT,
        payload: { requestId, code: INVALID_REQUEST_REJECTED_CODE },
      });
      return;
    }

    const usersData = await jsonStore.readJsonFile("users.json");
    const likerUser = usersData.find((userRecord) => userRecord.id === userId);

    const postsData = await jsonStore.readJsonFile("posts.json");
    const matchingPost = postsData.find((postRecord) => postRecord.id === postId);

    if (!likerUser || !matchingPost) {
      gateway.reply(incomingMessage, {
        topic: COMMUNITY_LIKES_TOPIC,
        event: COMMUNITY_LIKES_REJECTED_EVENT,
        payload: { requestId, code: POST_NOT_FOUND_REJECTED_CODE },
      });
      return;
    }

    const toggleResult = await toggleLike({
      jsonStore,
      postId: matchingPost.id,
      userId: likerUser.id,
      authorId: matchingPost.authorId,
    });

    if (!toggleResult.ok) {
      const rejectedCode =
        toggleResult.code === LIKE_NOT_ALLOWED_CODE ? OWN_POST_REJECTED_CODE : toggleResult.code;
      gateway.reply(incomingMessage, {
        topic: COMMUNITY_LIKES_TOPIC,
        event: COMMUNITY_LIKES_REJECTED_EVENT,
        payload: { requestId, code: rejectedCode },
      });
      return;
    }

    gateway.reply(incomingMessage, {
      topic: COMMUNITY_LIKES_TOPIC,
      event: COMMUNITY_LIKES_ACCEPTED_EVENT,
      payload: { requestId, liked: toggleResult.liked, likes: toggleResult.likes },
    });

    const likeChangedPayload = {
      postId: matchingPost.id,
      likes: toggleResult.likes,
      ownerId: matchingPost.authorId,
      likerId: likerUser.id,
      likerName: likerUser.fullName || likerUser.username,
      liked: toggleResult.liked,
    };
    postLikeEventStream.broadcastLikesChanged(matchingPost.id, likeChangedPayload);
    adminEventStream.broadcastEvent(ADMIN_POST_LIKES_CHANGED_EVENT_TYPE, likeChangedPayload);
    if (toggleResult.liked) {
      await recordPostLikedNotification({
        jsonStore,
        notificationInboxEventStream,
        post: matchingPost,
        likerName: likerUser.fullName || likerUser.username,
      });
    }
  });
}

module.exports = { registerPostLikeHandler };
