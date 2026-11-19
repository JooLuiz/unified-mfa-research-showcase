/**
 * Verifies session revocation delivery on an injected transport.
 * Role: Locks that a subscriber receives one revocation and nothing after unsubscribe.
 * Not in this file: The live connection or local sign-out suppression.
 * Key dependencies: node:test; src/createSessionEvents.js; src/sessionRevocationCommands.js; test/support/createRecordingTransport.js.
 * See also: src/createSessionEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionEvents,
  SESSION_REVOKED_EVENT,
  SESSION_TOPIC,
} from "./createSessionEvents.js";
import { requestSignOutEverywhere } from "./sessionRevocationCommands.js";
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

test("sign-out everywhere without a token stays unauthorized", async () => {
  const result = await requestSignOutEverywhere({
    apiBaseUrl: "http://localhost:4000/api",
    authToken: "",
  });

  assert.deepEqual(result, { ok: false, status: 401 });
});

test("sign-out everywhere with a token reports the server status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 204 });

  try {
    const signedOut = await requestSignOutEverywhere({
      apiBaseUrl: "http://localhost:4000/api",
      authToken: "token-01",
    });
    assert.deepEqual(signedOut, { ok: true, status: 204 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("sign-out everywhere reports the HTTP status when the server rejects the token", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503 });

  try {
    const result = await requestSignOutEverywhere({
      apiBaseUrl: "http://localhost:4000/api",
      authToken: "token-01",
    });
    assert.deepEqual(result, { ok: false, status: 503 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
