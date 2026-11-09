/**
 * Verifies session revocation delivery on an injected transport.
 * Role: Locks that a subscriber receives one revocation and nothing after unsubscribe.
 * Not in this file: EventSource, HTTP paths, or local sign-out suppression.
 * Key dependencies: node:test; src/createSessionEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createSessionEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionEvents,
  SESSION_REVOKED_EVENT,
  SESSION_TOPIC,
} from "./createSessionEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("subscribeToSessionRevoked delivers one revocation until unsubscribe", () => {
  const transport = createRecordingTransport();
  const sessionEvents = createSessionEvents(transport);
  const deliveries = [];
  const unsubscribe = sessionEvents.subscribeToSessionRevoked(() => {
    deliveries.push("revoked");
  });

  transport.publish({ topic: SESSION_TOPIC, event: SESSION_REVOKED_EVENT, payload: {} });
  unsubscribe();
  transport.publish({ topic: SESSION_TOPIC, event: SESSION_REVOKED_EVENT, payload: {} });

  assert.deepEqual(deliveries, ["revoked"]);
});
