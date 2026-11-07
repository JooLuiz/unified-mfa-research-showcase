/**
 * Verifies the notification inbox contract names.
 * Role: Locks the topic and event strings shared by inbox publishers. This package has no create* factory.
 * Not in this file: HTTP inbox calls or a transport adapter.
 * Key dependencies: node:test; src/contracts.js.
 * See also: src/contracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  NOTIFICATION_INBOX_CHANGED_EVENT_NAME,
  NOTIFICATION_INBOX_TOPIC,
} from "./contracts.js";

test("notification inbox contract names stay stable", () => {
  assert.equal(NOTIFICATION_INBOX_TOPIC, "notification-inbox");
  assert.equal(NOTIFICATION_INBOX_CHANGED_EVENT_NAME, "notification-inbox.changed");
});
