/**
 * Verifies the tab session client delivers one revocation and then suppresses a local sign-out.
 * Role: Locks start, stop, and markLocalSignOut on the shared session.
 * Not in this file: The sign-out command.
 * Key dependencies: node:test; src/sessionEventsClient.js; test/support/createRecordingTransport.js.
 * See also: src/sessionEventsClient.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import {
  markLocalSignOut,
  startSessionStream,
  stopSessionStream,
  subscribeToSessionRevoked,
} from "./sessionEventsClient.js";

test("startSessionStream delivers a revocation until a local sign-out or stop", () => {
  const transport = createRecordingTransport();
  const deliveries = [];
  const unsubscribe = subscribeToSessionRevoked(() => {
    deliveries.push("revoked");
  });

  try {
    startSessionStream(transport);
    transport.deliver("session", "revoked", {});
    markLocalSignOut();
    transport.deliver("session", "revoked", {});
    stopSessionStream();
    transport.deliver("session", "revoked", {});
    assert.deepEqual(deliveries, ["revoked"]);
  } finally {
    unsubscribe();
    stopSessionStream();
  }
});
