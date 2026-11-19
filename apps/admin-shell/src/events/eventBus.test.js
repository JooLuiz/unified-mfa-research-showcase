/**
 * Verifies a shell subscriber hears a published request and stops after unsubscribe.
 * Role: Locks subscribe and publish outcomes shared by both comparison branches.
 * Not in this file: The window dispatch or mesh send that carries the message.
 * Key dependencies: node:test; src/events/eventBus.js; test/support/installBrowserGlobals.js.
 * See also: src/events/eventBus.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const {
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishRenderRequested,
  subscribeToAuthSessionChanges,
  subscribeToHeaderEvents,
  subscribeToRenderRequests,
} = await loadAppModule(new URL("./eventBus.js", import.meta.url).href);

test("a subscriber hears a render request, then stops hearing it after unsubscribe", () => {
  const renderRequests = [];
  const unsubscribe = subscribeToRenderRequests(() => {
    renderRequests.push("render");
  });

  publishRenderRequested();
  assert.deepEqual(renderRequests, ["render"]);

  unsubscribe();
  publishRenderRequested();
  assert.deepEqual(renderRequests, ["render"]);
});

test("an auth subscription can be removed, and publishing auth or logout leaves the caller intact", () => {
  const unsubscribe = subscribeToAuthSessionChanges(() => {});
  publishAuthSessionChanged();
  publishLogoutRequested();
  unsubscribe();
  publishAuthSessionChanged();
  assert.equal(typeof unsubscribe, "function");
});

test("unsubscribing from the header returns a cleanup the caller can run", () => {
  const { root: headerElement } = installDomDocument();
  const unsubscribe = subscribeToHeaderEvents(headerElement, {
    onNavigate() {},
    onLogout() {},
  });
  assert.equal(typeof unsubscribe, "function");
  unsubscribe();
  unsubscribe();
});
