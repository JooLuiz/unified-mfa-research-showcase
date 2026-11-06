/**
 * Verifies inbox rows created by order and post triggers, and the broadcast of each row.
 * Role: Exercises notificationTriggers with an in-memory store and a recording stream.
 * Not in this file: HTTP routing or SSE frame formatting.
 * Key dependencies: node:test; src/domain/notificationTriggers.js.
 * See also: src/domain/notificationTriggers.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  recordOrderPlacedNotifications,
  recordOrderStatusChangedNotifications,
  recordPostCreatedNotifications,
  recordPostLikedNotification,
} = require("./notificationTriggers");

/**
 * Creates a JSON store whose files live in memory.
 *
 * @param {Record<string, unknown>} initialFiles - File name to stored JSON value.
 * @returns {{ readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void>, files: Record<string, unknown> }} In-memory store.
 */
function createMemoryJsonStore(initialFiles) {
  const files = structuredClone(initialFiles);
  return {
    files,
    async readJsonFile(fileName) {
      if (!Object.prototype.hasOwnProperty.call(files, fileName)) {
        const missingFileError = new Error(`Missing ${fileName}`);
        missingFileError.code = "ENOENT";
        throw missingFileError;
      }
      return structuredClone(files[fileName]);
    },
    async readJsonFileWithDefault(fileName, defaultValue) {
      try {
        return await this.readJsonFile(fileName);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          return structuredClone(defaultValue);
        }
        throw error;
      }
    },
    async writeJsonFile(fileName, data) {
      files[fileName] = structuredClone(data);
    },
  };
}

/**
 * Records each broadcast without opening a stream.
 *
 * @returns {{ broadcasts: Array<{ userId: string, shell: string, notification: object }>, broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void }} Recording stream.
 */
function createRecordingStream() {
  const broadcasts = [];
  return {
    broadcasts,
    broadcastNotificationChanged(userId, shell, notification) {
      broadcasts.push({ userId, shell, notification });
    },
  };
}

test("recordOrderPlacedNotifications stores and broadcasts one customer row and one row per admin", async () => {
  const jsonStore = createMemoryJsonStore({
    "users.json": [
      { id: "admin-01", role: "admin" },
      { id: "u-02", role: "customer" },
    ],
    "notificationInbox.json": [],
  });
  const notificationStream = createRecordingStream();

  await recordOrderPlacedNotifications({
    jsonStore,
    notificationInboxEventStream: notificationStream,
    order: { id: "order-01", total: 80 },
    user: { id: "u-01", fullName: "Alice Parker" },
  });

  assert.equal(jsonStore.files["notificationInbox.json"].length, 2);
  assert.deepEqual(
    notificationStream.broadcasts.map((broadcast) => ({
      userId: broadcast.userId,
      shell: broadcast.shell,
    })),
    [
      { userId: "u-01", shell: "ecommerce" },
      { userId: "admin-01", shell: "admin" },
    ],
  );
  assert.equal(
    notificationStream.broadcasts[1].notification.message,
    "A new order #order-01 was placed by Alice Parker.",
  );
});

test("recordPostCreatedNotifications does not write or broadcast when there are no admins", async () => {
  const jsonStore = createMemoryJsonStore({
    "users.json": [{ id: "u-01", role: "customer" }],
  });
  const notificationStream = createRecordingStream();

  await recordPostCreatedNotifications({
    jsonStore,
    notificationInboxEventStream: notificationStream,
    post: { id: "post-01", author: { fullName: "Alice Parker" } },
  });

  assert.equal(Object.hasOwn(jsonStore.files, "notificationInbox.json"), false);
  assert.equal(notificationStream.broadcasts.length, 0);
});

test("recordOrderStatusChangedNotifications tells the customer or the admins, matching the actor", async () => {
  const jsonStore = createMemoryJsonStore({
    "users.json": [{ id: "admin-01", role: "admin" }],
    "notificationInbox.json": [],
  });
  const adminStream = createRecordingStream();
  await recordOrderStatusChangedNotifications({
    jsonStore,
    notificationInboxEventStream: adminStream,
    order: { id: "order-01", userId: "u-01", status: "shipped" },
    actor: "admin",
  });
  assert.deepEqual(
    adminStream.broadcasts.map((broadcast) => broadcast.shell),
    ["ecommerce"],
  );

  const customerStream = createRecordingStream();
  await recordOrderStatusChangedNotifications({
    jsonStore,
    notificationInboxEventStream: customerStream,
    order: { id: "order-01", userId: "u-01", status: "cancellation-requested" },
    actor: "customer",
  });
  assert.deepEqual(
    customerStream.broadcasts.map((broadcast) => ({
      userId: broadcast.userId,
      shell: broadcast.shell,
    })),
    [{ userId: "admin-01", shell: "admin" }],
  );
});

test("recordPostLikedNotification stores one social row for the post author", async () => {
  const jsonStore = createMemoryJsonStore({ "notificationInbox.json": [] });
  const notificationStream = createRecordingStream();

  await recordPostLikedNotification({
    jsonStore,
    notificationInboxEventStream: notificationStream,
    post: { id: "post-01", authorId: "u-01" },
    likerName: "Bruno Silva",
  });

  assert.equal(jsonStore.files["notificationInbox.json"].length, 1);
  assert.equal(notificationStream.broadcasts[0].userId, "u-01");
  assert.equal(notificationStream.broadcasts[0].shell, "social");
  assert.equal(notificationStream.broadcasts[0].notification.link, "/posts/post-01");
  assert.equal(
    notificationStream.broadcasts[0].notification.message,
    "Bruno Silva liked your post.",
  );
});
