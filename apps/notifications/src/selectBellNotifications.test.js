/**
 * Verifies the bell keeps unread notifications ahead of read ones.
 * Role: Locks selectBellNotifications for a missing list, a capped unread-first list, and read rows that fill the rest.
 * Not in this file: Rendering the bell.
 * Key dependencies: node:test; src/selectBellNotifications.js.
 * See also: src/selectBellNotifications.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { selectBellNotifications } from "./selectBellNotifications.js";

test("a missing notification list is empty, and unread rows come first", () => {
  assert.deepEqual(selectBellNotifications(null), []);

  const selected = selectBellNotifications(
    [
      { id: "old-read", read: true, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "new-unread", read: false, createdAt: "2026-01-03T00:00:00.000Z" },
      { id: "old-unread", read: false, createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "new-read", read: true, createdAt: "2026-01-04T00:00:00.000Z" },
    ],
    2,
  );

  assert.deepEqual(
    selected.map((notification) => notification.id),
    ["new-unread", "old-unread"],
  );
});

test("a value that is not a list is an empty bell, and read rows fill the remaining slots", () => {
  assert.deepEqual(selectBellNotifications(undefined), []);
  assert.deepEqual(selectBellNotifications({ length: 1 }), []);

  const selected = selectBellNotifications(
    [
      { id: "read-old", read: true, createdAt: "2026-02-01T00:00:00.000Z" },
      { id: "read-new", read: true, createdAt: "2026-02-02T00:00:00.000Z" },
      { id: "only-unread", read: false, createdAt: "2026-01-01T00:00:00.000Z" },
    ],
    2,
  );

  assert.deepEqual(
    selected.map((notification) => notification.id),
    ["only-unread", "read-new"],
  );
});
