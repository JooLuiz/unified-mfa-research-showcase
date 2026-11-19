/**
 * Verifies the toast container is announced as a polite live region.
 * Role: Locks the mount attributes shared by both comparison branches.
 * Not in this file: Toast clicks. Delivering a toast uses the branch transport.
 * Key dependencies: node:test; src/notifications/notificationCenter.js; test/support/installDomDocument.js.
 * See also: src/notifications/notificationCenter.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { mountNotificationCenter } = await loadAppModule(
  new URL("./notificationCenter.js", import.meta.url).href,
);

test("the notification center is a polite live region", () => {
  const { root } = installDomDocument();
  mountNotificationCenter(root);

  assert.equal(root.className, "notification-center");
  assert.equal(root.getAttribute("aria-live"), "polite");
  assert.equal(root.getAttribute("aria-atomic"), "false");
});
