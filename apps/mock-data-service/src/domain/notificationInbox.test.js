/**
 * Unit tests for notification inbox domain logic.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  buildNotificationRow,
  getAdminUserIds,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  NOTIFICATION_NOT_FOUND_CODE,
  NOTIFICATION_FORBIDDEN_CODE,
} = require("./notificationInbox");

test("buildNotificationRow constructs an unread row with timestamp and identifier", () => {
  const row = buildNotificationRow({
    userId: "user-1",
    shell: "ecommerce",
    type: "Order placed",
    title: "Order confirmed",
    message: "Order #123 placed successfully",
    link: "/order-details/123",
  });

  assert.equal(row.userId, "user-1");
  assert.equal(row.shell, "ecommerce");
  assert.equal(row.type, "Order placed");
  assert.equal(row.read, false);
  assert.ok(row.id.startsWith("notification-"));
  assert.ok(typeof row.createdAt === "string");
});

test("getAdminUserIds filters users with admin role", () => {
  const users = [
    { id: "u-1", role: "customer" },
    { id: "u-2", role: "admin" },
    { id: "u-3", role: "admin" },
    { id: "u-4" },
  ];
  const adminIds = getAdminUserIds(users);
  assert.deepEqual(adminIds, ["u-2", "u-3"]);
});

test("listNotificationsForUser filters by user and shell, sorting newest first", () => {
  const notifications = [
    {
      id: "n-1",
      userId: "u-1",
      shell: "ecommerce",
      createdAt: "2026-10-14T10:00:00.000Z",
    },
    {
      id: "n-2",
      userId: "u-1",
      shell: "social",
      createdAt: "2026-10-14T11:00:00.000Z",
    },
    {
      id: "n-3",
      userId: "u-1",
      shell: "ecommerce",
      createdAt: "2026-10-14T12:00:00.000Z",
    },
    {
      id: "n-4",
      userId: "u-2",
      shell: "ecommerce",
      createdAt: "2026-10-14T13:00:00.000Z",
    },
  ];

  const result = listNotificationsForUser(notifications, "u-1", "ecommerce");
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "n-3");
  assert.equal(result[1].id, "n-1");
});

test("markNotificationRead returns updated array and row when user matches", () => {
  const notifications = [
    { id: "n-1", userId: "u-1", read: false },
    { id: "n-2", userId: "u-2", read: false },
  ];

  const outcome = markNotificationRead(notifications, "n-1", "u-1");
  assert.equal(outcome.ok, true);
  assert.equal(outcome.notification.read, true);
  assert.equal(outcome.notifications[0].read, true);
  assert.equal(outcome.notifications[1].read, false);
});

test("markNotificationRead rejects unknown ID and wrong user", () => {
  const notifications = [{ id: "n-1", userId: "u-1", read: false }];

  const notFound = markNotificationRead(notifications, "n-unknown", "u-1");
  assert.equal(notFound.ok, false);
  assert.equal(notFound.code, NOTIFICATION_NOT_FOUND_CODE);

  const forbidden = markNotificationRead(notifications, "n-1", "u-other");
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.code, NOTIFICATION_FORBIDDEN_CODE);
});

test("markAllNotificationsRead marks only unread rows for that user and shell", () => {
  const notifications = [
    { id: "n-1", userId: "u-1", shell: "social", read: false },
    { id: "n-2", userId: "u-1", shell: "social", read: true },
    { id: "n-3", userId: "u-1", shell: "admin", read: false },
    { id: "n-4", userId: "u-2", shell: "social", read: false },
  ];

  const outcome = markAllNotificationsRead(notifications, "u-1", "social");
  assert.deepEqual(
    outcome.changedNotifications.map((row) => row.id),
    ["n-1"],
  );
  assert.equal(outcome.notifications[0].read, true);
  assert.equal(outcome.notifications[1].read, true);
  assert.equal(outcome.notifications[2].read, false);
  assert.equal(outcome.notifications[3].read, false);
});

test("markAllNotificationsRead returns empty lists when the inbox is missing", () => {
  const outcome = markAllNotificationsRead(null, "u-1", "social");
  assert.deepEqual(outcome.notifications, []);
  assert.deepEqual(outcome.changedNotifications, []);
});
