/**
 * Verifies the session stream delivers session.revoked and honors a local sign-out.
 * Role: Locks the SSE event name and suppression behavior of createSessionStreamSession.
 * Not in this file: Shell navigation or the sign-out HTTP command.
 * Key dependencies: node:test; src/createSessionStreamSession.js; test/support/installBrowserTestDoubles.js.
 * See also: src/createSessionStreamSession.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createSessionStreamSession } from "./createSessionStreamSession.js";
import {
  FakeEventSource,
  installBrowserTestDoubles,
} from "../../../test/support/installBrowserTestDoubles.js";

test("subscribe delivers session.revoked once, and markLocalSignOut suppresses the next one", () => {
  installBrowserTestDoubles();
  const session = createSessionStreamSession();
  const deliveries = [];
  const unsubscribe = session.subscribe(() => {
    deliveries.push("revoked");
  });

  session.start({ apiBaseUrl: "http://localhost:4000/api", authToken: "token-01" });
  const eventSource = FakeEventSource.latestMatching("/auth/session-stream?token=");
  eventSource.emit("session.revoked", {});
  assert.deepEqual(deliveries, ["revoked"]);
  assert.equal(eventSource.closed, true);
  unsubscribe();

  session.start({ apiBaseUrl: "http://localhost:4000/api", authToken: "token-02" });
  const nextSource = FakeEventSource.latestMatching("token-02");
  const suppressed = [];
  session.subscribe(() => {
    suppressed.push("revoked");
  });
  session.markLocalSignOut();
  nextSource.emit("session.revoked", {});

  assert.deepEqual(suppressed, []);
  assert.equal(nextSource.closed, true);
});
