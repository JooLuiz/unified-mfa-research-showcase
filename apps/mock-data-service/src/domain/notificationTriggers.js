/**
 * Orchestrates creating notification inbox rows and pushing them over the live stream.
 * Role: Provides high-level trigger functions executed by domain mutation endpoints.
 * Not in this file: HTTP routing or low-level SSE formatting.
 * Key dependencies: src/domain/notificationInbox.js.
 * See also: src/routes/orderRoutes.js, src/routes/orderStatusRoutes.js, src/routes/postRoutes.js, src/routes/postLikeRoutes.js.
 */

const {
  buildNotificationRow,
  getAdminUserIds,
} = require("./notificationInbox");

const NOTIFICATION_INBOX_FILE_NAME = "notificationInbox.json";

/**
 * Persists an array of new notification rows and broadcasts each to its targeted (userId, shell) stream.
 *
 * @param {{
 *   jsonStore: { readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> },
 *   notificationInboxEventStream: { broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void },
 *   rowsToAppend: Array<object>
 * }} context - Persistence and streaming tools plus rows to append.
 * @returns {Promise<void>}
 */
async function appendAndBroadcastNotifications({
  jsonStore,
  notificationInboxEventStream,
  rowsToAppend,
}) {
  if (!Array.isArray(rowsToAppend) || rowsToAppend.length === 0) {
    return;
  }

  const existingRows = await jsonStore.readJsonFileWithDefault(
    NOTIFICATION_INBOX_FILE_NAME,
    [],
  );
  const updatedRows = [...existingRows, ...rowsToAppend];
  await jsonStore.writeJsonFile(NOTIFICATION_INBOX_FILE_NAME, updatedRows);

  rowsToAppend.forEach((row) => {
    notificationInboxEventStream.broadcastNotificationChanged(
      row.userId,
      row.shell,
      row,
    );
  });
}

/**
 * Records inbox notifications when an order is placed:
 * - 1 row for customer on "ecommerce"
 * - 1 row per admin on "admin"
 *
 * @param {{
 *   jsonStore: any,
 *   notificationInboxEventStream: any,
 *   order: { id: string, total?: number },
 *   user: { id: string, fullName?: string, username?: string }
 * }} input
 */
async function recordOrderPlacedNotifications({
  jsonStore,
  notificationInboxEventStream,
  order,
  user,
}) {
  const usersData = await jsonStore.readJsonFileWithDefault("users.json", []);
  const adminIds = getAdminUserIds(usersData);
  const orderLink = `/order-details/${order.id}`;

  const customerRow = buildNotificationRow({
    userId: user.id,
    shell: "ecommerce",
    type: "Order placed",
    title: "Order placed",
    message: `Your order #${order.id} has been placed successfully.`,
    link: orderLink,
  });

  const adminRows = adminIds.map((adminId) =>
    buildNotificationRow({
      userId: adminId,
      shell: "admin",
      type: "New order",
      title: "New order",
      message: `A new order #${order.id} was placed by ${user.fullName || user.username || "a customer"}.`,
      link: orderLink,
    }),
  );

  await appendAndBroadcastNotifications({
    jsonStore,
    notificationInboxEventStream,
    rowsToAppend: [customerRow, ...adminRows],
  });
}

/**
 * Records inbox notifications when an order status changes:
 * - If actor is admin: 1 row for customer on "ecommerce"
 * - If actor is customer requesting cancellation: 1 row per admin on "admin"
 *
 * @param {{
 *   jsonStore: any,
 *   notificationInboxEventStream: any,
 *   order: { id: string, userId: string, status: string },
 *   actor: "admin" | "customer"
 * }} input
 */
async function recordOrderStatusChangedNotifications({
  jsonStore,
  notificationInboxEventStream,
  order,
  actor,
}) {
  const orderLink = `/order-details/${order.id}`;

  if (actor === "admin") {
    const customerRow = buildNotificationRow({
      userId: order.userId,
      shell: "ecommerce",
      type: "Order status changed",
      title: "Order status updated",
      message: `Your order #${order.id} is now ${order.status}.`,
      link: orderLink,
    });
    await appendAndBroadcastNotifications({
      jsonStore,
      notificationInboxEventStream,
      rowsToAppend: [customerRow],
    });
    return;
  }

  if (actor === "customer" && order.status === "cancellation-requested") {
    const usersData = await jsonStore.readJsonFileWithDefault("users.json", []);
    const adminIds = getAdminUserIds(usersData);
    const adminRows = adminIds.map((adminId) =>
      buildNotificationRow({
        userId: adminId,
        shell: "admin",
        type: "Cancellation requested",
        title: "Cancellation requested",
        message: `Customer requested cancellation for order #${order.id}.`,
        link: orderLink,
      }),
    );
    await appendAndBroadcastNotifications({
      jsonStore,
      notificationInboxEventStream,
      rowsToAppend: adminRows,
    });
  }
}

/**
 * Records inbox notification when a post is liked:
 * - 1 row for post author on "social", linking to /posts/:postId
 *
 * @param {{
 *   jsonStore: any,
 *   notificationInboxEventStream: any,
 *   post: { id: string, authorId: string },
 *   likerName: string
 * }} input
 */
async function recordPostLikedNotification({
  jsonStore,
  notificationInboxEventStream,
  post,
  likerName,
}) {
  const authorRow = buildNotificationRow({
    userId: post.authorId,
    shell: "social",
    type: "Post liked",
    title: "Post liked",
    message: `${likerName || "Someone"} liked your post.`,
    link: `/posts/${post.id}`,
  });

  await appendAndBroadcastNotifications({
    jsonStore,
    notificationInboxEventStream,
    rowsToAppend: [authorRow],
  });
}

/**
 * Records inbox notifications when a new post is created:
 * - 1 row per admin on "admin", linking to /posts/:postId
 *
 * @param {{
 *   jsonStore: any,
 *   notificationInboxEventStream: any,
 *   post: { id: string, author?: { fullName?: string, username?: string } }
 * }} input
 */
async function recordPostCreatedNotifications({
  jsonStore,
  notificationInboxEventStream,
  post,
}) {
  const usersData = await jsonStore.readJsonFileWithDefault("users.json", []);
  const adminIds = getAdminUserIds(usersData);
  const postAuthorName =
    post.author?.fullName || post.author?.username || "A user";

  const adminRows = adminIds.map((adminId) =>
    buildNotificationRow({
      userId: adminId,
      shell: "admin",
      type: "New post",
      title: "New post",
      message: `${postAuthorName} published a new post.`,
      link: `/posts/${post.id}`,
    }),
  );

  await appendAndBroadcastNotifications({
    jsonStore,
    notificationInboxEventStream,
    rowsToAppend: adminRows,
  });
}

module.exports = {
  recordOrderPlacedNotifications,
  recordOrderStatusChangedNotifications,
  recordPostLikedNotification,
  recordPostCreatedNotifications,
};
