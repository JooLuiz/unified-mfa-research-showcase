/**
 * Verifies session revocation delivery and the sign-out command on an injected transport.
 * Role: Locks that a subscriber receives one revocation, and that sign-out returns the transport outcome.
 * Not in this file: The HTTP adapter that produces a sign-out status.
 * Key dependencies: node:test; src/createSessionEvents.js; src/sessionRevocationCommands.js; test/support/createRecordingTransport.js.
 * See also: src/createSessionEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import {
  createSessionEvents,
  SESSION_REVOKED_EVENT,
  SESSION_TOPIC,
} from "./createSessionEvents.js";
import { createSessionStreamSession } from "./createSessionSession.js";
import { requestSignOutEverywhere } from "./sessionRevocationCommands.js";

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

test("createSessionStreamSession delivers a revocation, stops, and ignores one after a local sign-out", () => {
  const transport = createRecordingTransport();
  const session = createSessionStreamSession();
  const deliveries = [];
  const unsubscribe = session.subscribe(() => {
    deliveries.push("revoked");
  });

  session.start(transport);
  transport.deliver("session", "revoked", {});
  session.markLocalSignOut();
  transport.deliver("session", "revoked", {});
  assert.deepEqual(deliveries, ["revoked"]);

  session.stop();
  transport.deliver("session", "revoked", {});
  assert.deepEqual(deliveries, ["revoked"]);

  session.start(transport);
  transport.deliver("session", "revoked", {});
  unsubscribe();
  session.stop();
  assert.deepEqual(deliveries, ["revoked", "revoked"]);
});

/**
 * Runs sign-out everywhere and locks the recorded request.
 *
 * @param {object} requestReply - Outcome the transport resolves.
 * @returns {Promise<object>} Command result.
 * @sideEffects Asserts the recorded session request.
 */
async function runSignOut(requestReply) {
  const transport = createRecordingTransport({ requestReply });
  const result = await requestSignOutEverywhere(transport);
  assert.deepEqual(transport.published, [
    {
      topic: "session",
      event: "sign-out-everywhere",
      payload: {},
    },
  ]);
  return result;
}

test("sign-out everywhere returns the transport's unauthorized outcome", async () => {
  const result = await runSignOut({ ok: false, status: 401 });

  assert.deepEqual(result, { ok: false, status: 401 });
});

test("sign-out everywhere returns the transport's accepted status", async () => {
  const signedOut = await runSignOut({ ok: true, status: 204 });

  assert.deepEqual(signedOut, { ok: true, status: 204 });
});

test("sign-out everywhere returns the transport's rejected status", async () => {
  const result = await runSignOut({ ok: false, status: 503 });

  assert.deepEqual(result, { ok: false, status: 503 });
});
