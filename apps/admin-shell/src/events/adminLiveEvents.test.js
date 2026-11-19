/**
 * Verifies live admin activity stays quiet unless the session is an admin.
 * Role: Locks start, stop, and unsubscribe outcomes shared by both comparison branches.
 * Not in this file: A ticket fetch or a live connection. Those paths differ by branch and belong in e2e.
 * Key dependencies: node:test; src/events/adminLiveEvents.js.
 * See also: src/events/adminLiveEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { startAdminLiveEvents, stopAdminLiveEvents, subscribeToAdminLiveEvents } = await loadAppModule(
  new URL("./adminLiveEvents.js", import.meta.url).href,
);

test("a shopper who is not an admin receives no live admin activity", async () => {
  const deliveredEvents = [];
  const unsubscribe = subscribeToAdminLiveEvents((liveEvent) => {
    deliveredEvents.push(liveEvent);
  });

  await startAdminLiveEvents({
    authToken: "token-01",
    currentUser: { id: "user-01", role: "customer" },
  });
  unsubscribe();
  stopAdminLiveEvents();

  assert.deepEqual(deliveredEvents, []);
});
