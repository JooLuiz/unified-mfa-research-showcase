/**
 * Seeds one unread inbox row in notificationInbox.json, so the same e2e spec works on both
 * the HTTP-notification branch (main) and the Event-Mesh notification branch (mesh).
 * Role: Test-only notice seeder for specs that load an inbox after the notice already exists.
 * Not in this file: Live toasts, mark-as-read, or the order and like rows that caused the notice.
 * Key dependencies: apps/mock-data-service/data/users.json; apps/mock-data-service/data/notificationInbox.json.
 * See also: e2e/support/reset-mock-data.js (must run before seedNotification).
 */

const fs = require("fs/promises");
const path = require("path");

const DATA_DIRECTORY = path.resolve("apps/mock-data-service/data");

/**
 * Resolves a username to its user id by reading users.json.
 *
 * @param {string} username - Username to look up (e.g. "alice.parker").
 * @returns {Promise<string>} The matching user id.
 * @throws {Error} When no user matches the username.
 */
async function resolveUserId(username) {
  const users = JSON.parse(
    await fs.readFile(path.join(DATA_DIRECTORY, "users.json"), "utf8"),
  );
  const matchingUser = users.find((userRecord) => userRecord.username === username);
  if (!matchingUser) {
    throw new Error(`seedNotification - unknown username: ${username}`);
  }
  return matchingUser.id;
}

/**
 * Appends one unread notification for the user and shell.
 *
 * @param {{ username: string, shell: string, type: string, title: string, message: string, link: string }} noticeInput - Recipient, shell, and notice copy.
 * @returns {Promise<void>}
 * @sideEffects Writes apps/mock-data-service/data/notificationInbox.json. Must run after restoreMockData().
 */
async function seedNotification(noticeInput) {
  const userId = await resolveUserId(noticeInput.username);
  const inboxPath = path.join(DATA_DIRECTORY, "notificationInbox.json");
  const inbox = JSON.parse(await fs.readFile(inboxPath, "utf8"));
  inbox.push({
    id: `notification-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    userId,
    shell: noticeInput.shell,
    type: noticeInput.type,
    title: noticeInput.title,
    message: noticeInput.message,
    link: noticeInput.link,
    read: false,
    createdAt: new Date().toISOString(),
  });
  await fs.writeFile(inboxPath, `${JSON.stringify(inbox, null, 2)}\n`, "utf8");
}

module.exports = { seedNotification };
