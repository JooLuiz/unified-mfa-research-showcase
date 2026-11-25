/**
 * Verifies live order and post updates on the admin table pages.
 * Role: Locks what the admin sees when a post arrives after a failed load and when a status
 *   change names an order that is not listed.
 * Not in this file: Initial table rendering (see ordersPage.test.js and postsPage.test.js).
 * Key dependencies: node:test; src/pages/ordersPage.js; src/pages/postsPage.js;
 *   src/events/adminLiveEvents.js; test/support/createRecordingTransport.js.
 * See also: src/events/adminLiveEvents.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installFetch, installPageDocument } from "../../../../test/support/createPageDocument.js";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";
import { startAdminOrderStatusStream, stopAdminOrderStatusStream } from "@shared/order-status-events";

const { createPageRoot } = await installPageDocument();
const { renderOrdersPage } = await loadAppModule(new URL("./ordersPage.js", import.meta.url).href);
const { renderPostsPage } = await loadAppModule(new URL("./postsPage.js", import.meta.url).href);
const { startAdminLiveEvents, stopAdminLiveEvents } = await loadAppModule(
  new URL("../events/adminLiveEvents.js", import.meta.url).href,
);

const admin = { authToken: "token-01", currentUser: { role: "admin" } };

test("a live post after a failed load replaces the error with a table", async () => {
  const transport = createRecordingTransport();
  startAdminLiveEvents(transport);
  installFetch(() => ({ throwError: new Error("posts down") }));
  const pageRoot = createPageRoot();
  const cleanups = [];
  try {
    await renderPostsPage(admin, pageRoot, cleanups);
    assert.match(pageRoot.textContent, /Unable to load posts/);

    transport.deliver("admin-live", "post-created", {
      id: "post-live",
      author: { fullName: "Grace Hopper" },
      createdAt: "2026-01-02T15:04:00.000Z",
      content: "Fresh post",
      likes: 0,
      comments: 0,
    });

    assert.match(pageRoot.textContent, /Fresh post/);
    assert.doesNotMatch(pageRoot.textContent, /Unable to load posts/);
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    stopAdminLiveEvents();
  }
});

test("a status change for an order that is not listed leaves the table unchanged", async () => {
  const transport = createRecordingTransport();
  startAdminOrderStatusStream(transport);
  installFetch(() => ({
    body: {
      items: [
        {
          id: "ord-01",
          customer: { fullName: "Ada Lovelace" },
          placedAt: "2026-03-04T12:00:00.000Z",
          items: [{ quantity: 1 }],
          totalAmount: 10,
          status: "placed",
        },
      ],
    },
  }));
  const pageRoot = createPageRoot();
  const cleanups = [];
  try {
    await renderOrdersPage(admin, pageRoot, cleanups);
    const textBefore = pageRoot.textContent;

    transport.deliver("orders", "status-changed", { orderId: "ord-missing", status: "shipped" });
    assert.equal(pageRoot.textContent, textBefore);

    transport.deliver("orders", "status-changed", { orderId: "ord-01", status: "shipped" });
    assert.match(pageRoot.textContent, /Shipped/);
  } finally {
    cleanups.forEach((cleanup) => cleanup());
    stopAdminOrderStatusStream();
  }
});
