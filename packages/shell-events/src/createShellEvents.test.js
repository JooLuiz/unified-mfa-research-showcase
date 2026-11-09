/**
 * Verifies shell render, session, and logout messages on an injected transport.
 * Role: Locks topic, event, and scope for createShellEvents.
 * Not in this file: Window event names or the Event Mesh client.
 * Key dependencies: node:test; src/createShellEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createShellEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createShellEvents } from "./createShellEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("shell publishes render, session-changed, and logout-requested locally", () => {
  const transport = createRecordingTransport();
  const shellEvents = createShellEvents(transport);

  shellEvents.publishRenderRequested();
  shellEvents.publishAuthSessionChanged();
  shellEvents.publishLogoutRequested();

  assert.deepEqual(transport.published, [
    { topic: "navigation", event: "render-requested", payload: {}, scope: "local" },
    { topic: "auth", event: "session-changed", payload: {}, scope: "local" },
    { topic: "auth", event: "logout-requested", payload: {}, scope: "local" },
  ]);
});

test("subscribeToRenderRequests delivers until unsubscribe", () => {
  const transport = createRecordingTransport();
  const shellEvents = createShellEvents(transport);
  const deliveries = [];
  const unsubscribe = shellEvents.subscribeToRenderRequests(() => {
    deliveries.push("rendered");
  });

  shellEvents.publishRenderRequested();
  unsubscribe();
  shellEvents.publishRenderRequested();

  assert.deepEqual(deliveries, ["rendered"]);
});
