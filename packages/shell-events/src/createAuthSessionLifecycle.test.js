/**
 * Verifies the shell session lifecycle moves between guest and signed-in sessions in order.
 * Role: Locks the session mode and the step order for every shell on every comparison branch.
 * Not in this file: A real connection. The channel and hooks are recording fakes.
 * Key dependencies: node:test; src/createAuthSessionLifecycle.js.
 * See also: src/createAuthSessionLifecycle.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createAuthSessionLifecycle } from "./createAuthSessionLifecycle.js";

/**
 * Builds a lifecycle whose channel and hooks record each step.
 *
 * @param {{ signedIn: boolean }} session - Mutable sign-in flag read by isAuthenticated.
 * @param {{ withOptionalHooks?: boolean }} [options] - When false, only isAuthenticated is passed.
 * @returns {{ lifecycle: object, steps: string[] }} Lifecycle and recorded steps.
 */
function createRecordedLifecycle(session, { withOptionalHooks = true } = {}) {
  const steps = [];
  const record = (name) => () => steps.push(name);
  const channel = {
    connectGuest: record("connect-guest"),
    connectAuthenticated: record("connect-authenticated"),
    disconnect: record("disconnect"),
  };
  const hooks = { isAuthenticated: () => session.signedIn };
  if (withOptionalHooks) {
    Object.assign(hooks, {
      attachListeners: record("attach"),
      detachListeners: record("detach"),
      startLiveEvents: record("start-live"),
      stopLiveEvents: record("stop-live"),
      onGuestReady: record("guest-ready"),
    });
  }
  return { lifecycle: createAuthSessionLifecycle(channel, hooks), steps };
}

test("a guest start connects once and a second start only re-attaches", () => {
  const session = { signedIn: false };
  const { lifecycle, steps } = createRecordedLifecycle(session);

  assert.equal(lifecycle.getMode(), "idle");
  lifecycle.start();
  lifecycle.start();

  assert.equal(lifecycle.getMode(), "guest");
  assert.deepEqual(steps, ["connect-guest", "attach", "guest-ready", "attach", "guest-ready"]);
});

test("signing in replaces the guest session and a refresh keeps the signed-in one", () => {
  const session = { signedIn: false };
  const { lifecycle, steps } = createRecordedLifecycle(session);
  lifecycle.start();
  steps.length = 0;

  session.signedIn = true;
  lifecycle.sync();
  assert.equal(lifecycle.getMode(), "authenticated");
  assert.deepEqual(steps, [
    "detach",
    "stop-live",
    "disconnect",
    "connect-authenticated",
    "attach",
    "start-live",
  ]);

  steps.length = 0;
  lifecycle.sync();
  assert.equal(lifecycle.getMode(), "authenticated");
  assert.deepEqual(steps, ["attach", "start-live"]);
});

test("signing out drops the signed-in session and reopens a guest session", () => {
  const session = { signedIn: true };
  const { lifecycle, steps } = createRecordedLifecycle(session);
  lifecycle.start();
  assert.equal(lifecycle.getMode(), "authenticated");
  steps.length = 0;

  session.signedIn = false;
  lifecycle.sync();

  assert.equal(lifecycle.getMode(), "guest");
  assert.deepEqual(steps, [
    "detach",
    "stop-live",
    "disconnect",
    "connect-guest",
    "attach",
    "guest-ready",
  ]);
});

test("a guest start is ignored while a signed-in session is open", () => {
  const session = { signedIn: true };
  const { lifecycle, steps } = createRecordedLifecycle(session);
  lifecycle.start();
  steps.length = 0;

  session.signedIn = false;
  lifecycle.start();

  assert.equal(lifecycle.getMode(), "authenticated");
  assert.deepEqual(steps, []);
});

test("optional hooks may be left out", () => {
  const session = { signedIn: false };
  const { lifecycle, steps } = createRecordedLifecycle(session, { withOptionalHooks: false });

  lifecycle.start();
  session.signedIn = true;
  lifecycle.sync();
  session.signedIn = false;
  lifecycle.sync();

  assert.equal(lifecycle.getMode(), "guest");
  assert.deepEqual(steps, [
    "connect-guest",
    "disconnect",
    "connect-authenticated",
    "disconnect",
    "connect-guest",
  ]);
});
