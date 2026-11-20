/**
 * Verifies live admin activity stays quiet until an event is pushed.
 * Role: Locks start, stop, and unsubscribe outcomes shared by both comparison branches.
 * Not in this file: A ticket fetch or a live connection.
 * Key dependencies: node:test; src/events/adminLiveEvents.js; test/support/createRecordingTransport.js.
 * See also: src/events/adminLiveEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { startAdminLiveEvents, stopAdminLiveEvents, subscribeToAdminLiveEvents } = await loadAppModule(
  new URL("./adminLiveEvents.js", import.meta.url).href,
);

test("an admin hears order and post events until the stream stops", () => {
  const transport = createRecordingTransport();
  const deliveredEvents = [];
  const unsubscribe = subscribeToAdminLiveEvents((liveEvent) => {
    deliveredEvents.push(liveEvent);
  });
  const order = { id: "order-01" };
  const post = { id: "post-01" };

  startAdminLiveEvents(transport);
  transport.deliver("admin-live", "order-created", order);
  transport.deliver("admin-live", "post-created", post);
  assert.deepEqual(deliveredEvents, [
    { type: "order_created", data: order },
    { type: "post_created", data: post },
  ]);

  stopAdminLiveEvents();
  transport.deliver("admin-live", "order-created", { id: "order-02" });
  unsubscribe();
  assert.equal(deliveredEvents.length, 2);
});
